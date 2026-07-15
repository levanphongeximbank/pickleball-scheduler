-- =====================================================================
-- PHASE 45A.3A — CLUB GOVERNANCE RPC DDL RECONCILIATION (RECORD-ONLY)
-- =====================================================================
--
-- Purpose:
--   Reconcile into the repository the EXACT deployed DDL for three Club
--   governance RPCs that were applied to Production/Staging via migration
--   `phase_42c_membership_and_governance_rpcs` but whose CREATE FUNCTION
--   text was never committed to the repo:
--     1. public.club_assign_owner(uuid, text, uuid, integer)
--     2. public.club_clear_owner(uuid, text, integer)
--     3. public.club_transfer_president(uuid, text, uuid, integer)
--
-- Confidence: EXACT
--   Recovered 2026-07-15 via a single read-only catalog introspection:
--     - pg_get_functiondef(oid)  → live Production function bodies
--     - supabase_migrations.schema_migrations.statements
--         (migration name = 'phase_42c_membership_and_governance_rpcs',
--          version         = '20260710035123', Production)
--   Both sources agree. The bodies below are the verbatim
--   pg_get_functiondef output (the canonical currently-deployed form).
--
-- Deployment status (read-only list_migrations, 2026-07-15):
--   Production migration version 20260710035123  — present
--   Staging    migration version 20260710034003  — present
--
-- Runtime impact of running this file:
--   RECORD-ONLY. Each statement is CREATE OR REPLACE with the identical
--   deployed body, so applying it to Production is behavior-neutral
--   (no signature/body change). On a clean rebuild (e.g. staging/DR) it
--   recreates the three functions exactly as deployed.
--   Contains NO DROP / ALTER / DML and introduces NO new RPCs.
--
-- Prerequisites (already deployed; NOT (re)defined here — out of scope):
--   Tables:    public.clubs, public.club_members,
--              public.club_governance_assignments, public.audit_logs
--   Helpers:   public.phase42_err(text, text)
--              public.phase42_idempotency_get(uuid, text)
--              public.phase42_idempotency_put(uuid, text, text, text, jsonb)
--              public.phase42_write_audit(text, text, text, text, text, jsonb)
--              public.phase42_club_canonical(text)
--              public.phase42_is_platform_super_admin()
--              public.phase42_is_tenant_member(text)
--              public.phase42_has_gov_role(text, text[])
--   (defined in phase_42b_club_storage_ssot_schema / phase_42c_helpers_and_rls
--    / phase_42g_permissions_constraint_helpers)
--
-- Server audit actions emitted (whitelisted in
--   docs/v5/PHASE_42KA_GOVERNANCE_AUDIT_PATCH.sql):
--     club.assign_owner, club.clear_owner, club.transfer_president
--
-- Live EXECUTE grants (Production pg_proc.proacl, 2026-07-15):
--   {=X/postgres, postgres=X/postgres, anon=X/postgres,
--    authenticated=X/postgres, service_role=X/postgres}
--   i.e. PUBLIC + anon + service_role EXECUTE come from the standard
--   Supabase environment defaults on schema public; the explicit grant
--   authored by the original migration (reproduced below) is to
--   `authenticated`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. public.club_assign_owner
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_assign_owner(p_request_id uuid, p_club_id text, p_member_user_id uuid, p_expected_club_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cached jsonb; v_club public.clubs%rowtype; v_member public.club_members%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_assign_owner');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Chỉ tenant owner/staff hoặc Super Admin gán Chủ sở hữu.');
  end if;
  select * into v_member from public.club_members where club_id = v_club.id and user_id = p_member_user_id and status = 'active';
  if not found then return public.phase42_err('MEMBER_REQUIRED', 'Chủ sở hữu phải là thành viên active.'); end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'club_owner' and status = 'active';
  insert into public.club_governance_assignments (tenant_id, club_id, club_member_id, role_code, status, version)
  values (v_club.tenant_id, v_club.id, v_member.id, 'club_owner', 'active', 1);
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.assign_owner','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('owner_user_id', p_member_user_id, 'request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_assign_owner', v_club.id, v_resp);
  return v_resp::json;
end;
$function$
;

grant execute on function public.club_assign_owner(uuid, text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. public.club_clear_owner
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_clear_owner(p_request_id uuid, p_club_id text, p_expected_club_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_club public.clubs%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_clear_owner');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền clear owner.');
  end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'club_owner' and status = 'active';
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.clear_owner','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_clear_owner', v_club.id, v_resp);
  return v_resp::json;
end;
$function$
;

grant execute on function public.club_clear_owner(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. public.club_transfer_president
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_transfer_president(p_request_id uuid, p_club_id text, p_next_user_id uuid, p_expected_club_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_club public.clubs%rowtype; v_member public.club_members%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_transfer_president');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_has_gov_role(v_club.id, array['club_owner','president'])
          or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền chuyển Chủ tịch.');
  end if;
  select * into v_member from public.club_members where club_id = v_club.id and user_id = p_next_user_id and status = 'active';
  if not found then return public.phase42_err('MEMBER_REQUIRED', 'Chủ tịch mới phải là thành viên active.'); end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'president' and status = 'active';
  insert into public.club_governance_assignments (tenant_id, club_id, club_member_id, role_code, status, version)
  values (v_club.tenant_id, v_club.id, v_member.id, 'president', 'active', 1);
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.transfer_president','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('next_user_id', p_next_user_id, 'request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_transfer_president', v_club.id, v_resp);
  return v_resp::json;
end;
$function$
;

grant execute on function public.club_transfer_president(uuid, text, uuid, integer) to authenticated;

-- =====================================================================
-- END — PHASE 45A.3A reconciliation (3 functions, record-only)
-- =====================================================================

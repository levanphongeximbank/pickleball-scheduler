-- =====================================================================
-- PHASE 45A.4A — MEMBERSHIP REQUEST RPC DDL RECONCILIATION (RECORD-ONLY)
-- =====================================================================
--
-- Purpose:
--   Reconcile into the repository the EXACT deployed DDL for three Membership
--   Request RPCs that were applied to Production/Staging via migration
--   `phase_42c_membership_and_governance_rpcs` but whose CREATE FUNCTION
--   text was never committed to the repo:
--     1. public.club_submit_membership_request(uuid, text, text)
--     2. public.club_cancel_membership_request(uuid, uuid, integer)
--     3. public.club_list_my_requests()
--
-- Confidence: EXACT
--   Recovered 2026-07-15 via read-only catalog introspection:
--     - pg_get_functiondef(oid) → live Production + Staging bodies (identical)
--     - supabase_migrations.schema_migrations.statements
--         (migration name = 'phase_42c_membership_and_governance_rpcs',
--          Production version = '20260710035123',
--          Staging    version = '20260710034003')
--   Live bodies agree with the phase_42c authored SQL (cosmetic differences
--   only: pg_get_functiondef expands `int`→`integer`, `DEFAULT ''`→
--   `DEFAULT ''::text`, and normalizes keyword casing / `$function$` delimiters).
--
-- Deployment status (read-only catalog / migration history, 2026-07-15):
--   Production migration version 20260710035123  — present
--   Staging    migration version 20260710034003  — present
--   Only the V2 identity-args overload of club_submit_membership_request
--   remains on Production (legacy Phase 31 (text, text, numeric) is gone).
--
-- Runtime impact of running this file:
--   RECORD-ONLY. Each statement is CREATE OR REPLACE with the identical
--   deployed body, so applying it to Production is behavior-neutral
--   (no signature/body change). On a clean rebuild (e.g. staging/DR) it
--   recreates the three functions exactly as deployed.
--   Contains NO DROP / ALTER / DML and introduces NO new RPCs.
--
-- Out of scope (intentionally NOT recovered here):
--   club_review_membership_request, club_list_pending_requests,
--   club_leave_membership, add/remove member, role/status/restore,
--   governance RPCs, archive/delete.
--
-- Prerequisites (already deployed; NOT (re)defined here — out of scope):
--   Tables:    public.clubs, public.club_membership_requests_v42,
--              public.club_members, public.audit_logs
--   Helpers:   public.phase42_err(text, text)
--              public.phase42_idempotency_get(uuid, text)
--              public.phase42_idempotency_put(uuid, text, text, text, jsonb)
--              public.phase42_write_audit(text, text, text, text, text, jsonb)
--              public.phase42_is_platform_super_admin()
--              public.phase42_active_club_member_id(text)
--
-- Server audit action emitted (submit only):
--     club.membership_request.submit
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
-- 1. public.club_submit_membership_request
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
--    Staging pg_get_functiondef: identical
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_submit_membership_request(p_request_id uuid, p_club_id text, p_message text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cached jsonb; v_club public.clubs%rowtype; v_id uuid; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  if public.phase42_is_platform_super_admin() then
    return public.phase42_err('FORBIDDEN', 'Super Admin không xin gia nhập CLB.');
  end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_submit_membership_request');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null and status = 'active';
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if public.phase42_active_club_member_id(v_club.id) is not null then
    return public.phase42_err('ALREADY_MEMBER', 'Bạn đã là thành viên CLB.');
  end if;
  insert into public.club_membership_requests_v42 (tenant_id, club_id, user_id, message, status, version)
  values (v_club.tenant_id, v_club.id, auth.uid(), coalesce(p_message,''), 'pending', 1)
  returning id into v_id;
  perform public.phase42_write_audit('club.membership_request.submit','club_membership_request', v_id::text, v_club.tenant_id, v_club.id,
    jsonb_build_object('request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id, 'club_id', v_club.id, 'status', 'pending'), 'version', 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_submit_membership_request', v_club.id, v_resp);
  return v_resp::json;
exception when unique_violation then
  return public.phase42_err('PENDING_EXISTS', 'Đã có yêu cầu đang chờ duyệt.');
end;
$function$
;

grant execute on function public.club_submit_membership_request(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. public.club_cancel_membership_request
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
--    Staging pg_get_functiondef: identical
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_cancel_membership_request(p_request_id uuid, p_membership_request_id uuid, p_expected_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_row public.club_membership_requests_v42%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_cancel_membership_request');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_row from public.club_membership_requests_v42 where id = p_membership_request_id;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.'); end if;
  if v_row.user_id <> auth.uid() then return public.phase42_err('FORBIDDEN', 'Không hủy được yêu cầu của người khác.'); end if;
  if v_row.status <> 'pending' then return public.phase42_err('INVALID_STATUS', 'Yêu cầu không còn pending.'); end if;
  if v_row.version <> coalesce(p_expected_version, v_row.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản.');
  end if;
  update public.club_membership_requests_v42 set status = 'cancelled', version = version + 1 where id = v_row.id;
  v_resp := jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_row.id, 'status', 'cancelled'), 'version', v_row.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_row.tenant_id, 'club_cancel_membership_request', v_row.id::text, v_resp);
  return v_resp::json;
end;
$function$
;

grant execute on function public.club_cancel_membership_request(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. public.club_list_my_requests
--    Source: Production pg_get_functiondef (verbatim), 2026-07-15
--    Staging pg_get_functiondef: identical
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_list_my_requests()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_rows jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) into v_rows
  from public.club_membership_requests_v42 r where r.user_id = auth.uid();
  return json_build_object('ok', true, 'data', v_rows);
end;
$function$
;

grant execute on function public.club_list_my_requests() to authenticated;

-- =====================================================================
-- END — PHASE 45A.4A reconciliation (3 functions, record-only)
-- =====================================================================

-- =====================================================================
-- PHASE 1C — club_assign_owner / club_clear_owner AUTHORIZATION GATE
-- =====================================================================
--
-- SECURITY BLOCKER (read-only proof):
--   Live deployed bodies (docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql,
--   Production pg_get_functiondef 2026-07-15) authorize via:
--     phase42_is_platform_super_admin() OR phase42_is_tenant_member(tenant_id)
--
--   phase42_is_tenant_member (docs/v5/PHASE_42C_RLS_RPC.sql) is TRUE for:
--     - ANY active public.tenant_members row (role_code tenant_owner OR tenant_staff)
--     - OR profiles.role in VENUE_OWNER|COURT_OWNER|VENUE_MANAGER|COURT_MANAGER|TENANT_OWNER
--       with profiles.venue_id = tenant_id
--
--   Therefore an ordinary tenant_staff (and VENUE_MANAGER / COURT_MANAGER) can call
--   club_assign_owner / club_clear_owner → privilege escalation vs Owner policy.
--
-- This patch NARROWIS authorization. It does NOT silently add club_owner transfer
-- capability (requires explicit Owner GO — see OPTIONAL section at bottom).
--
-- Staging first. Production: DO NOT APPLY from this branch without Owner GO.
--
-- ALLOW (phase42_can_assign_club_owner):
--   SUPER_ADMIN / platform super admin
--   Explicit tenant_owner (tenant_members.role_code) OR profile
--     VENUE_OWNER | COURT_OWNER | TENANT_OWNER on club.tenant_id
--     AND user_has_permission('club.governance.assign_owner' OR 'club.update')
--
-- DENY:
--   bare phase42_is_tenant_member / tenant_staff
--   VENUE_MANAGER / COURT_MANAGER alone
--   Club Owner alone (pending Owner GO)
--   Club President alone
--   Vice President alone
--   Ordinary club member / PLAYER
--   Unrelated authenticated user
--   Anonymous → NOT_AUTHENTICATED (unchanged in RPC body)
--
-- Rollback: docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql
-- =====================================================================

create or replace function public.phase42_can_assign_club_owner(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.phase42_is_platform_super_admin()
    or exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and c.deleted_at is null
        and (
          public.user_has_permission('club.governance.assign_owner')
          or public.user_has_permission('club.update')
        )
        and (
          exists (
            select 1
            from public.tenant_members tm
            where tm.tenant_id = c.tenant_id
              and tm.user_id = auth.uid()
              and tm.status = 'active'
              and tm.role_code = 'tenant_owner'
          )
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.venue_id = c.tenant_id
              and upper(coalesce(p.role, '')) in (
                'VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER'
              )
          )
        )
    );
$$;

grant execute on function public.phase42_can_assign_club_owner(text) to authenticated;

-- ---------------------------------------------------------------------
-- club_assign_owner — same body as deployed reconciliation, authz narrowed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_assign_owner(
  p_request_id uuid,
  p_club_id text,
  p_member_user_id uuid,
  p_expected_club_version integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_assign_owner');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, ''))
    and deleted_at is null
  for update;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;

  if not public.phase42_can_assign_club_owner(v_club.id) then
    return public.phase42_err(
      'FORBIDDEN',
      'Chỉ Super Admin hoặc chủ sân (tenant owner) được gán Chủ sở hữu CLB.'
    );
  end if;

  select * into v_member
  from public.club_members
  where club_id = v_club.id
    and user_id = p_member_user_id
    and status = 'active';
  if not found then
    return public.phase42_err('MEMBER_REQUIRED', 'Chủ sở hữu phải là thành viên active.');
  end if;

  update public.club_governance_assignments
  set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id
    and role_code = 'club_owner'
    and status = 'active';

  insert into public.club_governance_assignments (
    tenant_id, club_id, club_member_id, role_code, status, version
  )
  values (
    v_club.tenant_id, v_club.id, v_member.id, 'club_owner', 'active', 1
  );

  update public.clubs set version = version + 1 where id = v_club.id;

  perform public.phase42_write_audit(
    'club.assign_owner',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object('owner_user_id', p_member_user_id, 'request_id', p_request_id)
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'club_assign_owner', v_club.id, v_resp
  );
  return v_resp::json;
end;
$function$;

grant execute on function public.club_assign_owner(uuid, text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- club_clear_owner — same body as deployed reconciliation, authz narrowed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_clear_owner(
  p_request_id uuid,
  p_club_id text,
  p_expected_club_version integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_clear_owner');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, ''))
    and deleted_at is null
  for update;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;

  if not public.phase42_can_assign_club_owner(v_club.id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền clear owner.');
  end if;

  update public.club_governance_assignments
  set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id
    and role_code = 'club_owner'
    and status = 'active';

  update public.clubs set version = version + 1 where id = v_club.id;

  perform public.phase42_write_audit(
    'club.clear_owner',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object('request_id', p_request_id)
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'club_clear_owner', v_club.id, v_resp
  );
  return v_resp::json;
end;
$function$;

grant execute on function public.club_clear_owner(uuid, text, integer) to authenticated;

-- =====================================================================
-- OPTIONAL (Owner GO required) — allow current Club Owner to transfer:
--   Replace the helper body with:
--     phase42_is_platform_super_admin()
--     OR phase42_has_gov_role(p_club_id, array['club_owner'])
--     OR (tenant_owner path above)
--   Do NOT enable silently from this Phase 1C branch.
-- =====================================================================

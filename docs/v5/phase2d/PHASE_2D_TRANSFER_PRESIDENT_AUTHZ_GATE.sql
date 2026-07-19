-- =====================================================================
-- PHASE 2D — club_transfer_president AUTHORIZATION GATE (Staging first)
-- =====================================================================
--
-- SECURITY GAP (certified in Phase 2D inventory):
--   Live club_transfer_president (45A.3A reconciliation) authorizes via:
--     phase42_is_platform_super_admin()
--     OR phase42_has_gov_role(club_owner|president)
--     OR phase42_is_tenant_member(tenant_id)   ← TOO BROAD
--
--   phase42_is_tenant_member is TRUE for tenant_staff and venue managers,
--   allowing privilege escalation vs Owner freeze policy
--   (Owner / President / tenant_owner / SA only).
--
-- This patch NARROWIS authorization to match phase42_can_manage_vice_presidents
-- shape (owner/president/tenant_owner/SA). Does NOT change OCC, audit, or
-- eligibility (active membership still required).
--
-- Staging first. Production: DO NOT APPLY without Owner GO.
-- Rollback: docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_ROLLBACK.sql
-- =====================================================================

create or replace function public.phase42_can_transfer_president(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.phase42_is_platform_super_admin()
    or public.phase42_has_gov_role(p_club_id, array['club_owner', 'president'])
    or exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and c.deleted_at is null
        and public.user_has_permission('club.update')
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

grant execute on function public.phase42_can_transfer_president(text) to authenticated;

-- ---------------------------------------------------------------------
-- club_transfer_president — same body as 45A.3A, authz narrowed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_transfer_president(
  p_request_id uuid,
  p_club_id text,
  p_next_user_id uuid,
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

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_transfer_president');
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

  if not public.phase42_can_transfer_president(v_club.id) then
    return public.phase42_err(
      'FORBIDDEN',
      'Chỉ Chủ tịch, Chủ sở hữu CLB, chủ sân hoặc Super Admin được chuyển Chủ tịch.'
    );
  end if;

  select * into v_member
  from public.club_members
  where club_id = v_club.id
    and user_id = p_next_user_id
    and status = 'active';
  if not found then
    return public.phase42_err('MEMBER_REQUIRED', 'Chủ tịch mới phải là thành viên active.');
  end if;

  update public.club_governance_assignments
  set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id
    and role_code = 'president'
    and status = 'active';

  insert into public.club_governance_assignments (
    tenant_id, club_id, club_member_id, role_code, status, version
  )
  values (
    v_club.tenant_id, v_club.id, v_member.id, 'president', 'active', 1
  );

  update public.clubs set version = version + 1 where id = v_club.id;

  perform public.phase42_write_audit(
    'club.transfer_president',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object('next_user_id', p_next_user_id, 'request_id', p_request_id)
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'club_transfer_president', v_club.id, v_resp
  );
  return v_resp::json;
end;
$function$;

grant execute on function public.club_transfer_president(uuid, text, uuid, integer) to authenticated;

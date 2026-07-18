-- =====================================================================
-- PHASE 1B — club_update AUTHORIZATION SECURITY GATE (STAGING FIRST)
-- =====================================================================
--
-- Root cause (live QA):
--   public.club_update authorized via bare phase42_is_tenant_member(tenant_id),
--   so any ordinary tenant member could update club metadata.
--
-- This patch is idempotent (CREATE OR REPLACE) and Staging-first.
-- Production: NOT APPLIED from this branch.
--
-- Does NOT change:
--   - VP helpers / VP RPCs
--   - RLS policies
--   - audit_logs constraint
--   - member add/remove/restore RPCs
--   - V1 client paths (flag OFF)
--
-- ALLOW (phase42_can_update_club):
--   SUPER_ADMIN / platform super admin
--   Club Owner / Club President (gov roles)
--   Explicit tenant_owner OR profile VENUE_OWNER|COURT_OWNER|TENANT_OWNER
--     with user_has_permission('club.update')
--
-- DENY:
--   Ordinary tenant member / tenant_staff (bare membership)
--   Ordinary club member / PLAYER
--   Vice President alone
--   Unrelated authenticated user
--
-- Source of truth for club_update body: docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql
-- =====================================================================

create or replace function public.phase42_can_update_club(p_club_id text)
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

grant execute on function public.phase42_can_update_club(text) to authenticated;

create or replace function public.club_update(
  p_request_id uuid,
  p_club_id text,
  p_expected_club_version integer,
  p_name text default null,
  p_code text default null,
  p_description text default null,
  p_status text default null,
  p_registered_cluster_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_name text;
  v_code text;
  v_description text;
  v_status text;
  v_cluster text;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_update');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, '')) and deleted_at is null
  for update;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;

  if not public.phase42_can_update_club(v_club.id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền cập nhật CLB.');
  end if;

  v_name := case when p_name is null then v_club.name else trim(p_name) end;
  if coalesce(v_name, '') = '' then
    return public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  end if;

  v_code := case when p_code is null then v_club.code else nullif(trim(p_code), '') end;
  v_description := case when p_description is null then v_club.description else p_description end;
  v_status := case when p_status is null then v_club.status else trim(p_status) end;
  v_cluster := case
    when p_registered_cluster_id is null then v_club.registered_cluster_id
    else nullif(trim(p_registered_cluster_id), '')
  end;

  if v_status not in ('pending_setup', 'pending_approval', 'active', 'inactive') then
    return public.phase42_err('INVALID_STATUS', 'Trạng thái CLB không hợp lệ.');
  end if;

  if exists (
    select 1 from public.clubs c
    where c.tenant_id = v_club.tenant_id
      and c.deleted_at is null
      and c.id <> v_club.id
      and lower(c.name) = lower(v_name)
  ) then
    return public.phase42_err('DUPLICATE_NAME', 'Tên CLB đã tồn tại trong tenant này.');
  end if;

  if v_code is not null and exists (
    select 1 from public.clubs c
    where c.tenant_id = v_club.tenant_id
      and c.deleted_at is null
      and c.id <> v_club.id
      and c.code = v_code
  ) then
    return public.phase42_err('DUPLICATE_CODE', 'Mã CLB đã tồn tại trong tenant này.');
  end if;

  update public.clubs
  set name = v_name,
      code = v_code,
      description = coalesce(v_description, ''),
      status = v_status,
      registered_cluster_id = v_cluster,
      version = version + 1
  where id = v_club.id;

  perform public.phase42_write_audit(
    'club.update', 'club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'from_version', v_club.version,
      'fields', jsonb_build_object(
        'name', (p_name is not null),
        'code', (p_code is not null),
        'description', (p_description is not null),
        'status', (p_status is not null),
        'registered_cluster_id', (p_registered_cluster_id is not null)
      )
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_update', v_club.id, v_resp);
  return v_resp::json;

exception
  when unique_violation then
    return public.phase42_err('DUPLICATE_CLUB', 'CLB trùng tên hoặc mã trong tenant.');
  when others then
    return public.phase42_err('UPDATE_FAILED', coalesce(sqlerrm, 'Không cập nhật được CLB.'));
end;
$$;

grant execute on function public.club_update(uuid, text, integer, text, text, text, text, text) to authenticated;

-- =====================================================================
-- END — Phase 1B club_update authz security gate
-- Production deployment status: NOT APPLIED
-- =====================================================================

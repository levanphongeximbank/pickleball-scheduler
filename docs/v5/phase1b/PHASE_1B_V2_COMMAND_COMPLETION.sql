-- =====================================================================
-- PHASE 1B — CLUB MANAGEMENT V2 COMMAND COMPLETION
-- =====================================================================
--
-- Purpose (Staging apply only — DO NOT run on Production from this PR):
--   1. Hydrate vice presidents into public.phase42_club_canonical
--   2. Create phase42_can_manage_vice_presidents + VP assign/clear RPCs
--
-- Companion SQL (apply BEFORE this file on Staging):
--   docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql   → audit prerequisite
--   docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql          → club_update
--   docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql               → add/remove
--   docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql       → restore
--
-- Recommended Staging apply order:
--   0) PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
--   1) PHASE_45A3C_CLUB_UPDATE_RPC.sql
--   2) PHASE_45A4C1_MEMBER_RPC.sql
--   3) PHASE_45A4D1_MEMBER_RESTORE_RPC.sql
--   4) THIS FILE (canonical VP hydrate + VP RPCs)
--
-- Writes ONLY:
--   public.club_governance_assignments (VP roles)
--   public.clubs.version (optimistic concurrency bump)
--   public.audit_logs / idempotency_requests
-- Never writes: club_data_v3, club_governance (V1), profiles.club_id, blob.
--
-- No truncate / DROP TABLE / destructive DML.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit whitelist prerequisite
--    DO NOT drop/recreate audit_logs_action_check here (23514 risk).
--    Apply first: docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 2. phase42_club_canonical — hydrate vice presidents (max product: 2)
-- ---------------------------------------------------------------------
create or replace function public.phase42_club_canonical(p_club_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club public.clubs%rowtype;
  v_owner_name text;
  v_president_name text;
  v_owner_user uuid;
  v_president_user uuid;
  v_member_count int;
  v_vp_user_ids jsonb := '[]'::jsonb;
  v_vp_labels jsonb := '[]'::jsonb;
  v_vp_first_user uuid;
  v_vp_first_label text;
begin
  select * into v_club from public.clubs where id = p_club_id;
  if not found then
    return null;
  end if;

  select cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    into v_owner_user, v_owner_name
  from public.club_governance_assignments g
  join public.club_members cm on cm.id = g.club_member_id
  left join public.profiles p on p.id = cm.user_id
  where g.club_id = p_club_id and g.status = 'active' and g.role_code = 'club_owner'
  limit 1;

  select cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    into v_president_user, v_president_name
  from public.club_governance_assignments g
  join public.club_members cm on cm.id = g.club_member_id
  left join public.profiles p on p.id = cm.user_id
  where g.club_id = p_club_id and g.status = 'active' and g.role_code = 'president'
  limit 1;

  select
    coalesce(jsonb_agg(to_jsonb(x.user_id) order by x.effective_from, x.user_id), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(x.label) order by x.effective_from, x.user_id), '[]'::jsonb)
  into v_vp_user_ids, v_vp_labels
  from (
    select
      cm.user_id,
      coalesce(p.display_name, p.email, cm.user_id::text) as label,
      g.effective_from
    from public.club_governance_assignments g
    join public.club_members cm on cm.id = g.club_member_id
    left join public.profiles p on p.id = cm.user_id
    where g.club_id = p_club_id
      and g.status = 'active'
      and g.role_code = 'vice_president'
  ) x;

  if jsonb_array_length(v_vp_user_ids) > 0 then
    v_vp_first_user := (v_vp_user_ids ->> 0)::uuid;
    v_vp_first_label := v_vp_labels ->> 0;
  end if;

  select count(*)::int into v_member_count
  from public.club_members
  where club_id = p_club_id and status = 'active';

  return jsonb_build_object(
    'id', v_club.id,
    'tenant_id', v_club.tenant_id,
    'name', v_club.name,
    'code', v_club.code,
    'description', v_club.description,
    'status', v_club.status,
    'registered_cluster_id', v_club.registered_cluster_id,
    'version', v_club.version,
    'created_by_user_id', v_club.created_by_user_id,
    'created_at', v_club.created_at,
    'updated_at', v_club.updated_at,
    'owner_user_id', v_owner_user,
    'owner_label', v_owner_name,
    'president_user_id', v_president_user,
    'president_label', v_president_name,
    'vice_president_user_id', v_vp_first_user,
    'vice_president_label', v_vp_first_label,
    'vice_president_user_ids', v_vp_user_ids,
    'vice_president_labels', v_vp_labels,
    'active_member_count', v_member_count
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. phase42_can_manage_vice_presidents — narrow authz (Phase 1B security gate)
--    ALLOW: platform super admin
--           active club_owner / president on this club
--           tenant_owner (tenant_members.role_code) OR profile role
--             VENUE_OWNER / COURT_OWNER / TENANT_OWNER on club.tenant_id
--             AND user_has_permission('club.update')
--    DENY:  bare tenant_members rows (tenant_staff / ordinary staff)
--           vice_president alone
--           ordinary club members / PLAYER without gov role
-- ---------------------------------------------------------------------
create or replace function public.phase42_can_manage_vice_presidents(p_club_id text)
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

grant execute on function public.phase42_can_manage_vice_presidents(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. public.club_assign_vice_president — add one VP (max 2 active)
-- ---------------------------------------------------------------------
create or replace function public.club_assign_vice_president(
  p_request_id uuid,
  p_club_id text,
  p_member_user_id uuid,
  p_expected_club_version integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
  v_president_user uuid;
  v_vp_count int;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;
  if p_member_user_id is null then
    return public.phase42_err('VALIDATION', 'Thiếu user Phó chủ tịch.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_assign_vice_president');
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

  -- Security gate: never authorize via bare tenant-member helper.
  if not public.phase42_can_manage_vice_presidents(v_club.id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền gán Phó chủ tịch.');
  end if;

  select * into v_member
  from public.club_members
  where club_id = v_club.id and user_id = p_member_user_id and status = 'active';
  if not found then
    return public.phase42_err('MEMBER_REQUIRED', 'Phó chủ tịch phải là thành viên active.');
  end if;

  select cm.user_id into v_president_user
  from public.club_governance_assignments g
  join public.club_members cm on cm.id = g.club_member_id
  where g.club_id = v_club.id and g.status = 'active' and g.role_code = 'president'
  limit 1;

  if v_president_user is not null and v_president_user = p_member_user_id then
    return public.phase42_err('VALIDATION', 'Phó chủ tịch không thể trùng Chủ tịch.');
  end if;

  if exists (
    select 1
    from public.club_governance_assignments g
    where g.club_id = v_club.id
      and g.club_member_id = v_member.id
      and g.role_code = 'vice_president'
      and g.status = 'active'
  ) then
    v_resp := jsonb_build_object(
      'ok', true,
      'data', public.phase42_club_canonical(v_club.id),
      'version', v_club.version,
      'skipped', true
    );
    perform public.phase42_idempotency_put(
      p_request_id, v_club.tenant_id, 'club_assign_vice_president', v_club.id, v_resp
    );
    return v_resp::json;
  end if;

  select count(*)::int into v_vp_count
  from public.club_governance_assignments
  where club_id = v_club.id and role_code = 'vice_president' and status = 'active';

  if v_vp_count >= 2 then
    return public.phase42_err('VALIDATION', 'Tối đa 2 Phó chủ tịch.');
  end if;

  insert into public.club_governance_assignments (
    tenant_id, club_id, club_member_id, role_code, status, version
  ) values (
    v_club.tenant_id, v_club.id, v_member.id, 'vice_president', 'active', 1
  );

  update public.clubs set version = version + 1 where id = v_club.id;

  perform public.phase42_write_audit(
    'club.assign_vice_president',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'vice_president_user_id', p_member_user_id
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'club_assign_vice_president', v_club.id, v_resp
  );
  return v_resp::json;
end;
$$;

grant execute on function public.club_assign_vice_president(uuid, text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. public.club_clear_vice_president — clear one VP or all (null user)
-- ---------------------------------------------------------------------
create or replace function public.club_clear_vice_president(
  p_request_id uuid,
  p_club_id text,
  p_expected_club_version integer,
  p_member_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
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

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_clear_vice_president');
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

  -- Security gate: never authorize via bare tenant-member helper.
  if not public.phase42_can_manage_vice_presidents(v_club.id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền gỡ Phó chủ tịch.');
  end if;

  if p_member_user_id is null then
    update public.club_governance_assignments
    set status = 'ended', effective_to = now(), version = version + 1
    where club_id = v_club.id
      and role_code = 'vice_president'
      and status = 'active';
  else
    select * into v_member
    from public.club_members
    where club_id = v_club.id and user_id = p_member_user_id;
    if not found then
      return public.phase42_err('NOT_FOUND', 'Không tìm thấy thành viên.');
    end if;

    update public.club_governance_assignments
    set status = 'ended', effective_to = now(), version = version + 1
    where club_id = v_club.id
      and club_member_id = v_member.id
      and role_code = 'vice_president'
      and status = 'active';
  end if;

  update public.clubs set version = version + 1 where id = v_club.id;

  perform public.phase42_write_audit(
    'club.clear_vice_president',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'vice_president_user_id', p_member_user_id,
      'clear_all', (p_member_user_id is null)
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'club_clear_vice_president', v_club.id, v_resp
  );
  return v_resp::json;
end;
$$;

grant execute on function public.club_clear_vice_president(uuid, text, integer, uuid) to authenticated;

-- =====================================================================
-- END — PHASE 1B (canonical VP hydrate + VP assign/clear RPCs)
-- Production deployment status: NOT APPLIED (Staging-ready only)
-- =====================================================================

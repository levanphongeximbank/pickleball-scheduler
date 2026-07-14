-- =============================================================================
-- PHASE 42N — Athlete ↔ club_members backfill + resolve RPCs
-- =============================================================================
-- Scope: Club Storage V2 SSOT for athlete profiles used by PlayerProfile / verify.
--
-- Model (confirmed against PHASE_42B + Production probe):
--   • One auth user → at most one public.athletes row (user_id).
--   • One athlete → many club_members (same athlete_id across clubs).
--   • profiles.club_id is NOT SSOT and is never written here.
--   • club_data_v3 is NOT created or updated here.
--
-- STOP: Do NOT run on Production until Owner QA on Preview + explicit approve.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) DRY-RUN (read-only) — run and save output before applying
-- ---------------------------------------------------------------------------
/*
select
  count(*) filter (where status = 'active' and athlete_id is null) as memberships_to_link,
  count(distinct user_id) filter (where status = 'active' and athlete_id is null) as distinct_users_to_link,
  (select count(*) from public.athletes) as athletes_before,
  (select count(*) from public.club_data_v3) as club_blobs_untouched
from public.club_members;

select cm.id, cm.club_id, c.name as club_name, cm.user_id, p.email, p.display_name, cm.athlete_id, cm.status
from public.club_members cm
join public.clubs c on c.id = cm.club_id
left join public.profiles p on p.id = cm.user_id
where cm.status = 'active' and cm.athlete_id is null
order by cm.joined_at;
*/

-- ---------------------------------------------------------------------------
-- 1) PRE-CHECK
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.athletes') is null then
    raise exception 'phase42n: public.athletes missing';
  end if;
  if to_regclass('public.club_members') is null then
    raise exception 'phase42n: public.club_members missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) UNIQUE: one linked athlete per auth user (nullable guests allowed many)
-- ---------------------------------------------------------------------------
create unique index if not exists athletes_user_uniq
  on public.athletes (user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Helper: ensure athlete for user (idempotent, race-safe)
-- ---------------------------------------------------------------------------
create or replace function public.phase42n_ensure_athlete_for_user(
  p_user_id uuid,
  p_tenant_id text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_name text;
  v_tenant text;
begin
  if p_user_id is null then
    raise exception 'phase42n_ensure_athlete_for_user: p_user_id required';
  end if;

  select a.id into v_athlete_id
  from public.athletes a
  where a.user_id = p_user_id
  order by a.created_at asc
  limit 1;

  if v_athlete_id is not null then
    return v_athlete_id;
  end if;

  v_tenant := nullif(trim(coalesce(p_tenant_id, '')), '');
  if v_tenant is null then
    select nullif(trim(coalesce(p.venue_id, '')), '') into v_tenant
    from public.profiles p
    where p.id = p_user_id;
  end if;
  if v_tenant is null then
    raise exception 'phase42n_ensure_athlete_for_user: missing tenant for user %', p_user_id;
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then
    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p.id::text)
      into v_name
    from public.profiles p
    where p.id = p_user_id;
  end if;
  if v_name is null then
    v_name := p_user_id::text;
  end if;

  begin
    insert into public.athletes (tenant_id, display_name, user_id, status, version)
    values (v_tenant, v_name, p_user_id, 'active', 1)
    returning id into v_athlete_id;
  exception
    when unique_violation then
      select a.id into v_athlete_id
      from public.athletes a
      where a.user_id = p_user_id
      order by a.created_at asc
      limit 1;
  end;

  return v_athlete_id;
end;
$$;

revoke all on function public.phase42n_ensure_athlete_for_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.phase42n_ensure_athlete_for_user(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4) BACKFILL TRANSACTION
-- ---------------------------------------------------------------------------
begin;

with targets as (
  select
    cm.id as membership_id,
    cm.user_id,
    cm.tenant_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), cm.user_id::text) as display_name
  from public.club_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.status = 'active'
    and cm.athlete_id is null
),
ensured as (
  select
    t.membership_id,
    public.phase42n_ensure_athlete_for_user(t.user_id, t.tenant_id, t.display_name) as athlete_id
  from targets t
)
update public.club_members cm
set athlete_id = e.athlete_id,
    updated_at = now(),
    version = cm.version + 1
from ensured e
where cm.id = e.membership_id
  and cm.athlete_id is null;

commit;

-- ---------------------------------------------------------------------------
-- 5) POST-CHECK
-- ---------------------------------------------------------------------------
/*
select
  count(*) filter (where status = 'active' and athlete_id is null) as remaining_null_athlete,
  count(*) filter (where status = 'active' and athlete_id is not null) as active_with_athlete,
  (select count(*) from public.athletes) as athletes_after,
  (select count(distinct user_id) from public.athletes where user_id is not null) as athletes_with_user
from public.club_members;

-- Expect remaining_null_athlete = 0 for previously active rows.
*/

-- ---------------------------------------------------------------------------
-- 6) Patch club_review_membership_request — ensure athlete on future approve
-- ---------------------------------------------------------------------------
create or replace function public.club_review_membership_request(
  p_request_id uuid,
  p_membership_request_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expected_version integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_membership_requests_v42%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_member_id uuid;
  v_athlete_id uuid;
  v_resp json;
  v_display_name text;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if v_decision not in ('approved', 'rejected') then
    return public.phase42_err('VALIDATION', 'decision phải là approved hoặc rejected.');
  end if;

  select * into v_row
  from public.club_membership_requests_v42
  where id = p_membership_request_id
  for update;

  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.');
  end if;

  if not public.phase42_has_gov_role(v_row.club_id, array['club_owner','president','vice_president'])
     and not public.phase42_is_platform_super_admin() then
    return public.phase42_err('FORBIDDEN', 'Không có quyền duyệt yêu cầu.');
  end if;

  if v_row.status <> 'pending' then
    return public.phase42_err('CONFLICT', 'Yêu cầu không còn ở trạng thái pending.');
  end if;

  if p_expected_version is not null and v_row.version is distinct from p_expected_version then
    return public.phase42_err('VERSION_CONFLICT', 'Phiên bản yêu cầu đã thay đổi.');
  end if;

  update public.club_membership_requests_v42
  set status = v_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      version = version + 1,
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  if v_decision = 'approved' then
    select id, athlete_id into v_member_id, v_athlete_id
    from public.club_members
    where club_id = v_row.club_id
      and user_id = v_row.user_id
      and status = 'active';

    if v_member_id is null then
      select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        into v_display_name
      from public.profiles p
      where p.id = v_row.user_id;

      v_athlete_id := public.phase42n_ensure_athlete_for_user(
        v_row.user_id,
        v_row.tenant_id,
        v_display_name
      );

      insert into public.club_members (
        tenant_id, club_id, user_id, athlete_id, membership_type, status, version
      )
      values (
        v_row.tenant_id, v_row.club_id, v_row.user_id, v_athlete_id, 'regular', 'active', 1
      )
      returning id into v_member_id;
    elsif v_athlete_id is null then
      select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        into v_display_name
      from public.profiles p
      where p.id = v_row.user_id;

      v_athlete_id := public.phase42n_ensure_athlete_for_user(
        v_row.user_id,
        v_row.tenant_id,
        v_display_name
      );

      update public.club_members
      set athlete_id = v_athlete_id,
          updated_at = now(),
          version = version + 1
      where id = v_member_id;
    end if;
  end if;

  perform public.phase42_write_audit(
    'club.membership_request.review',
    'club_membership_request',
    v_row.id::text,
    v_row.tenant_id,
    v_row.club_id,
    jsonb_build_object(
      'decision', v_decision,
      'request_id', p_request_id,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_row.id,
      'club_id', v_row.club_id,
      'user_id', v_row.user_id,
      'status', v_decision,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    ),
    'version', v_row.version
  );

  perform public.phase42_idempotency_put(
    p_request_id,
    v_row.tenant_id,
    'club_review_membership_request',
    v_row.id::text,
    v_resp
  );

  return v_resp::json;
end;
$$;

grant execute on function public.club_review_membership_request(uuid, uuid, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Resolve RPC for PlayerProfile / platform admin
-- ---------------------------------------------------------------------------
create or replace function public.platform_resolve_athlete_profile(p_auth_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := p_auth_user_id;
  v_profile jsonb;
  v_athlete jsonb;
  v_memberships jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if v_uid is null then
    return public.phase42_err('VALIDATION', 'Thiếu auth user id.');
  end if;

  if not (
    public.phase42_is_platform_super_admin()
    or auth.uid() = v_uid
  ) then
    -- Club governors may resolve members of their clubs
    if not exists (
      select 1
      from public.club_members target
      join public.club_members self
        on self.club_id = target.club_id
       and self.user_id = auth.uid()
       and self.status = 'active'
      where target.user_id = v_uid
        and target.status = 'active'
        and (
          public.phase42_has_gov_role(target.club_id, array['club_owner','president','vice_president'])
          or public.phase42_is_platform_super_admin()
        )
    ) then
      return public.phase42_err('FORBIDDEN', 'Không có quyền xem hồ sơ VĐV này.');
    end if;
  end if;

  select to_jsonb(p) - 'must_change_password' into v_profile
  from public.profiles p
  where p.id = v_uid;

  if v_profile is null then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy tài khoản.');
  end if;

  select to_jsonb(a) into v_athlete
  from public.athletes a
  where a.user_id = v_uid
  order by a.created_at asc
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'membership_id', cm.id,
      'club_id', cm.club_id,
      'club_name', c.name,
      'tenant_id', cm.tenant_id,
      'athlete_id', cm.athlete_id,
      'status', cm.status,
      'membership_type', cm.membership_type,
      'joined_at', cm.joined_at
    )
    order by cm.joined_at nulls last, cm.created_at
  ), '[]'::jsonb)
  into v_memberships
  from public.club_members cm
  join public.clubs c on c.id = cm.club_id and c.deleted_at is null
  where cm.user_id = v_uid
    and cm.status = 'active';

  return json_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'auth_user_id', v_uid,
      'profile', v_profile,
      'athlete', v_athlete,
      'active_memberships', v_memberships,
      'is_account_only', (v_memberships = '[]'::jsonb and v_athlete is null)
    )
  );
end;
$$;

grant execute on function public.platform_resolve_athlete_profile(uuid) to authenticated;

-- Include athlete_id in club_list_members payload (compat additive)
create or replace function public.club_list_members(p_club_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club public.clubs%rowtype;
  v_rows jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  select * into v_club from public.clubs where id = trim(coalesce(p_club_id, '')) and deleted_at is null;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  if not (
    public.phase42_is_platform_super_admin()
    or public.phase42_is_tenant_member(v_club.tenant_id)
    or public.phase42_active_club_member_id(v_club.id) is not null
  ) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền xem thành viên.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cm.id,
    'user_id', cm.user_id,
    'athlete_id', cm.athlete_id,
    'display_name', coalesce(p.display_name, p.email, cm.user_id::text),
    'email', p.email,
    'status', cm.status,
    'membership_type', cm.membership_type,
    'governance_roles', coalesce((
      select jsonb_agg(g.role_code)
      from public.club_governance_assignments g
      where g.club_member_id = cm.id and g.status = 'active'
    ), '[]'::jsonb),
    'version', cm.version
  ) order by coalesce(p.display_name, p.email)), '[]'::jsonb)
  into v_rows
  from public.club_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.club_id = v_club.id;

  return json_build_object('ok', true, 'data', v_rows, 'version', v_club.version);
end;
$$;

grant execute on function public.club_list_members(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) ROLLBACK PLAN (manual — do not run unless reverting 42N)
-- ---------------------------------------------------------------------------
/*
-- Clears only links created for active members; does NOT delete auth/profiles.
begin;
update public.club_members
set athlete_id = null,
    updated_at = now()
where status = 'active'
  and athlete_id is not null
  and user_id in (
    select user_id from public.athletes where user_id is not null
  );
-- Optionally delete athletes that have no remaining membership references:
delete from public.athletes a
where a.user_id is not null
  and not exists (
    select 1 from public.club_members cm where cm.athlete_id = a.id
  );
drop function if exists public.platform_resolve_athlete_profile(uuid);
-- Restore prior club_review_membership_request / club_list_members from PHASE_42I / 42C backups if needed.
commit;
*/

-- Phase 42G — club_create: athlete + club.create → member + owner (+ president)
-- Single SECURITY DEFINER RPC; one DB transaction; rollback on any error.
-- Does NOT change platform role (PLAYER stays PLAYER). Does NOT write profiles.club_id.
-- Owner scope = club governance only (not platform/tenant admin).

-- ---------------------------------------------------------------------------
-- 1) Permission: athlete (PLAYER) may create club when granted club.create
-- ---------------------------------------------------------------------------
insert into public.permissions (id, module, action, description)
select 'club.create', 'club', 'create', 'Tạo câu lạc bộ trong tenant'
where not exists (select 1 from public.permissions p where p.id = 'club.create');

insert into public.role_permissions (role_id, permission_id)
select 'PLAYER', 'club.create'
where exists (select 1 from public.permissions p where p.id = 'club.create')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = 'PLAYER' and rp.permission_id = 'club.create'
  );

insert into public.role_permissions (role_id, permission_id)
select 'CLUB_MANAGER', 'club.create'
where exists (select 1 from public.roles r where r.id = 'CLUB_MANAGER')
  and exists (select 1 from public.permissions p where p.id = 'club.create')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = 'CLUB_MANAGER' and rp.permission_id = 'club.create'
  );

-- ---------------------------------------------------------------------------
-- 2) Duplicate name per tenant (code uniq already in 42B)
-- ---------------------------------------------------------------------------
create unique index if not exists clubs_tenant_name_uniq
  on public.clubs (tenant_id, lower(name))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3) Governance must reference active club_member same tenant + club
-- ---------------------------------------------------------------------------
create or replace function public.phase42_enforce_gov_active_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    if not exists (
      select 1
      from public.club_members cm
      where cm.id = new.club_member_id
        and cm.tenant_id = new.tenant_id
        and cm.club_id = new.club_id
        and cm.status = 'active'
    ) then
      raise exception 'GOV_MEMBER_MISMATCH: governance assignment must reference active club_member in same tenant and club'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_phase42_gov_active_member on public.club_governance_assignments;
create trigger trg_phase42_gov_active_member
  before insert or update of club_member_id, tenant_id, club_id, status
  on public.club_governance_assignments
  for each row
  execute function public.phase42_enforce_gov_active_member();

-- ---------------------------------------------------------------------------
-- 4) Helpers: plan limit + create eligibility
-- ---------------------------------------------------------------------------
create or replace function public.phase42_check_club_plan_limit(p_tenant_id text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max int;
  v_count int;
begin
  if to_regclass('public.plan_limits') is null
     or to_regclass('public.tenant_subscriptions') is null then
    return json_build_object('ok', true);
  end if;

  select pl.max_clubs into v_max
  from public.tenant_subscriptions ts
  join public.plan_limits pl on pl.plan_id = ts.plan_id
  where ts.tenant_id = p_tenant_id
    and ts.status in ('trialing', 'active', 'past_due')
  order by ts.updated_at desc nulls last
  limit 1;

  if v_max is null then
    return json_build_object('ok', true);
  end if;

  select count(*)::int into v_count
  from public.clubs c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and c.status in ('pending_setup', 'pending_approval', 'active');

  if v_count >= v_max then
    return public.phase42_err(
      'PLAN_CLUB_LIMIT',
      format('Gói hiện tại cho phép tối đa %s CLB.', v_max)
    );
  end if;

  return json_build_object('ok', true, 'max_clubs', v_max, 'current', v_count);
end;
$$;

create or replace function public.phase42_can_create_in_tenant(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.phase42_is_platform_super_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role, '')) in ('PLAYER', 'CLUB_MANAGER')
        and public.user_has_permission('club.create')
    );
$$;

-- Default product config: creator also becomes president
create or replace function public.phase42_creator_gets_president()
returns boolean
language sql
immutable
as $$
  select true;
$$;

-- ---------------------------------------------------------------------------
-- 5) club_create — single transactional RPC
-- ---------------------------------------------------------------------------
create or replace function public.club_create(
  p_request_id uuid,
  p_tenant_id text,
  p_name text,
  p_code text default null,
  p_description text default '',
  p_registered_cluster_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_tenant text := trim(coalesce(p_tenant_id, ''));
  v_cluster text := nullif(trim(coalesce(p_registered_cluster_id, '')), '');
  v_club_id text;
  v_member_id uuid;
  v_resp jsonb;
  v_limit json;
  v_is_sa boolean := public.phase42_is_platform_super_admin();
  v_assign_president boolean := public.phase42_creator_gets_president();
  v_platform_role text;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_create');
  if v_cached is not null then
    return v_cached::json;
  end if;

  if v_tenant = '' or not exists (select 1 from public.venues v where v.id = v_tenant) then
    return public.phase42_err('TENANT_NOT_FOUND', 'Không tìm thấy tenant/venue.');
  end if;

  if not public.phase42_can_create_in_tenant(v_tenant) then
    return public.phase42_err('TENANT_FORBIDDEN', 'Không có quyền tạo CLB trong tenant này.');
  end if;

  if not v_is_sa and not public.user_has_permission('club.create') then
    return public.phase42_err('FORBIDDEN', 'Thiếu permission club.create.');
  end if;

  v_limit := public.phase42_check_club_plan_limit(v_tenant);
  if coalesce((v_limit->>'ok')::boolean, false) is not true then
    return v_limit;
  end if;

  if v_name = '' then
    return public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  end if;

  if exists (
    select 1 from public.clubs c
    where c.tenant_id = v_tenant
      and c.deleted_at is null
      and lower(c.name) = lower(v_name)
  ) then
    return public.phase42_err('DUPLICATE_NAME', 'Tên CLB đã tồn tại trong tenant này.');
  end if;

  if v_code is not null and exists (
    select 1 from public.clubs c
    where c.tenant_id = v_tenant
      and c.deleted_at is null
      and c.code = v_code
  ) then
    return public.phase42_err('DUPLICATE_CODE', 'Mã CLB đã tồn tại trong tenant này.');
  end if;

  select upper(coalesce(role, '')) into v_platform_role
  from public.profiles where id = auth.uid();

  v_club_id := 'club-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.clubs (
    id, tenant_id, name, code, description, status,
    registered_cluster_id, created_by_user_id, version
  ) values (
    v_club_id, v_tenant, v_name, v_code, coalesce(p_description, ''),
    'active', v_cluster, auth.uid(), 1
  );

  -- Super Admin must NOT auto-become member/owner/president.
  -- Non-SA creator (incl. athlete/PLAYER): active member + club_owner (+ president by default).
  -- Platform role on profiles is NEVER changed here.
  if not v_is_sa then
    insert into public.club_members (
      tenant_id, club_id, user_id, membership_type, status, version
    ) values (
      v_tenant, v_club_id, auth.uid(), 'regular', 'active', 1
    )
    returning id into v_member_id;

    insert into public.club_governance_assignments (
      tenant_id, club_id, club_member_id, role_code, status, version
    ) values (
      v_tenant, v_club_id, v_member_id, 'club_owner', 'active', 1
    );

    if v_assign_president then
      insert into public.club_governance_assignments (
        tenant_id, club_id, club_member_id, role_code, status, version
      ) values (
        v_tenant, v_club_id, v_member_id, 'president', 'active', 1
      );
    end if;
  end if;

  -- Explicit: never write profiles.club_id / never elevate platform role
  perform public.phase42_write_audit(
    'club.create',
    'club',
    v_club_id,
    v_tenant,
    v_club_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'super_admin_no_member', v_is_sa,
      'creator_member_id', v_member_id,
      'assigned_owner', not v_is_sa,
      'assigned_president', (not v_is_sa and v_assign_president),
      'platform_role_unchanged', v_platform_role,
      'owner_scope', 'club_only'
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club_id),
    'version', 1
  );

  perform public.phase42_idempotency_put(p_request_id, v_tenant, 'club_create', v_name, v_resp);
  return v_resp::json;

exception
  when unique_violation then
    return public.phase42_err('DUPLICATE_CLUB', 'CLB trùng tên hoặc mã trong tenant.');
  when raise_exception then
    return public.phase42_err('CREATE_FAILED', sqlerrm);
  when others then
    return public.phase42_err('CREATE_FAILED', coalesce(sqlerrm, 'Không tạo được CLB.'));
end;
$$;

grant execute on function public.club_create(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.phase42_check_club_plan_limit(text) to authenticated;
grant execute on function public.phase42_can_create_in_tenant(text) to authenticated;

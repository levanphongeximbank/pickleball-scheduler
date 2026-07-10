-- Phase 42C — RLS + helper + core club RPCs (Staging)
-- Writes only via SECURITY DEFINER RPCs. SELECT under RLS.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.phase42_err(p_code text, p_error text)
returns json
language sql
immutable
as $$
  select json_build_object('ok', false, 'code', p_code, 'error', p_error);
$$;

create or replace function public.phase42_is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_super_admin(), false);
$$;

create or replace function public.phase42_is_tenant_member(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  )
  or public.phase42_is_platform_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.venue_id = p_tenant_id
      and upper(coalesce(p.role, '')) in (
        'VENUE_OWNER', 'COURT_OWNER', 'VENUE_MANAGER', 'COURT_MANAGER', 'TENANT_OWNER'
      )
  );
$$;

create or replace function public.phase42_active_club_member_id(p_club_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
  limit 1;
$$;

create or replace function public.phase42_has_gov_role(p_club_id text, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_governance_assignments g
    join public.club_members cm on cm.id = g.club_member_id
    where g.club_id = p_club_id
      and g.status = 'active'
      and g.role_code = any (p_roles)
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  )
  or public.phase42_is_platform_super_admin();
$$;

create or replace function public.phase42_write_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_tenant_id text,
  p_club_id text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (
    actor_id, actor_email, action, resource_type, resource_id, venue_id, club_id, metadata
  ) values (
    auth.uid(), v_email, p_action, p_resource_type, p_resource_id, p_tenant_id, p_club_id, coalesce(p_metadata, '{}'::jsonb)
  );
exception when others then
  -- audit must not block mutation in staging bootstrap
  null;
end;
$$;

create or replace function public.phase42_idempotency_get(
  p_request_id uuid,
  p_rpc_name text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select response_json
  from public.idempotency_requests
  where actor_user_id = auth.uid()
    and request_id = p_request_id
    and rpc_name = p_rpc_name
  limit 1;
$$;

create or replace function public.phase42_idempotency_put(
  p_request_id uuid,
  p_tenant_id text,
  p_rpc_name text,
  p_request_hash text,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.idempotency_requests (
    request_id, tenant_id, actor_user_id, rpc_name, request_hash, response_json
  ) values (
    p_request_id, p_tenant_id, auth.uid(), p_rpc_name, coalesce(p_request_hash, ''), p_response
  )
  on conflict (actor_user_id, request_id) do nothing;
end;
$$;

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
    'active_member_count', v_member_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenant_members enable row level security;
alter table public.clubs enable row level security;
alter table public.athletes enable row level security;
alter table public.club_members enable row level security;
alter table public.club_governance_assignments enable row level security;
alter table public.club_membership_requests_v42 enable row level security;
alter table public.idempotency_requests enable row level security;

drop policy if exists tenant_members_select on public.tenant_members;
create policy tenant_members_select on public.tenant_members
  for select to authenticated
  using (
    public.phase42_is_platform_super_admin()
    or user_id = auth.uid()
    or public.phase42_is_tenant_member(tenant_id)
  );

drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.phase42_is_platform_super_admin()
      or public.phase42_is_tenant_member(tenant_id)
      or status = 'active'
      or exists (
        select 1 from public.club_members cm
        where cm.club_id = clubs.id and cm.user_id = auth.uid() and cm.status = 'active'
      )
    )
  );

drop policy if exists athletes_select on public.athletes;
create policy athletes_select on public.athletes
  for select to authenticated
  using (
    public.phase42_is_platform_super_admin()
    or user_id = auth.uid()
    or public.phase42_is_tenant_member(tenant_id)
  );

drop policy if exists club_members_select on public.club_members;
create policy club_members_select on public.club_members
  for select to authenticated
  using (
    public.phase42_is_platform_super_admin()
    or user_id = auth.uid()
    or public.phase42_is_tenant_member(tenant_id)
    or exists (
      select 1 from public.club_members self
      where self.club_id = club_members.club_id
        and self.user_id = auth.uid()
        and self.status = 'active'
    )
  );

drop policy if exists club_gov_select on public.club_governance_assignments;
create policy club_gov_select on public.club_governance_assignments
  for select to authenticated
  using (
    public.phase42_is_platform_super_admin()
    or public.phase42_is_tenant_member(tenant_id)
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = club_governance_assignments.club_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists club_req_v42_select on public.club_membership_requests_v42;
create policy club_req_v42_select on public.club_membership_requests_v42
  for select to authenticated
  using (
    public.phase42_is_platform_super_admin()
    or user_id = auth.uid()
    or public.phase42_has_gov_role(club_id, array['club_owner','president','vice_president'])
  );

drop policy if exists idempotency_select on public.idempotency_requests;
create policy idempotency_select on public.idempotency_requests
  for select to authenticated
  using (actor_user_id = auth.uid() or public.phase42_is_platform_super_admin());

-- No direct INSERT/UPDATE/DELETE policies for authenticated on business tables.
revoke insert, update, delete on public.tenant_members from authenticated, anon;
revoke insert, update, delete on public.clubs from authenticated, anon;
revoke insert, update, delete on public.athletes from authenticated, anon;
revoke insert, update, delete on public.club_members from authenticated, anon;
revoke insert, update, delete on public.club_governance_assignments from authenticated, anon;
revoke insert, update, delete on public.club_membership_requests_v42 from authenticated, anon;
revoke insert, update, delete on public.idempotency_requests from authenticated, anon;

grant select on public.tenant_members to authenticated;
grant select on public.clubs to authenticated;
grant select on public.athletes to authenticated;
grant select on public.club_members to authenticated;
grant select on public.club_governance_assignments to authenticated;
grant select on public.club_membership_requests_v42 to authenticated;
grant select on public.idempotency_requests to authenticated;

-- ---------------------------------------------------------------------------
-- club_create
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
  v_tenant text := trim(coalesce(p_tenant_id, ''));
  v_club_id text;
  v_member_id uuid;
  v_resp jsonb;
  v_is_sa boolean := public.phase42_is_platform_super_admin();
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

  if not public.phase42_is_tenant_member(v_tenant) and not v_is_sa then
    -- allow self-register path: any authenticated user may create in a known tenant for staging
    -- still require venue exists; tighten later with product policy
    null;
  end if;

  if v_name = '' then
    return public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  end if;

  v_club_id := 'club-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.clubs (
    id, tenant_id, name, code, description, status, registered_cluster_id, created_by_user_id, version
  ) values (
    v_club_id, v_tenant, v_name, nullif(trim(coalesce(p_code, '')), ''), coalesce(p_description, ''),
    'active', nullif(trim(coalesce(p_registered_cluster_id, '')), ''), auth.uid(), 1
  );

  -- Super Admin must NOT auto-become member/president
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
      v_tenant, v_club_id, v_member_id, 'president', 'active', 1
    );
  end if;

  perform public.phase42_write_audit(
    'club.create', 'club', v_club_id, v_tenant, v_club_id,
    jsonb_build_object('request_id', p_request_id, 'super_admin_no_member', v_is_sa)
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club_id),
    'version', 1
  );

  perform public.phase42_idempotency_put(p_request_id, v_tenant, 'club_create', v_name, v_resp);
  return v_resp::json;
end;
$$;

grant execute on function public.club_create(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- club_get / list
-- ---------------------------------------------------------------------------
create or replace function public.club_get(p_club_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  v_data := public.phase42_club_canonical(trim(coalesce(p_club_id, '')));
  if v_data is null then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;
  return json_build_object('ok', true, 'data', v_data, 'version', v_data->>'version');
end;
$$;

grant execute on function public.club_get(text) to authenticated;

create or replace function public.club_list_registry(
  p_tenant_id text default null,
  p_include_inactive boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  select coalesce(jsonb_agg(public.phase42_club_canonical(c.id) order by c.name), '[]'::jsonb)
    into v_rows
  from public.clubs c
  where c.deleted_at is null
    and (p_tenant_id is null or c.tenant_id = p_tenant_id)
    and (p_include_inactive or c.status = 'active')
    and (
      public.phase42_is_platform_super_admin()
      or public.phase42_is_tenant_member(c.tenant_id)
    );

  return json_build_object('ok', true, 'data', v_rows);
end;
$$;

grant execute on function public.club_list_registry(text, boolean) to authenticated;

create or replace function public.club_list_discoverable(
  p_search text default '',
  p_limit int default 100
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_q text := lower(trim(coalesce(p_search, '')));
  v_rows jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  select coalesce(jsonb_agg(x.payload), '[]'::jsonb)
    into v_rows
  from (
    select public.phase42_club_canonical(c.id) as payload
    from public.clubs c
    where c.deleted_at is null
      and c.status = 'active'
      and (v_q = '' or lower(c.name) like '%' || v_q || '%' or lower(coalesce(c.code, '')) like '%' || v_q || '%')
    order by c.name
    limit v_limit
  ) x;

  return json_build_object('ok', true, 'data', v_rows);
end;
$$;

grant execute on function public.club_list_discoverable(text, int) to authenticated;

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
    'display_name', coalesce(p.display_name, p.email, cm.user_id::text),
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

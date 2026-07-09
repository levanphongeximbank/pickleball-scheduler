-- Phase 38 — Club registry cloud sync (discover + admin list + upsert)
-- Chạy SAU: supabase-club-governance-v52.sql, PHASE_31_CLUB_MEMBERSHIP_REQUESTS.sql
-- Production: expuvcohlcjzvrrauvud

alter table public.club_governance
  add column if not exists name text not null default '',
  add column if not exists code text,
  add column if not exists description text not null default '',
  add column if not exists registered_cluster_id text;

create index if not exists club_governance_name_idx
  on public.club_governance (name);

create or replace function public.can_upsert_club_registry(p_venue_id text, p_president_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or p_president_user_id = auth.uid()
    or (
      p_venue_id = public.user_venue_id()
      and public.user_role() in (
        'SUPER_ADMIN',
        'PLATFORM_ADMIN',
        'SYSTEM_TECHNICIAN',
        'VENUE_OWNER',
        'COURT_OWNER',
        'TENANT_OWNER'
      )
    );
$$;

create or replace function public.club_upsert_registry(p_club json)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id text;
  v_venue_id text;
  v_name text;
  v_code text;
  v_description text;
  v_status text;
  v_owner_user_id uuid;
  v_president_user_id uuid;
  v_vice_president_user_id uuid;
  v_registered_cluster_id text;
  v_registered_court_ids jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_club_id := trim(coalesce(p_club ->> 'club_id', p_club ->> 'clubId', p_club ->> 'id', ''));
  v_venue_id := trim(coalesce(p_club ->> 'venue_id', p_club ->> 'venueId', ''));
  v_name := trim(coalesce(p_club ->> 'name', ''));
  v_code := nullif(trim(coalesce(p_club ->> 'code', '')), '');
  v_description := trim(coalesce(p_club ->> 'description', ''));
  v_status := lower(trim(coalesce(p_club ->> 'status', 'active')));
  v_registered_cluster_id := nullif(
    trim(coalesce(p_club ->> 'registered_cluster_id', p_club ->> 'registeredClusterId', '')),
    ''
  );

  v_owner_user_id := nullif(trim(coalesce(p_club ->> 'owner_user_id', p_club ->> 'ownerUserId', '')), '')::uuid;
  v_president_user_id := nullif(
    trim(coalesce(p_club ->> 'president_user_id', p_club ->> 'presidentUserId', '')),
    ''
  )::uuid;
  v_vice_president_user_id := nullif(
    trim(coalesce(p_club ->> 'vice_president_user_id', p_club ->> 'vicePresidentUserId', '')),
    ''
  )::uuid;

  v_registered_court_ids := coalesce(
    p_club -> 'registered_court_ids',
    p_club -> 'registeredCourtIds',
    '[]'::jsonb
  );
  if jsonb_typeof(v_registered_court_ids) <> 'array' then
    v_registered_court_ids := '[]'::jsonb;
  end if;

  if v_club_id = '' then
    return json_build_object('ok', false, 'code', 'CLUB_ID_REQUIRED', 'error', 'Thiếu club_id.');
  end if;

  if v_venue_id = '' then
    return json_build_object('ok', false, 'code', 'VENUE_ID_REQUIRED', 'error', 'Thiếu venue_id.');
  end if;

  if v_name = '' then
    return json_build_object('ok', false, 'code', 'NAME_REQUIRED', 'error', 'Thiếu tên CLB.');
  end if;

  if v_president_user_id is null then
    return json_build_object('ok', false, 'code', 'PRESIDENT_REQUIRED', 'error', 'Thiếu president_user_id.');
  end if;

  if v_status not in ('pending_setup', 'pending_approval', 'active', 'inactive') then
    v_status := 'active';
  end if;

  if not exists (select 1 from public.venues v where v.id = v_venue_id) then
    return json_build_object(
      'ok', false,
      'code', 'VENUE_NOT_FOUND',
      'error', 'Không tìm thấy tổ chức: ' || v_venue_id
    );
  end if;

  if not public.can_upsert_club_registry(v_venue_id, v_president_user_id) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.club_governance (
    club_id,
    venue_id,
    name,
    code,
    description,
    owner_user_id,
    president_user_id,
    vice_president_user_id,
    registered_cluster_id,
    registered_court_ids,
    status,
    updated_at
  )
  values (
    v_club_id,
    v_venue_id,
    v_name,
    v_code,
    v_description,
    v_owner_user_id,
    v_president_user_id,
    v_vice_president_user_id,
    v_registered_cluster_id,
    v_registered_court_ids,
    v_status,
    now()
  )
  on conflict (club_id) do update
  set
    venue_id = excluded.venue_id,
    name = excluded.name,
    code = excluded.code,
    description = excluded.description,
    owner_user_id = excluded.owner_user_id,
    president_user_id = excluded.president_user_id,
    vice_president_user_id = excluded.vice_president_user_id,
    registered_cluster_id = excluded.registered_cluster_id,
    registered_court_ids = excluded.registered_court_ids,
    status = excluded.status,
    updated_at = now();

  return json_build_object('ok', true, 'club_id', v_club_id, 'venue_id', v_venue_id);
end;
$$;

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
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      g.club_id,
      g.venue_id,
      g.name,
      g.code,
      g.description,
      g.status,
      g.owner_user_id,
      g.president_user_id,
      g.vice_president_user_id,
      g.registered_cluster_id,
      g.registered_court_ids,
      coalesce(v.name, g.venue_id) as venue_name,
      g.updated_at
    from public.club_governance g
    left join public.venues v on v.id = g.venue_id
    where g.status = 'active'
      and coalesce(g.name, '') <> ''
      and (
        coalesce(p_search, '') = ''
        or g.name ilike '%' || p_search || '%'
        or coalesce(g.code, '') ilike '%' || p_search || '%'
        or coalesce(v.name, '') ilike '%' || p_search || '%'
      )
    order by g.name asc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'clubs', coalesce(v_rows, '[]'::json));
end;
$$;

create or replace function public.club_list_registry(
  p_venue_id text default null,
  p_include_inactive boolean default false,
  p_limit int default 200
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_venue_id text := nullif(trim(coalesce(p_venue_id, '')), '');
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.is_super_admin()
    and public.user_role() not in ('PLATFORM_ADMIN', 'SYSTEM_TECHNICIAN')
    and v_venue_id is null then
    v_venue_id := public.user_venue_id();
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      g.club_id,
      g.venue_id,
      g.name,
      g.code,
      g.description,
      g.status,
      g.owner_user_id,
      g.president_user_id,
      g.vice_president_user_id,
      g.registered_cluster_id,
      g.registered_court_ids,
      coalesce(v.name, g.venue_id) as venue_name,
      g.updated_at
    from public.club_governance g
    left join public.venues v on v.id = g.venue_id
    where (v_venue_id is null or g.venue_id = v_venue_id)
      and (
        p_include_inactive
        or g.status in ('active', 'pending_setup', 'pending_approval')
      )
    order by g.name asc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'clubs', coalesce(v_rows, '[]'::json));
end;
$$;

grant execute on function public.club_upsert_registry(json) to authenticated;
grant execute on function public.club_list_discoverable(text, int) to authenticated;
grant execute on function public.club_list_registry(text, boolean, int) to authenticated;

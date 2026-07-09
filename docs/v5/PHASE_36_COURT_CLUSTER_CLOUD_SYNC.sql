-- Phase 36 — Court cluster cloud sync (admin upsert + remove owner)
-- Chạy SAU: PHASE_35_ADMIN_ASSIGN_CLUSTER_OWNER.sql
-- Production: expuvcohlcjzvrrauvud

create or replace function public.court_admin_upsert_cluster(p_cluster json)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_venue_id text;
  v_name text;
  v_slug text;
  v_status text;
  v_address text;
  v_google_maps_url text;
  v_court_count int;
  v_existing_slug text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_court_claim() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_id := trim(coalesce(p_cluster ->> 'id', ''));
  v_venue_id := trim(coalesce(p_cluster ->> 'venue_id', p_cluster ->> 'venueId', ''));
  v_name := trim(coalesce(p_cluster ->> 'name', ''));
  v_slug := trim(coalesce(p_cluster ->> 'slug', ''));
  v_status := lower(trim(coalesce(p_cluster ->> 'status', 'active')));
  v_address := trim(coalesce(p_cluster ->> 'address', ''));
  v_google_maps_url := trim(coalesce(p_cluster ->> 'google_maps_url', p_cluster ->> 'googleMapsUrl', ''));
  v_court_count := coalesce((p_cluster ->> 'court_count')::int, (p_cluster ->> 'courtCount')::int, 0);

  if v_id = '' then
    return json_build_object('ok', false, 'code', 'CLUSTER_ID_REQUIRED', 'error', 'Thiếu id cụm sân.');
  end if;

  if v_venue_id = '' then
    return json_build_object('ok', false, 'code', 'VENUE_ID_REQUIRED', 'error', 'Thiếu venue_id.');
  end if;

  if v_name = '' then
    return json_build_object('ok', false, 'code', 'NAME_REQUIRED', 'error', 'Thiếu tên cụm sân.');
  end if;

  if v_slug = '' then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'main';
    end if;
  end if;

  if v_status not in ('active', 'inactive') then
    v_status := 'active';
  end if;

  if not exists (select 1 from public.venues v where v.id = v_venue_id) then
    return json_build_object(
      'ok', false,
      'code', 'VENUE_NOT_FOUND',
      'error', 'Không tìm thấy tổ chức: ' || v_venue_id
    );
  end if;

  select c.slug into v_existing_slug
  from public.court_clusters c
  where c.venue_id = v_venue_id
    and c.slug = v_slug
    and c.id <> v_id
  limit 1;

  if found then
    return json_build_object(
      'ok', false,
      'code', 'SLUG_EXISTS',
      'error', 'Slug cụm sân đã tồn tại trong tổ chức này.'
    );
  end if;

  insert into public.court_clusters (
    id,
    venue_id,
    name,
    slug,
    status,
    court_count,
    address,
    google_maps_url,
    updated_at
  )
  values (
    v_id,
    v_venue_id,
    v_name,
    v_slug,
    v_status,
    greatest(v_court_count, 0),
    nullif(v_address, ''),
    nullif(v_google_maps_url, ''),
    now()
  )
  on conflict (id) do update set
    venue_id = excluded.venue_id,
    name = excluded.name,
    slug = excluded.slug,
    status = excluded.status,
    court_count = excluded.court_count,
    address = excluded.address,
    google_maps_url = excluded.google_maps_url,
    updated_at = now();

  return json_build_object(
    'ok', true,
    'cluster', json_build_object(
      'id', v_id,
      'venue_id', v_venue_id,
      'name', v_name,
      'slug', v_slug,
      'status', v_status,
      'court_count', greatest(v_court_count, 0),
      'address', nullif(v_address, ''),
      'google_maps_url', nullif(v_google_maps_url, '')
    )
  );
exception
  when others then
    return json_build_object('ok', false, 'code', 'UPSERT_FAILED', 'error', sqlerrm);
end;
$$;

create or replace function public.court_admin_remove_cluster_owner(p_cluster_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cluster_id text := trim(coalesce(p_cluster_id, ''));
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_court_claim() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_cluster_id = '' then
    return json_build_object('ok', false, 'code', 'CLUSTER_ID_REQUIRED', 'error', 'Thiếu id cụm sân.');
  end if;

  if not exists (select 1 from public.court_clusters c where c.id = v_cluster_id) then
    return json_build_object(
      'ok', false,
      'code', 'CLUSTER_NOT_FOUND',
      'error', 'Không tìm thấy cụm: ' || v_cluster_id
    );
  end if;

  delete from public.user_cluster_assignments
  where cluster_id = v_cluster_id
    and role = 'CLUSTER_OWNER';

  update public.court_clusters
  set owner_user_id = null, updated_at = now()
  where id = v_cluster_id;

  return json_build_object('ok', true, 'clusterId', v_cluster_id);
exception
  when others then
    return json_build_object('ok', false, 'code', 'REMOVE_OWNER_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.court_admin_upsert_cluster(json) to authenticated;
grant execute on function public.court_admin_remove_cluster_owner(text) to authenticated;

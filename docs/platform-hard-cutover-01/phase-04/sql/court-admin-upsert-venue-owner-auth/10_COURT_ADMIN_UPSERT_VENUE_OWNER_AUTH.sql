-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Root cause: court_admin_upsert_cluster FORBIDDEN for venue owners because
-- can_review_court_claim() requires cluster.manage (platform roles only).
-- Fix: allow venue-scoped owners for their own venue_id without broadening claim-review.

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
  v_role text;
  v_role_norm text;
  v_actor_venue text;
  v_owner_like boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_id := trim(coalesce(p_cluster ->> 'id', ''));
  v_venue_id := trim(coalesce(p_cluster ->> 'venue_id', p_cluster ->> 'venueId', ''));
  v_name := trim(coalesce(p_cluster ->> 'name', ''));
  v_slug := trim(coalesce(p_cluster ->> 'slug', ''));
  v_status := lower(trim(coalesce(p_cluster ->> 'status', 'active')));
  v_address := trim(coalesce(p_cluster ->> 'address', ''));
  v_google_maps_url := trim(coalesce(p_cluster ->> 'google_maps_url', p_cluster ->> 'googleMapsUrl', ''));
  v_court_count := coalesce((p_cluster ->> 'court_count')::int, (p_cluster ->> 'courtCount')::int, 0);

  if not public.can_review_court_claim() then
    v_role := coalesce(public.user_role(), '');
    v_role_norm := coalesce(public.normalize_profile_role(v_role), '');
    v_actor_venue := coalesce(public.user_venue_id(), '');
    v_owner_like :=
      v_role_norm = 'COURT_OWNER'
      or v_role in ('COURT_OWNER', 'VENUE_OWNER', 'TENANT_OWNER');

    if not (
      v_owner_like
      and v_actor_venue <> ''
      and v_venue_id <> ''
      and v_actor_venue = v_venue_id
    ) then
      return json_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
  end if;

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

grant execute on function public.court_admin_upsert_cluster(json) to authenticated;

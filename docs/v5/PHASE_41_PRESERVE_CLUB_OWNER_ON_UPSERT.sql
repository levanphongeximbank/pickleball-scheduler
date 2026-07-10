-- Phase 41 — Không để máy local (owner null) ghi đè Chủ sở hữu đã gán trên cloud.
-- Khi upsert gửi owner_user_id / vice_president_user_id = null → giữ giá trị hiện có.

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
    (p_club -> 'registered_court_ids')::jsonb,
    (p_club -> 'registeredCourtIds')::jsonb,
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
    owner_user_id = coalesce(excluded.owner_user_id, public.club_governance.owner_user_id),
    president_user_id = excluded.president_user_id,
    vice_president_user_id = coalesce(
      excluded.vice_president_user_id,
      public.club_governance.vice_president_user_id
    ),
    registered_cluster_id = excluded.registered_cluster_id,
    registered_court_ids = excluded.registered_court_ids,
    status = excluded.status,
    updated_at = now();

  return json_build_object('ok', true, 'club_id', v_club_id, 'venue_id', v_venue_id);
end;
$$;

grant execute on function public.club_upsert_registry(json) to authenticated;

-- ============================================================================
-- TEAM-TOURNAMENT-STAGING-COURT-SEED-01 — 02_SEED.sql
-- STAGING ONLY — DO NOT APPLY without Owner GO after 01_PRECHECK.
-- Upserts exactly 2 deterministic courts into club_data_v3 for Format & Venue.
-- ============================================================================

begin;

do $$
declare
  v_club public.clubs%rowtype;
  v_blob jsonb;
  v_courts jsonb;
  v_seed_courts jsonb;
  v_marker text := 'QA|TT412|COURT-SEED-01';
begin
  select * into v_club
  from public.clubs
  where id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    and deleted_at is null
    and tenant_id = 'venue-staging-a';

  if not found then
    raise exception 'SEED_FAIL: target club/tenant missing';
  end if;

  v_seed_courts := jsonb_build_array(
    jsonb_build_object(
      'id', 'tt412-court-01',
      'name', 'TT412 Sân 1',
      'number', 1,
      'active', true,
      'status', 'active',
      'courtType', 'outdoor',
      'defaultHourlyRate', 0,
      'peakHourlyRate', 0,
      'note', v_marker,
      'clubId', 'club-ecebf64c78f948ccb2b59842441eb26c',
      'venueId', 'venue-staging-a',
      'tenantId', 'venue-staging-a'
    ),
    jsonb_build_object(
      'id', 'tt412-court-02',
      'name', 'TT412 Sân 2',
      'number', 2,
      'active', true,
      'status', 'active',
      'courtType', 'outdoor',
      'defaultHourlyRate', 0,
      'peakHourlyRate', 0,
      'note', v_marker,
      'clubId', 'club-ecebf64c78f948ccb2b59842441eb26c',
      'venueId', 'venue-staging-a',
      'tenantId', 'venue-staging-a'
    )
  );

  select data into v_blob
  from public.club_data_v3
  where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
  for update;

  if not found then
    v_blob := jsonb_build_object(
      'schemaVersion', 3.5,
      'clubId', 'club-ecebf64c78f948ccb2b59842441eb26c',
      'players', '[]'::jsonb,
      'courts', v_seed_courts,
      'bookings', '[]'::jsonb,
      'customers', '[]'::jsonb,
      'recurringSeries', '[]'::jsonb,
      'tournaments', '[]'::jsonb,
      'seasons', '[]'::jsonb,
      'leagues', '[]'::jsonb,
      'rounds', '[]'::jsonb,
      'sessions', '[]'::jsonb,
      'ai', jsonb_build_object(
        'history', '{}'::jsonb,
        'waiting', '{}'::jsonb,
        'policies', '[]'::jsonb,
        'rules', '[]'::jsonb
      ),
      'fixtureMarker', v_marker
    );

    insert into public.club_data_v3 (club_id, venue_id, version, synced_at, data)
    values (
      'club-ecebf64c78f948ccb2b59842441eb26c',
      'venue-staging-a',
      1,
      now(),
      v_blob
    );
  else
    select coalesce(
      (
        select jsonb_agg(court)
        from jsonb_array_elements(coalesce(v_blob->'courts', '[]'::jsonb)) court
        where court->>'id' not in ('tt412-court-01', 'tt412-court-02')
      ),
      '[]'::jsonb
    ) into v_courts;

    v_courts := v_courts || v_seed_courts;
    v_blob := jsonb_set(v_blob, '{courts}', v_courts, true);
    v_blob := jsonb_set(v_blob, '{fixtureMarker}', to_jsonb(v_marker), true);

    update public.club_data_v3
    set
      data = v_blob,
      venue_id = coalesce(venue_id, 'venue-staging-a'),
      synced_at = now(),
      version = coalesce(version, 0) + 1
    where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c';
  end if;

  if (
    select count(*)
    from public.club_data_v3 c
    cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
    where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
      and court->>'id' in ('tt412-court-01', 'tt412-court-02')
      and coalesce((court->>'active')::boolean, true) is not false
  ) <> 2 then
    raise exception 'SEED_FAIL: expected exactly 2 active seed courts';
  end if;

  raise notice 'SEED_OK marker=% courts=2', v_marker;
end $$;

commit;

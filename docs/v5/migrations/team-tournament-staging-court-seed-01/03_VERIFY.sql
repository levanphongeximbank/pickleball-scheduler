-- ============================================================================
-- TEAM-TOURNAMENT-STAGING-COURT-SEED-01 — 03_VERIFY.sql
-- ============================================================================

do $$
declare
  v_seed_count int;
  v_active_count int;
  v_wrong_club int;
  v_blob_venue text;
begin
  select count(*)::int into v_seed_count
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
  where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    and court->>'id' in ('tt412-court-01', 'tt412-court-02');

  select count(*)::int into v_active_count
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
  where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    and court->>'id' in ('tt412-court-01', 'tt412-court-02')
    and coalesce((court->>'active')::boolean, true) is not false
    and coalesce(court->>'status', 'active') = 'active';

  select count(*)::int into v_wrong_club
  from public.club_data_v3 c
  cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
  where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    and court->>'id' in ('tt412-court-01', 'tt412-court-02')
    and (
      coalesce(court->>'clubId', '') not in ('', 'club-ecebf64c78f948ccb2b59842441eb26c')
      or coalesce(court->>'tenantId', 'venue-staging-a') is distinct from 'venue-staging-a'
    );

  select venue_id into v_blob_venue
  from public.club_data_v3
  where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c';

  if v_seed_count <> 2 then
    raise exception 'VERIFY_FAIL: SEED_COURT_COUNT=%', v_seed_count;
  end if;
  if v_active_count <> 2 then
    raise exception 'VERIFY_FAIL: ACTIVE_SEED_COURT_COUNT=%', v_active_count;
  end if;
  if v_wrong_club <> 0 then
    raise exception 'VERIFY_FAIL: WRONG_CLUB_OR_TENANT_COUNT=%', v_wrong_club;
  end if;
  if v_blob_venue is distinct from 'venue-staging-a' then
    raise exception 'VERIFY_FAIL: blob venue_id=%', v_blob_venue;
  end if;

  raise notice 'VERIFY_OK';
  raise notice 'SEED_COURT_COUNT=%', v_seed_count;
  raise notice 'ACTIVE_SEED_COURT_COUNT=%', v_active_count;
  raise notice 'COURT_SOURCE=club_data_v3.data.courts';
end $$;

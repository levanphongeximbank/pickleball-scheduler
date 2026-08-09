-- ============================================================================
-- TEAM-TOURNAMENT-STAGING-COURT-SEED-01 — 01_PRECHECK.sql
-- STAGING ONLY — DO NOT APPLY without Owner GO.
-- Target project: qyewbxjsiiyufanzcjcq
-- Target club: club-ecebf64c78f948ccb2b59842441eb26c
-- Target tenant/venue: venue-staging-a
-- Authority: public.club_data_v3.data.courts (Format & Venue loadCourtsForClub)
-- ============================================================================

do $$
declare
  v_club public.clubs%rowtype;
  v_blob_exists boolean;
  v_collision int;
  v_seed_ids text[] := array['tt412-court-01', 'tt412-court-02'];
begin
  if not exists (select 1 from public.venues where id = 'venue-staging-a') then
    raise exception 'PRECHECK_FAIL: venue-staging-a missing';
  end if;

  select * into v_club
  from public.clubs
  where id = 'club-ecebf64c78f948ccb2b59842441eb26c'
    and deleted_at is null;

  if not found then
    raise exception 'PRECHECK_FAIL: target club missing or deleted';
  end if;

  if v_club.tenant_id is distinct from 'venue-staging-a' then
    raise exception 'PRECHECK_FAIL: club tenant_id=% expected venue-staging-a', v_club.tenant_id;
  end if;

  select exists(
    select 1 from public.club_data_v3
    where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
  ) into v_blob_exists;

  if v_blob_exists then
    select count(*)::int into v_collision
    from public.club_data_v3 c
    cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
    where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
      and court->>'id' = any (v_seed_ids);

    if v_collision > 0 then
      raise exception 'PRECHECK_FAIL: seed court id collision count=%', v_collision;
    end if;
  end if;

  raise notice 'PRECHECK_OK';
  raise notice 'TARGET_CLUB=%', v_club.id;
  raise notice 'TARGET_TENANT=%', v_club.tenant_id;
  raise notice 'CLUB_BLOB_EXISTS=%', v_blob_exists;
  raise notice 'COURT_SOURCE=club_data_v3.data.courts';
  raise notice 'SEED_COURT_IDS=%', array_to_string(v_seed_ids, ',');
end $$;

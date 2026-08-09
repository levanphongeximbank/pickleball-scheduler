-- ============================================================================
-- TEAM-TOURNAMENT-STAGING-COURT-SEED-01 — 04_ROLLBACK.sql
-- Removes ONLY tt412-court-01/02. Deletes blob row only if it was seed-created
-- (fixtureMarker COURT-SEED-01 and no other courts remain).
-- ============================================================================

begin;

do $$
declare
  v_blob jsonb;
  v_remaining jsonb;
  v_marker text;
begin
  select data into v_blob
  from public.club_data_v3
  where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
  for update;

  if not found then
    raise notice 'ROLLBACK_OK: no club blob present';
    return;
  end if;

  select coalesce(
    (
      select jsonb_agg(court)
      from jsonb_array_elements(coalesce(v_blob->'courts', '[]'::jsonb)) court
      where court->>'id' not in ('tt412-court-01', 'tt412-court-02')
    ),
    '[]'::jsonb
  ) into v_remaining;

  v_marker := coalesce(v_blob->>'fixtureMarker', '');

  if jsonb_array_length(v_remaining) = 0
     and v_marker = 'QA|TT412|COURT-SEED-01'
     and coalesce(jsonb_array_length(v_blob->'players'), 0) = 0
     and coalesce(jsonb_array_length(v_blob->'tournaments'), 0) = 0
  then
    delete from public.club_data_v3
    where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c';
    raise notice 'ROLLBACK_OK: deleted seed-created club blob';
  else
    v_blob := jsonb_set(v_blob, '{courts}', v_remaining, true);
    if v_marker = 'QA|TT412|COURT-SEED-01' then
      v_blob := v_blob - 'fixtureMarker';
    end if;
    update public.club_data_v3
    set
      data = v_blob,
      synced_at = now(),
      version = coalesce(version, 0) + 1
    where club_id = 'club-ecebf64c78f948ccb2b59842441eb26c';
    raise notice 'ROLLBACK_OK: removed seed courts; preserved blob';
  end if;

  if exists (
    select 1
    from public.club_data_v3 c
    cross join lateral jsonb_array_elements(coalesce(c.data->'courts', '[]'::jsonb)) court
    where c.club_id = 'club-ecebf64c78f948ccb2b59842441eb26c'
      and court->>'id' in ('tt412-court-01', 'tt412-court-02')
  ) then
    raise exception 'ROLLBACK_FAIL: seed courts still present';
  end if;
end $$;

commit;

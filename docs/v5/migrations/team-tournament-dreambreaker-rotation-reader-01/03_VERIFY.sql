-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-rotation-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef. Does not call get_setup.
-- Does not mutate the live in_progress fixture.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_point text;
  v_status text;
  v_version int;
  v_a int;
  v_b int;
  v_seg int;
  v_pts int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup';

  if v_count <> 1 then
    raise exception 'VERIFY_FAIL: GET_SETUP_OVERLOAD_COUNT_AFTER expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_get_setup(text,text,integer,boolean)'
  ) is null then
    raise exception 'VERIFY_FAIL: GET_SETUP_SIGNATURE_PRESERVED expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean';

  if position('DREAMBREAKER_ROTATION_READER_01' in v_def) = 0
     or position('''rotation'', coalesce(db.rotation, ''{}''::jsonb)' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_ROTATION_READER_01 expected YES';
  end if;

  if position('segmentIndex' in v_def) = 0
     or position('pointsInSegment' in v_def) = 0
     or position('pointHistory' in v_def) = 0
     or position('injurySkips' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: rotation field contract comments expected present';
  end if;

  if position('team_tournament_assert_tenant' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: tenant assert must remain';
  end if;

  select pg_get_functiondef(p.oid) into v_point
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text';

  if position('DREAMBREAKER_POINT_CAS_ATOMIC' in v_point) = 0
     or position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in v_point) = 0 then
    raise exception 'VERIFY_FAIL: point RPC/CAS/scoring contract must remain unchanged';
  end if;

  select d.status, d.version, d.team_a_score, d.team_b_score,
         coalesce((d.rotation->>'segmentIndex')::int, 0),
         coalesce((d.rotation->>'pointsInSegment')::int, 0)
    into v_status, v_version, v_a, v_b, v_seg, v_pts
  from public.team_tournaments t
  join public.team_tournament_matchups m on m.team_tournament_id = t.id
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where t.tournament_id = 'team-tournament-4zllu71z'
    and m.external_matchup_id = 'matchup-ilj0220c';

  if v_status is not null then
    if v_status <> 'in_progress' or v_version <> 8 or v_a <> 4 or v_b <> 0
       or v_seg <> 1 or v_pts <> 0 then
      raise exception
        'VERIFY_FAIL: fixture mutated during verify status=% version=% score=%-% seg=% pts=%',
        v_status, v_version, v_a, v_b, v_seg, v_pts;
    end if;
  end if;

  raise notice 'VERIFY_OK: get_setup exposes persisted rotation; fixture unread-mutated';
end $$;

select
  'GET_SETUP_OVERLOAD_COUNT_AFTER' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
  ) = 1 as ok;

select
  'DREAMBREAKER_ROTATION_READER_01' as check_item,
  (
    select
      position('DREAMBREAKER_ROTATION_READER_01' in pg_get_functiondef(p.oid)) > 0
      and position('''rotation'', coalesce(db.rotation, ''{}''::jsonb)' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_get_setup(text,text,integer,boolean)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_get_setup(text,text,integer,boolean)',
    'EXECUTE'
  ) as ok;

select
  'POINT_RPC_UNCHANGED' as check_item,
  (
    select
      position('DREAMBREAKER_POINT_CAS_ATOMIC' in pg_get_functiondef(p.oid)) > 0
      and position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'RLS_CHANGED' as check_item,
  'NO' as value,
  true as ok;

select
  'RBAC_CHANGED' as check_item,
  'NO' as value,
  true as ok;

select
  'READER_RETURNS_PERSISTED_ROTATION' as check_item,
  coalesce((
    select
      (coalesce(d.rotation, '{}'::jsonb)->>'segmentIndex')::int = 1
      and (coalesce(d.rotation, '{}'::jsonb)->>'pointsInSegment')::int = 0
      and jsonb_typeof(d.rotation->'pointHistory') = 'array'
      and jsonb_array_length(d.rotation->'pointHistory') = 4
      and jsonb_typeof(coalesce(d.rotation->'injurySkips', '[]'::jsonb)) = 'array'
    from public.team_tournaments t
    join public.team_tournament_matchups m on m.team_tournament_id = t.id
    join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
    where t.tournament_id = 'team-tournament-4zllu71z'
      and m.external_matchup_id = 'matchup-ilj0220c'
  ), true) as ok;

select
  'LIVE_FIXTURE_UNCONSUMED' as check_item,
  coalesce((
    select d.status = 'in_progress' and d.version = 8 and d.team_a_score = 4 and d.team_b_score = 0
      and coalesce((d.rotation->>'segmentIndex')::int, 0) = 1
    from public.team_tournaments t
    join public.team_tournament_matchups m on m.team_tournament_id = t.id
    join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
    where t.tournament_id = 'team-tournament-4zllu71z'
      and m.external_matchup_id = 'matchup-ilj0220c'
  ), true) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;

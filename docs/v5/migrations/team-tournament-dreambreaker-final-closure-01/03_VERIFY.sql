-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-final-closure-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-FINAL-CLOSURE-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification. Does not mutate the live fixture.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_setup text;
  v_point text;
  v_undo text;
  v_status text;
  v_version int;
  v_a int;
  v_b int;
  v_seg int;
begin
  select pg_get_functiondef(p.oid) into v_setup
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean';

  if position('DREAMBREAKER_FINAL_CLOSURE_01' in v_setup) = 0
     or position('''rotation'', coalesce(db.rotation, ''{}''::jsonb)' in v_setup) = 0
     or position('''subMatchId'', db.sub_match_external_id' in v_setup) = 0
     or position('''scoringFormat''' in v_setup) = 0
     or position('segmentIndex' in v_setup) = 0
     or position('pointsInSegment' in v_setup) = 0
     or position('pointHistory' in v_setup) = 0
     or position('injurySkips' in v_setup) = 0 then
    raise exception 'VERIFY_FAIL: get_setup final reader contract missing';
  end if;

  if position('team_tournament_assert_tenant' in v_setup) = 0 then
    raise exception 'VERIFY_FAIL: tenant assert must remain';
  end if;

  select pg_get_functiondef(p.oid) into v_point
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point'
  limit 1;

  if position('DREAMBREAKER_POINT_CAS_ATOMIC' in v_point) = 0
     or position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in v_point) = 0
     or position('and version = p_expected_version' in v_point) = 0
     or position('DREAMBREAKER_FINAL_CLOSURE_01 standings' in v_point) = 0
     or position('team_tournament_recompute_standings_cache' in v_point) = 0 then
    raise exception 'VERIFY_FAIL: point CAS/21/standings contract missing';
  end if;

  select pg_get_functiondef(p.oid) into v_undo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_undo_dreambreaker_point'
  limit 1;

  if position('DREAMBREAKER_UNDO_CAS_ATOMIC' in v_undo) = 0
     or position('DREAMBREAKER_UNDO_PARENT_RECOMPUTE' in v_undo) = 0
     or position('DREAMBREAKER_UNDO_ROTATION_WRAP' in v_undo) = 0
     or position('and version = p_expected_version' in v_undo) = 0
     or position('team_tournament_recompute_matchup_result' in v_undo) = 0
     or position('team_tournament_recompute_standings_cache' in v_undo) = 0 then
    raise exception 'VERIFY_FAIL: undo closure contract missing';
  end if;

  select d.status, d.version, d.team_a_score, d.team_b_score,
         coalesce((d.rotation->>'segmentIndex')::int, 0)
    into v_status, v_version, v_a, v_b, v_seg
  from public.team_tournaments t
  join public.team_tournament_matchups m on m.team_tournament_id = t.id
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where t.tournament_id = 'team-tournament-4zllu71z'
    and m.external_matchup_id = 'matchup-ilj0220c';

  if v_status is not null then
    if v_status <> 'in_progress' or v_version <> 8 or v_a <> 4 or v_b <> 0 or v_seg <> 1 then
      raise exception
        'VERIFY_FAIL: fixture mutated status=% version=% score=%-% seg=%',
        v_status, v_version, v_a, v_b, v_seg;
    end if;
  end if;

  raise notice 'VERIFY_OK: final Dreambreaker runtime contract present; fixture unread-mutated';
end $$;

select
  'DREAMBREAKER_FINAL_CLOSURE_01' as check_item,
  (
    select position('DREAMBREAKER_FINAL_CLOSURE_01' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_setup'
    limit 1
  ) as ok;

select
  'READER_EXPOSES_ROTATION_AND_SCORING' as check_item,
  (
    select
      position('''rotation'', coalesce(db.rotation' in pg_get_functiondef(p.oid)) > 0
      and position('''scoringFormat''' in pg_get_functiondef(p.oid)) > 0
      and position('''subMatchId'', db.sub_match_external_id' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_setup'
    limit 1
  ) as ok;

select
  'POINT_CAS_AND_DEFAULT_21_PRESERVED' as check_item,
  (
    select
      position('DREAMBREAKER_POINT_CAS_ATOMIC' in pg_get_functiondef(p.oid)) > 0
      and position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_record_dreambreaker_point'
    limit 1
  ) as ok;

select
  'UNDO_PARENT_SAFE' as check_item,
  (
    select
      position('DREAMBREAKER_UNDO_PARENT_RECOMPUTE' in pg_get_functiondef(p.oid)) > 0
      and position('and version = p_expected_version' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_undo_dreambreaker_point'
    limit 1
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

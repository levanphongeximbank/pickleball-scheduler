-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-final-closure-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-FINAL-CLOSURE-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No point write. No fixture mutation.
-- Safe when scoring-cas is already applied and rotation-reader is not.
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
  v_pts int;
begin
  if to_regprocedure(
    'public.team_tournament_get_setup(text,text,integer,boolean)'
  ) is null then
    raise exception 'PRECHECK_FAIL: team_tournament_get_setup signature missing';
  end if;

  select pg_get_functiondef(p.oid) into v_setup
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean';

  if position('''teamAOrder'', db.team_a_order' in v_setup) = 0
     or position('into v_dreambreaker' in v_setup) = 0 then
    raise exception 'PRECHECK_FAIL: expected dreambreaker reader object missing';
  end if;

  if position('DREAMBREAKER_FINAL_CLOSURE_01' in v_setup) > 0 then
    raise exception 'PRECHECK_FAIL: final closure reader already present';
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
    raise exception 'PRECHECK_FAIL: scoring-cas package must already be applied';
  end if;

  select pg_get_functiondef(p.oid) into v_undo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_undo_dreambreaker_point';

  if position('DREAMBREAKER_UNDO_PARENT_RECOMPUTE' in v_undo) > 0 then
    raise exception 'PRECHECK_FAIL: undo closure already present';
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
        'PRECHECK_FAIL: live fixture unexpected status=% version=% score=%-% seg=% pts=%',
        v_status, v_version, v_a, v_b, v_seg, v_pts;
    end if;
  end if;

  raise notice 'PRECHECK_OK: scoring-cas present; reader/undo closure not applied; fixture unread-mutated';
end $$;

select
  'SCORING_CAS_ALREADY_APPLIED' as check_item,
  (
    select
      position('DREAMBREAKER_POINT_CAS_ATOMIC' in pg_get_functiondef(p.oid)) > 0
      and position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
    limit 1
  ) as ok;

select
  'CURRENT_READER_OMITS_FINAL_CLOSURE' as check_item,
  (
    select
      position('DREAMBREAKER_FINAL_CLOSURE_01' in pg_get_functiondef(p.oid)) = 0
      and position('''rotation'', coalesce(db.rotation' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean'
  ) as ok;

select
  'UNDO_LACKS_PARENT_RECOMPUTE' as check_item,
  (
    select position('team_tournament_recompute_matchup_result' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_undo_dreambreaker_point'
    limit 1
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

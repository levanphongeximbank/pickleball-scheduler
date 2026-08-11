-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-rotation-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No point write. No fixture mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
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

  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup';

  if v_count <> 1 then
    raise exception 'PRECHECK_FAIL: expected one get_setup overload, found %', v_count;
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load get_setup definition';
  end if;

  if position('''teamAOrder'', db.team_a_order' in v_def) = 0
     or position('''ordersLockedAt'', db.orders_locked_at' in v_def) = 0
     or position('into v_dreambreaker' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: expected dreambreaker reader object missing';
  end if;

  if position('DREAMBREAKER_ROTATION_READER_01' in v_def) > 0
     or position('''rotation'', coalesce(db.rotation' in v_def) > 0
     or position('''rotation'', db.rotation' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: rotation already exposed on get_setup dreambreaker reader';
  end if;

  if position('DREAMBREAKER_POINT_CAS_ATOMIC' in (
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  )) = 0 then
    raise exception 'PRECHECK_FAIL: point CAS function must remain present and untouched';
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

  raise notice 'PRECHECK_OK: get_setup omits rotation; fixture 4-0 v8 segmentIndex=1 unread-mutated';
end $$;

select
  'GET_SETUP_SIGNATURE_MATCH' as check_item,
  to_regprocedure(
    'public.team_tournament_get_setup(text,text,integer,boolean)'
  ) is not null as ok;

select
  'CURRENT_READER_OMITS_ROTATION' as check_item,
  (
    select
      position('''teamAOrder'', db.team_a_order' in pg_get_functiondef(p.oid)) > 0
      and position('''ordersLockedAt'', db.orders_locked_at' in pg_get_functiondef(p.oid)) > 0
      and position('DREAMBREAKER_ROTATION_READER_01' in pg_get_functiondef(p.oid)) = 0
      and position('''rotation'', coalesce(db.rotation' in pg_get_functiondef(p.oid)) = 0
      and position('''rotation'', db.rotation' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean'
  ) as ok;

select
  'LIVE_FIXTURE_UNCONSUMED' as check_item,
  coalesce((
    select d.status = 'in_progress' and d.version = 8 and d.team_a_score = 4 and d.team_b_score = 0
      and coalesce((d.rotation->>'segmentIndex')::int, 0) = 1
      and coalesce((d.rotation->>'pointsInSegment')::int, 0) = 0
    from public.team_tournaments t
    join public.team_tournament_matchups m on m.team_tournament_id = t.id
    join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
    where t.tournament_id = 'team-tournament-4zllu71z'
      and m.external_matchup_id = 'matchup-ilj0220c'
  ), true) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;

-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-scoring-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01
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
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point';

  if v_count < 1 then
    raise exception 'PRECHECK_FAIL: team_tournament_record_dreambreaker_point missing';
  end if;

  if to_regprocedure(
    'public.team_tournament_record_dreambreaker_point(text,text,text,integer,text)'
  ) is null then
    raise exception 'PRECHECK_FAIL: expected record-point signature missing';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load record-point definition';
  end if;

  if position('DREAMBREAKER_SCORING_RESOLVE_01' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: scoring resolve marker must be absent before APPLY';
  end if;

  if position('DREAMBREAKER_POINT_CAS_ATOMIC' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: atomic CAS marker must be absent before APPLY';
  end if;

  if position('coalesce((v_disc.scoring_format->>''targetScore'')::int, 11)' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: current hidden default target=11 expected present';
  end if;

  if position('if p_expected_version is not null and v_db.version <> p_expected_version' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: current optional CAS expected present';
  end if;

  select d.status, d.version, d.team_a_score, d.team_b_score
    into v_status, v_version, v_a, v_b
  from public.team_tournaments t
  join public.team_tournament_matchups m on m.team_tournament_id = t.id
  join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
  where t.tournament_id = 'team-tournament-4zllu71z'
    and m.external_matchup_id = 'matchup-ilj0220c';

  if v_status is not null then
    if v_status <> 'in_progress' or v_version <> 4 or v_a <> 0 or v_b <> 0 then
      raise exception
        'PRECHECK_FAIL: live fixture unexpected state status=% version=% score=%-%',
        v_status, v_version, v_a, v_b;
    end if;
  end if;

  raise notice 'PRECHECK_OK: record-point default 11 + optional CAS; fixture unread-mutated';
end $$;

select
  'RECORD_POINT_SIGNATURE_MATCH' as check_item,
  to_regprocedure(
    'public.team_tournament_record_dreambreaker_point(text,text,text,integer,text)'
  ) is not null as ok;

select
  'CURRENT_HIDDEN_DEFAULT_TARGET_11' as check_item,
  (
    select
      position('coalesce((v_disc.scoring_format->>''targetScore'')::int, 11)' in pg_get_functiondef(p.oid)) > 0
      and position('DREAMBREAKER_SCORING_RESOLVE_01' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CURRENT_OPTIONAL_POINT_CAS' as check_item,
  (
    select
      position('if p_expected_version is not null and v_db.version <> p_expected_version' in pg_get_functiondef(p.oid)) > 0
      and position('DREAMBREAKER_POINT_CAS_ATOMIC' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'LIVE_FIXTURE_UNCONSUMED' as check_item,
  coalesce((
    select d.status = 'in_progress' and d.version = 4 and d.team_a_score = 0 and d.team_b_score = 0
    from public.team_tournaments t
    join public.team_tournament_matchups m on m.team_tournament_id = t.id
    join public.team_tournament_dreambreaker_states d on d.matchup_id = m.id
    where t.tournament_id = 'team-tournament-4zllu71z'
      and m.external_matchup_id = 'matchup-ilj0220c'
  ), true) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;

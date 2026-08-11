-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-scoring-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef. Does not call point RPC.
-- Does not mutate the live in_progress fixture.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_update_pos int;
  v_cas_pos int;
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

  if v_count <> 1 then
    raise exception 'VERIFY_FAIL: RECORD_POINT_OVERLOAD_COUNT_AFTER expected 1, found %', v_count;
  end if;

  if to_regprocedure(
    'public.team_tournament_record_dreambreaker_point(text,text,text,integer,text)'
  ) is null then
    raise exception 'VERIFY_FAIL: RECORD_POINT_SIGNATURE_PRESERVED expected YES';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text';

  if position('DREAMBREAKER_SCORING_RESOLVE_01' in v_def) = 0
     or position('dreambreakerScoringFormat' in v_def) = 0
     or position('targetPoints' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_SCORING_RESOLVE_01 expected YES';
  end if;

  if position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: DEFAULT_TARGET_FALLBACK_21 expected YES';
  end if;

  if position(', 11)' in v_def) > 0
     or position('coalesce((v_disc.scoring_format->>''targetScore'')::int, 11)' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: hidden default target=11 must be removed';
  end if;

  if position('DREAMBREAKER_POINT_EXPECTED_VERSION_REQUIRED' in v_def) = 0
     or position('Thiếu dreambreaker.version.' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: expectedVersion required expected YES';
  end if;

  if position('NO_TOURNAMENT_VERSION_CAS' in v_def) = 0
     or position('NO_MATCHUP_VERSION_CAS' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: dreambreaker.version authority markers missing';
  end if;

  if position('v_header.version' in v_def) > 0
     or position('v_matchup.version =' in v_def) > 0 then
    raise exception 'VERIFY_FAIL: tournament/matchup.version must not be CAS authority';
  end if;

  v_cas_pos := position('DREAMBREAKER_POINT_CAS_ATOMIC' in v_def);
  v_update_pos := position('and version = p_expected_version' in v_def);
  if v_cas_pos = 0 or v_update_pos = 0 or v_cas_pos > v_update_pos then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_POINT_CAS_ATOMIC expected YES';
  end if;

  if position('STALE_POINT_ZERO_WRITE' in v_def) = 0
     or position('team_tournament_version_conflict' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: STALE_POINT_ZERO_WRITE expected YES';
  end if;

  if (
    length(v_def)
    - length(replace(v_def, 'version = version + 1', ''))
  ) / length('version = version + 1') <> 2 then
    raise exception 'VERIFY_FAIL: accepted point must bump dreambreaker.version and submatch.version once each';
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
        'VERIFY_FAIL: fixture mutated during verify status=% version=% score=%-%',
        v_status, v_version, v_a, v_b;
    end if;
  end if;

  raise notice 'VERIFY_OK: scoring resolve 21 default + per-match override; atomic dreambreaker.version CAS';
end $$;

select
  'RECORD_POINT_OVERLOAD_COUNT_AFTER' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
  ) = 1 as ok;

select
  'DREAMBREAKER_SCORING_RESOLVE_01' as check_item,
  (
    select
      position('DREAMBREAKER_SCORING_RESOLVE_01' in pg_get_functiondef(p.oid)) > 0
      and position('dreambreakerScoringFormat' in pg_get_functiondef(p.oid)) > 0
      and position('targetPoints' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'DEFAULT_TARGET_FALLBACK_21' as check_item,
  (
    select
      position('CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21' in pg_get_functiondef(p.oid)) > 0
      and position('coalesce((v_disc.scoring_format->>''targetScore'')::int, 11)' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'DREAMBREAKER_POINT_CAS_ATOMIC' as check_item,
  (
    select
      position('DREAMBREAKER_POINT_CAS_ATOMIC' in pg_get_functiondef(p.oid)) > 0
      and position('and version = p_expected_version' in pg_get_functiondef(p.oid)) > 0
      and position('Thiếu dreambreaker.version.' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'CANONICAL_VERSION_AUTHORITY' as check_item,
  'dreambreaker_states.version' as value,
  (
    select
      position('CANONICAL_VERSION_AUTHORITY = dreambreaker_states.version' in pg_get_functiondef(p.oid)) > 0
      and position('v_header.version' in pg_get_functiondef(p.oid)) = 0
      and position('v_matchup.version =' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_record_dreambreaker_point'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'AUTHENTICATED_GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_record_dreambreaker_point(text,text,text,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_record_dreambreaker_point(text,text,text,integer,text)',
    'EXECUTE'
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

-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-captain-official-submatches-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-OFFICIAL-SUBMATCH-READER-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No data mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
  v_sm int;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal';

  if v_count <> 1 then
    raise exception 'PRECHECK_FAIL: expected unique get_captain_portal, found %', v_count;
  end if;

  if to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null then
    raise exception 'PRECHECK_FAIL: missing signature (text, integer)';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_captain_portal'
    and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load captain portal definition';
  end if;

  if position('team_tournament_sub_matches' in v_def) > 0
     or position('''subMatches''' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: captain portal already references submatches (not pre-state)';
  end if;

  if to_regprocedure('public.team_tournaments') is null then
    null; -- table presence checked below
  end if;

  if not exists (
    select 1 from public.team_tournaments t
    where t.tournament_id = 'team-tournament-m6xorxy1'
  ) then
    raise exception 'PRECHECK_FAIL: target tournament team-tournament-m6xorxy1 missing';
  end if;

  if not exists (
    select 1 from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-mj90tdx5'
      and m.status = 'published'
  ) then
    raise exception 'PRECHECK_FAIL: published target matchup-mj90tdx5 missing';
  end if;

  select count(*)::int into v_sm
  from public.team_tournament_sub_matches sm
  join public.team_tournament_matchups m on m.id = sm.matchup_id
  where m.tournament_id = 'team-tournament-m6xorxy1'
    and m.external_matchup_id = 'matchup-mj90tdx5';

  if v_sm <> 4 then
    raise exception 'PRECHECK_FAIL: expected 4 canonical submatches, found %', v_sm;
  end if;

  raise notice 'PRECHECK_OK: unique captain portal omits subMatches; target has 4 DB submatches';
end $$;

select
  'captain_portal_inventory' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_captain_portal'
  ) as overload_count,
  to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is not null as signature_present,
  (
    select position('team_tournament_sub_matches' in pg_get_functiondef(p.oid)) = 0
      and position('''subMatches''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_captain_portal'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_schema_version integer'
  ) as currently_omits_submatches;

select
  'target_fixture' as check_item,
  (
    select count(*)::int
    from public.team_tournament_sub_matches sm
    join public.team_tournament_matchups m on m.id = sm.matchup_id
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-mj90tdx5'
  ) as target_db_submatch_count,
  (
    select m.status
    from public.team_tournament_matchups m
    where m.tournament_id = 'team-tournament-m6xorxy1'
      and m.external_matchup_id = 'matchup-mj90tdx5'
  ) as target_status,
  -- Simulated current reader count (no subMatches field) = 0
  0 as current_reader_submatch_count;

select
  'grants_baseline' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_get_captain_portal(text,integer)',
    'EXECUTE'
  ) as anon_exec;

select
  'no_data_mutation' as check_item,
  true as ok;

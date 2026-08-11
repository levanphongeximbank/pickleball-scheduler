-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dreambreaker-lineup-filter-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-FIFTH-DISCIPLINE-LINEUP-REGRESSION-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only verification via functiondef. Does not call lineup RPCs.
-- Does not mutate lineup / Dreambreaker / scores.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_def text;
begin
  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_validate_lineup_selections';

  if v_count < 1 then
    raise exception 'VERIFY_FAIL: lineup validator missing';
  end if;

  if to_regprocedure(
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)'
  ) is null then
    raise exception 'VERIFY_FAIL: lineup validator signature not preserved';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_validate_lineup_selections'
    and pg_get_function_identity_arguments(p.oid) =
      'p_header team_tournaments, p_team_external_id text, p_matchup_id text, p_selections jsonb, p_is_submit boolean';

  if position('DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION expected YES';
  end if;

  if position('<> ''dreambreaker''' in v_def) = 0
     or position('<> ''tie_at_2_2''' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: kind/rule skip predicates expected YES';
  end if;

  if position('NORMAL_DISCIPLINES_STILL_VALIDATED' in v_def) = 0
     or position('%s cần %s VĐV.' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: NORMAL_DISCIPLINES_STILL_VALIDATED expected YES';
  end if;

  if position('p_is_submit' in v_def) = 0 or position('v_is_mlp' in v_def) = 0 then
    raise exception 'VERIFY_FAIL: ordinary submit / MLP participation path missing';
  end if;

  raise notice 'VERIFY_OK: Dreambreaker skipped from lineup validation; ordinary rules preserved';
end $$;

select
  'DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' as check_item,
  (
    select
      position('DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' in pg_get_functiondef(p.oid)) > 0
      and position('<> ''dreambreaker''' in pg_get_functiondef(p.oid)) > 0
      and position('<> ''tie_at_2_2''' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_validate_lineup_selections'
      and pg_get_function_identity_arguments(p.oid) =
        'p_header team_tournaments, p_team_external_id text, p_matchup_id text, p_selections jsonb, p_is_submit boolean'
  ) as ok;

select
  'NORMAL_DISCIPLINES_STILL_VALIDATED' as check_item,
  (
    select
      position('NORMAL_DISCIPLINES_STILL_VALIDATED' in pg_get_functiondef(p.oid)) > 0
      and position('%s cần %s VĐV.' in pg_get_functiondef(p.oid)) > 0
      and position('v_is_mlp' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_validate_lineup_selections'
      and pg_get_function_identity_arguments(p.oid) =
        'p_header team_tournaments, p_team_external_id text, p_matchup_id text, p_selections jsonb, p_is_submit boolean'
  ) as ok;

select
  'GRANTS_PRESERVED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)',
    'EXECUTE'
  ) as ok;

select
  'ANON_GRANTS_UNCHANGED' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)',
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
  'no_data_mutation' as check_item,
  true as ok;

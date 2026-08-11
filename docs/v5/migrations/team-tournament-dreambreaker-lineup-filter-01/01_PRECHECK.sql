-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dreambreaker-lineup-filter-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-FIFTH-DISCIPLINE-LINEUP-REGRESSION-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only inventory. No lineup mutation. No Dreambreaker start.
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
    raise exception 'PRECHECK_FAIL: team_tournament_validate_lineup_selections missing';
  end if;

  if to_regprocedure(
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)'
  ) is null then
    raise exception 'PRECHECK_FAIL: expected lineup validator signature missing';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_validate_lineup_selections'
    and pg_get_function_identity_arguments(p.oid) =
      'p_header team_tournaments, p_team_external_id text, p_matchup_id text, p_selections jsonb, p_is_submit boolean';

  if v_def is null then
    raise exception 'PRECHECK_FAIL: cannot load lineup validator definition';
  end if;

  if position('%s cần %s VĐV.' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: current playerCount error format expected present';
  end if;

  if position('DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' in v_def) > 0 then
    raise exception 'PRECHECK_FAIL: skip marker must be absent before APPLY';
  end if;

  if position('lower(coalesce(d.discipline_kind, '''')) <> ''dreambreaker''' in v_def) > 0
     or position('discipline_kind' in v_def) > 0
        and position('<> ''dreambreaker''' in v_def) > 0 then
    if position('DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' in v_def) > 0 then
      raise exception 'PRECHECK_FAIL: Dreambreaker already skipped';
    end if;
  end if;

  if position('for v_discipline in' in v_def) = 0
     or position('from public.team_tournament_disciplines d' in v_def) = 0 then
    raise exception 'PRECHECK_FAIL: current validator must loop catalog disciplines';
  end if;

  raise notice 'PRECHECK_OK: lineup validator loops all catalog rows; Dreambreaker not skipped; zero mutation';
end $$;

select
  'LINEUP_VALIDATOR_SIGNATURE_MATCH' as check_item,
  to_regprocedure(
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)'
  ) is not null as ok;

select
  'CURRENT_INCLUDES_DREAMBREAKER_IN_LINEUP_VALIDATION' as check_item,
  (
    select
      position('from public.team_tournament_disciplines d' in pg_get_functiondef(p.oid)) > 0
      and position('DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION' in pg_get_functiondef(p.oid)) = 0
      and position('%s cần %s VĐV.' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_validate_lineup_selections'
      and pg_get_function_identity_arguments(p.oid) =
        'p_header team_tournaments, p_team_external_id text, p_matchup_id text, p_selections jsonb, p_is_submit boolean'
  ) as ok;

select
  'GRANTS_BASELINE_CAPTURED' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)',
    'EXECUTE'
  ) as auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)',
    'EXECUTE'
  ) as anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)',
    'EXECUTE'
  ) as ok;

select
  'no_data_mutation' as check_item,
  true as ok;

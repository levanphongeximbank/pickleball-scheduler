-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-stage-tiebreak-policy-01
-- Read-only contract checks. No data mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_update_def text;
  v_recompute_def text;
  v_activate_def text;
begin
  if to_regprocedure('public.team_tournament_resolve_competition_stage(public.team_tournament_matchups)') is null then
    raise exception 'VERIFY_FAIL: resolve_competition_stage missing';
  end if;
  if to_regprocedure('public.team_tournament_resolve_stage_tiebreak_policy(public.team_tournaments,public.team_tournament_matchups)') is null then
    raise exception 'VERIFY_FAIL: resolve_stage_tiebreak_policy missing';
  end if;
  if to_regprocedure('public.team_tournament_stage_tiebreak_locked_stages(uuid)') is null then
    raise exception 'VERIFY_FAIL: stage_tiebreak_locked_stages missing';
  end if;

  select pg_get_functiondef(p.oid) into v_update_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_update_setup_config';
  if position('stageTieBreakPolicy' in coalesce(v_update_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: update_setup_config missing stageTieBreakPolicy whitelist';
  end if;
  if position('STAGE_TIEBREAK_POLICY_LOCKED' in coalesce(v_update_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: update_setup_config missing lock code';
  end if;
  if position('team_tournament_setup_mutation_prepare' in coalesce(v_update_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: update_setup_config missing setup_mutation_prepare';
  end if;

  select pg_get_functiondef(p.oid) into v_recompute_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_recompute_matchup_result';
  if position('TOTAL_SUBMATCH_POINTS' in coalesce(v_recompute_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: recompute missing TOTAL_SUBMATCH_POINTS branch';
  end if;
  if position('dreambreaker_fallback' in coalesce(v_recompute_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: recompute missing DREAMBREAKER_FALLBACK secondary-tie path';
  end if;
  if position('secondary_tie_unresolved' in coalesce(v_recompute_def, '')) > 0 then
    raise exception 'VERIFY_FAIL: recompute still uses unresolved secondary-tie behavior';
  end if;

  select pg_get_functiondef(p.oid) into v_activate_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_maybe_activate_dreambreaker';
  if position('needsDreambreaker' in coalesce(v_activate_def, '')) = 0 then
    raise exception 'VERIFY_FAIL: maybe_activate must trust recompute needsDreambreaker';
  end if;
  if position('STAGE_POLICY_NOT_DREAMBREAKER' in coalesce(v_activate_def, '')) > 0 then
    raise exception 'VERIFY_FAIL: maybe_activate must not hard-reject TOTAL_SUBMATCH_POINTS before fallback';
  end if;

  if not has_function_privilege('authenticated', 'public.team_tournament_update_setup_config(text,jsonb,integer,text)', 'execute') then
    raise exception 'VERIFY_FAIL: authenticated missing execute on update_setup_config';
  end if;
  if has_function_privilege('anon', 'public.team_tournament_update_setup_config(text,jsonb,integer,text)', 'execute') then
    raise exception 'VERIFY_FAIL: anon must not execute update_setup_config';
  end if;

  raise notice 'VERIFY_OK: team-tournament-stage-tiebreak-policy-01';
end $$;

select
  'stage-tiebreak-policy-01' as package,
  to_regprocedure('public.team_tournament_update_setup_config(text,jsonb,integer,text)') is not null as update_setup_config,
  to_regprocedure('public.team_tournament_recompute_matchup_result(uuid)') is not null as recompute,
  to_regprocedure('public.team_tournament_maybe_activate_dreambreaker(public.team_tournaments,public.team_tournament_matchups)') is not null as maybe_activate;

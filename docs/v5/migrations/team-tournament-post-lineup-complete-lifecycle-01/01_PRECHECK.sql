-- team-tournament-post-lineup-complete-lifecycle-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.

do $$
begin
  if to_regprocedure('public.team_tournament_update_setup_config(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_update_setup_config missing';
  end if;
  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: team_tournaments missing';
  end if;
  if to_regclass('public.canonical_tournaments') is null then
    raise exception 'PRECHECK_FAIL: canonical_tournaments missing';
  end if;
  if to_regclass('public.team_tournament_matchups') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_matchups missing';
  end if;
  if to_regprocedure('public.team_tournament_setup_mutation_prepare(text, jsonb, text, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: setup_mutation_prepare missing';
  end if;
  if to_regproc('public.team_tournament_resolve_competition_stage') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_resolve_competition_stage missing';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'PRECHECK_FAIL: profiles missing';
  end if;
  raise notice 'PRECHECK_PASS: team-tournament-post-lineup-complete-lifecycle-01';
end $$;

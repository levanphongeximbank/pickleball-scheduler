-- team-tournament-owner-browser-acceptance-remediation-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only after lifecycle-01. Never re-run lifecycle 02_APPLY.

do $$
begin
  if to_regprocedure('public.team_tournament_update_setup_config(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_update_setup_config missing';
  end if;
  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_assert_close_readiness missing';
  end if;
  if to_regprocedure('public.team_tournament_close_tournament(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_close_tournament missing';
  end if;
  if to_regclass('public.team_tournament_team_members') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_team_members missing';
  end if;
  if to_regclass('public.athletes') is null then
    raise exception 'PRECHECK_FAIL: athletes missing';
  end if;
  if to_regclass('public.venues') is null then
    raise exception 'PRECHECK_FAIL: venues missing';
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_can_manage() missing';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-owner-browser-acceptance-remediation-01';
end $$;

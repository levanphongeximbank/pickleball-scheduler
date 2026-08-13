-- team-tournament-list-my-dashboards-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.

do $$
declare
  v_md5 text;
begin
  if auth.role() is null then
    raise notice 'PRECHECK: running as non-auth session (definition checks only)';
  end if;

  if to_regprocedure('public.team_tournament_can_view_dashboard(text,boolean,boolean,boolean)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_can_view_dashboard missing — apply draft-visibility package first';
  end if;

  v_md5 := md5(pg_get_functiondef(
    'public.team_tournament_can_view_dashboard(text,boolean,boolean,boolean)'::regprocedure
  ));
  if v_md5 is distinct from '5fa16a3b7f7ea6c4647dfb855fff965c' then
    raise exception 'PRECHECK_FAIL: unexpected can_view_dashboard fingerprint %', v_md5;
  end if;

  if to_regprocedure('public.team_tournament_status_is_athlete_visible(text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_status_is_athlete_visible missing';
  end if;

  if to_regprocedure('public.team_tournament_can_manage()') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_can_manage missing';
  end if;

  if to_regclass('public.athletes') is null then
    raise exception 'PRECHECK_FAIL: public.athletes missing';
  end if;

  if to_regprocedure('public.team_tournament_list_my_dashboards()') is not null then
    raise exception 'PRECHECK_FAIL: team_tournament_list_my_dashboards already exists';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-list-my-dashboards-01';
end $$;

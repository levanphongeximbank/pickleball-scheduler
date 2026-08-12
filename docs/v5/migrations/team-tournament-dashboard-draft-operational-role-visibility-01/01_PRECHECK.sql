-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-dashboard-draft-operational-role-visibility-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- STAGING_MUTATIONS=0 until explicit GO.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_dash_hash text;
  v_dash_src text;
begin
  if to_regprocedure('public.team_tournament_get_dashboard(text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_get_dashboard(text) missing';
  end if;
  if to_regprocedure('public.team_tournament_status_is_athlete_visible(text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_status_is_athlete_visible(text) missing';
  end if;
  if to_regprocedure('public.team_tournament_user_player_id()') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_user_player_id() missing';
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_can_manage() missing';
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_teams missing';
  end if;

  select md5(pg_get_functiondef('public.team_tournament_get_dashboard(text)'::regprocedure))
    into v_dash_hash;
  select pg_get_functiondef('public.team_tournament_get_dashboard(text)'::regprocedure)
    into v_dash_src;

  -- Fingerprint captured 2026-08-12 from Staging qyewbxjsiiyufanzcjcq before apply.
  if v_dash_hash is distinct from '306f3d55f27cc2ac1010b6ece771388b' then
    raise exception 'PRECHECK_FAIL: team_tournament_get_dashboard hash % != expected 306f3d55f27cc2ac1010b6ece771388b (re-review before apply)', v_dash_hash;
  end if;

  if position('DRAFT_NOT_VISIBLE' in v_dash_src) = 0 then
    raise exception 'PRECHECK_FAIL: expected pre-apply DRAFT_NOT_VISIBLE gate';
  end if;

  -- Defect class: draft deny precedes captain resolve.
  if position('select t.external_team_id into v_captain_team_id' in v_dash_src) > 0
     and position('DRAFT_NOT_VISIBLE' in v_dash_src)
         < position('select t.external_team_id into v_captain_team_id' in v_dash_src)
  then
    raise notice 'PRECHECK_OK: draft gate precedes captain resolve (defect confirmed)';
  else
    raise notice 'PRECHECK_OK: fingerprint matched (ordering notice skipped)';
  end if;

  raise notice 'PRECHECK_OK: dashboard fingerprint 306f3d55f27cc2ac1010b6ece771388b';
end;
$$;

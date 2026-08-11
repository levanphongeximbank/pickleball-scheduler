-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-canonical-dashboard-lifecycle-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Compatible with post-#416 Staging schema.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.team_tournaments missing';
  end if;
  if to_regclass('public.canonical_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.canonical_tournaments missing';
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    v_missing := array_append(v_missing, 'team_tournament_teams');
  end if;
  if to_regclass('public.team_tournament_team_members') is null then
    v_missing := array_append(v_missing, 'team_tournament_team_members');
  end if;
  if to_regclass('public.team_tournament_matchups') is null then
    v_missing := array_append(v_missing, 'team_tournament_matchups');
  end if;

  if to_regprocedure('public.canonical_tournament_create(text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'canonical_tournament_create');
  end if;
  if to_regprocedure('public.canonical_tournament_list(text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'canonical_tournament_list');
  end if;
  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header');
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage');
  end if;
  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant');
  end if;
  if to_regprocedure('public.team_tournament_user_player_id()') is null then
    v_missing := array_append(v_missing, 'team_tournament_user_player_id');
  end if;
  if to_regprocedure('public.team_tournament_resolve_stage_tiebreak_policy(team_tournaments,team_tournament_matchups)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_stage_tiebreak_policy');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PRECHECK_OK: team-tournament-canonical-dashboard-lifecycle-01 prerequisites present';
end $$;

select 'PRECHECK_OK' as status;

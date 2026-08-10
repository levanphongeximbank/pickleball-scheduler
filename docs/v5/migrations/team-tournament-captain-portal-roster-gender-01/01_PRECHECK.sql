-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-captain-portal-roster-gender-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-PORTAL-ROSTER-GENDER-AND-MLP4-OPTION-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.team_tournaments missing';
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    v_missing := array_append(v_missing, 'team_tournament_teams');
  end if;
  if to_regclass('public.team_tournament_team_members') is null then
    v_missing := array_append(v_missing, 'team_tournament_team_members');
  end if;
  if to_regclass('public.athletes') is null then
    v_missing := array_append(v_missing, 'athletes');
  end if;
  if to_regclass('public.profiles') is null then
    v_missing := array_append(v_missing, 'profiles');
  end if;

  if to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null then
    v_missing := array_append(v_missing, 'team_tournament_get_captain_portal(text,integer)');
  end if;
  if to_regprocedure('public.team_tournament_assert_captain_portal_access(text,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_captain_portal_access(text,text)');
  end if;
  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header(text)');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PRECHECK_OK: captain-portal-roster-gender-01 prerequisites present';
end $$;

select
  'team_tournament_get_captain_portal' as check_item,
  to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is not null as rpc_present,
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gender'
  ) as profiles_gender_column,
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'athletes'
      and column_name = 'display_name'
  ) as athletes_display_name_column;

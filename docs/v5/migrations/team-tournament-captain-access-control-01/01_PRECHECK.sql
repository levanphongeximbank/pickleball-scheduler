-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-captain-access-control-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-ACCESS-W0-W1-IMPLEMENTATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_has_settings boolean;
begin
  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.team_tournaments missing';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournaments'
      and column_name = 'settings'
      and data_type = 'jsonb'
  ) into v_has_settings;

  if not v_has_settings then
    raise exception 'PRECHECK_FAIL: team_tournaments.settings jsonb missing';
  end if;

  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header(text)');
  end if;
  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant(text)');
  end if;
  if to_regprocedure('public.team_tournament_user_player_id()') is null then
    v_missing := array_append(v_missing, 'team_tournament_user_player_id()');
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage()');
  end if;
  if to_regprocedure('public.team_tournament_is_captain(uuid,text,text)') is null
     and to_regprocedure('public.team_tournament_is_captain(text,text,text)') is null then
    -- header.id may be uuid; accept either live signature family
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'team_tournament_is_captain'
    ) then
      v_missing := array_append(v_missing, 'team_tournament_is_captain');
    end if;
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    v_missing := array_append(v_missing, 'team_tournament_teams');
  end if;
  if to_regclass('public.team_tournament_matchups') is null then
    v_missing := array_append(v_missing, 'team_tournament_matchups');
  end if;
  if to_regclass('public.team_tournament_lineups') is null then
    v_missing := array_append(v_missing, 'team_tournament_lineups');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PRECHECK_OK: captain-access-control-01 prerequisites present';
end $$;

select
  'team_tournaments.settings' as check_item,
  (
    select data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournaments'
      and column_name = 'settings'
  ) as settings_type,
  (
    select count(*)::int
    from public.team_tournaments
    where settings ? 'captainAccessEnabled'
  ) as rows_with_captain_access_key,
  (
    select count(*)::int
    from public.team_tournaments
    where not (settings ? 'captainAccessEnabled')
  ) as rows_missing_captain_access_key;

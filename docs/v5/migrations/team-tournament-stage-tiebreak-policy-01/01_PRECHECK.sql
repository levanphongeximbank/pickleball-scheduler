-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-stage-tiebreak-policy-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_has_settings boolean;
  v_has_schedule_meta boolean;
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

  if to_regclass('public.team_tournament_matchups') is null then
    v_missing := array_append(v_missing, 'team_tournament_matchups');
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournament_matchups'
      and column_name = 'schedule_meta'
      and data_type = 'jsonb'
  ) into v_has_schedule_meta;

  if not v_has_schedule_meta then
    v_missing := array_append(v_missing, 'team_tournament_matchups.schedule_meta');
  end if;

  if to_regclass('public.team_tournament_sub_matches') is null then
    v_missing := array_append(v_missing, 'team_tournament_sub_matches');
  end if;

  if to_regprocedure('public.team_tournament_setup_mutation_prepare(text,jsonb,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_setup_mutation_prepare');
  end if;

  if to_regprocedure('public.team_tournament_update_setup_config(text,jsonb,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_update_setup_config');
  end if;

  if to_regprocedure('public.team_tournament_recompute_matchup_result(uuid)') is null then
    v_missing := array_append(v_missing, 'team_tournament_recompute_matchup_result');
  end if;

  if to_regprocedure('public.team_tournament_maybe_activate_dreambreaker(public.team_tournaments,public.team_tournament_matchups)') is null then
    v_missing := array_append(v_missing, 'team_tournament_maybe_activate_dreambreaker');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PRECHECK_OK: team-tournament-stage-tiebreak-policy-01 prerequisites present';
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
  to_regprocedure('public.team_tournament_update_setup_config(text,jsonb,integer,text)') is not null
    as update_setup_config_present,
  to_regprocedure('public.team_tournament_recompute_matchup_result(uuid)') is not null
    as recompute_present;

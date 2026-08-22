-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-production-alignment-01
-- LOCAL / Owner GO only. Do NOT apply on Staging/Production without Owner GO.
-- Read-only. STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
--
-- Fail closed. Missing-object diagnostic uses array_append (never text[] || scalar).
-- Classifies each alignment target:
--   ABSENT_SUPPORTED | PRESENT_EXACT | PRESENT_SUPPORTED_LEGACY_TO_REPLACE | CONFLICTING
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_conflict text[] := '{}';
  v_partial text[] := '{}';
  v_grant text[] := '{}';
  v_legacy text[] := '{}';
  v_present_exact int := 0;
  v_absent int := 0;
  v_legacy_n int := 0;
  v_already boolean := false;
begin
  -- ── Production-compatible base prestate
  if to_regclass('public.team_tournaments') is null then
    v_missing := array_append(v_missing, 'team_tournaments');
  end if;
  if to_regclass('public.canonical_tournaments') is null then
    v_missing := array_append(v_missing, 'canonical_tournaments');
  end if;
  if to_regclass('public.athletes') is null then
    v_missing := array_append(v_missing, 'athletes');
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    v_missing := array_append(v_missing, 'team_tournament_teams');
  end if;
  if to_regclass('public.team_tournament_team_members') is null then
    v_missing := array_append(v_missing, 'team_tournament_team_members');
  end if;
  if to_regclass('public.team_tournament_groups') is null then
    v_missing := array_append(v_missing, 'team_tournament_groups');
  end if;
  if to_regclass('public.team_tournament_matchups') is null then
    v_missing := array_append(v_missing, 'team_tournament_matchups');
  end if;
  if to_regclass('public.team_tournament_sub_matches') is null then
    v_missing := array_append(v_missing, 'team_tournament_sub_matches');
  end if;
  if to_regclass('public.team_tournament_lineups') is null then
    v_missing := array_append(v_missing, 'team_tournament_lineups');
  end if;
  if to_regclass('public.team_tournament_disciplines') is null then
    v_missing := array_append(v_missing, 'team_tournament_disciplines');
  end if;
  if to_regclass('public.team_tournament_dreambreaker_states') is null then
    v_missing := array_append(v_missing, 'team_tournament_dreambreaker_states');
  end if;
  if to_regclass('public.team_tournament_command_log') is null then
    v_missing := array_append(v_missing, 'team_tournament_command_log');
  end if;
  if to_regclass('public.team_tournament_standings') is null then
    v_missing := array_append(v_missing, 'team_tournament_standings');
  end if;
  if to_regclass('public.profiles') is null then
    v_missing := array_append(v_missing, 'profiles');
  end if;

  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage()');
  end if;
  if to_regprocedure('public.team_tournament_can_manage_results()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage_results()');
  end if;
  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant(text)');
  end if;
  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header(text)');
  end if;
  if to_regprocedure('public.team_tournament_begin_command(text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_begin_command');
  end if;
  if to_regprocedure('public.team_tournament_finish_command(text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_finish_command');
  end if;
  if to_regprocedure('public.team_tournament_write_audit(text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_write_audit');
  end if;
  if to_regprocedure('public.team_tournament_setup_mutation_prepare(text,jsonb,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_setup_mutation_prepare');
  end if;
  if to_regprocedure('public.is_super_admin()') is null then
    v_missing := array_append(v_missing, 'is_super_admin()');
  end if;
  if to_regprocedure('public.user_venue_id()') is null then
    v_missing := array_append(v_missing, 'user_venue_id()');
  end if;
  if to_regprocedure('public.team_tournament_version_conflict(text,integer,integer)') is null then
    v_missing := array_append(v_missing, 'team_tournament_version_conflict');
  end if;

  -- PR #423 referee foundation must already be live
  if to_regclass('public.referee_assignments') is null then
    v_missing := array_append(v_missing, 'PR423.referee_assignments');
  end if;
  if to_regclass('public.match_live_states') is null then
    v_missing := array_append(v_missing, 'PR423.match_live_states');
  end if;
  if to_regclass('public.team_sub_match_referee_links') is null then
    v_missing := array_append(v_missing, 'PR423.team_sub_match_referee_links');
  end if;
  if to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null then
    v_missing := array_append(v_missing, 'PR423.create_referee_assignment');
  end if;
  if to_regprocedure('public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)') is null then
    v_missing := array_append(v_missing, 'PR423.provision_eligibility');
  end if;
  if to_regprocedure('public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)') is null then
    v_missing := array_append(v_missing, 'PR423.build_v5_state_shell');
  end if;
  if to_regprocedure('public.team_tournament_start_dreambreaker(text,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'PR423.start_dreambreaker');
  end if;
  if to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'PR423.confirm_sub_match_7arg');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL missing=%', array_to_string(v_missing, ',');
  end if;

  -- Continuation must not already own final helpers if we are aligning the pre-continuation contract
  if to_regprocedure(
    'public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null
     and to_regprocedure(
       'public.team_tournament_create(text,text,text,text,text,text,jsonb)'
     ) is null then
    raise exception 'PRECHECK_FAIL conflict=final_continuation_present_without_alignment_create';
  end if;

  -- ── Classify alignment-owned RPCs
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is not null then
    v_present_exact := v_present_exact + 1;
    raise notice 'PRESENT_EXACT team_tournament_create';
  else
    v_absent := v_absent + 1;
    raise notice 'ABSENT_SUPPORTED team_tournament_create';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_create'
      and pg_get_function_identity_arguments(p.oid)
        not in (
          'p_tenant_id text, p_club_id text, p_name text, p_season_id text, p_league_id text, p_created_by text, p_settings jsonb',
          'text, text, text, text, text, text, jsonb'
        )
  ) then
    v_conflict := array_append(v_conflict, 'team_tournament_create.unexpected_overload');
  end if;

  if to_regprocedure('public.team_tournament_get_dashboard(text)') is not null then
    v_present_exact := v_present_exact + 1;
    raise notice 'PRESENT_EXACT team_tournament_get_dashboard';
  else
    v_absent := v_absent + 1;
    raise notice 'ABSENT_SUPPORTED team_tournament_get_dashboard';
  end if;

  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is not null then
    v_present_exact := v_present_exact + 1;
    raise notice 'PRESENT_EXACT team_tournament_commit_pairing';
  else
    v_absent := v_absent + 1;
    raise notice 'ABSENT_SUPPORTED team_tournament_commit_pairing';
  end if;

  if to_regprocedure(
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)'
  ) is not null then
    v_present_exact := v_present_exact + 1;
    raise notice 'PRESENT_EXACT team_tournament_save_lineup_draft_6arg';
  else
    v_absent := v_absent + 1;
    raise notice 'ABSENT_SUPPORTED team_tournament_save_lineup_draft_6arg';
  end if;

  if to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb)') is not null then
    v_legacy_n := v_legacy_n + 1;
    v_legacy := array_append(v_legacy, 'save_lineup_draft_4arg');
    raise notice 'PRESENT_SUPPORTED_LEGACY_TO_REPLACE save_lineup_draft_4arg';
  end if;

  if to_regprocedure('public.team_tournament_get_setup(text,text)') is not null then
    v_legacy_n := v_legacy_n + 1;
    v_legacy := array_append(v_legacy, 'get_setup_2arg');
    raise notice 'PRESENT_SUPPORTED_LEGACY_TO_REPLACE get_setup_2arg';
  end if;

  if to_regprocedure('public.team_tournament_get_setup(text,text,integer,boolean)') is null then
    v_conflict := array_append(v_conflict, 'get_setup_4arg.missing_required_current_contract');
  else
    raise notice 'PRESENT_EXACT team_tournament_get_setup_4arg';
  end if;

  if to_regprocedure('public.team_tournament_publish_matchup(text,text)') is not null
     and to_regprocedure(
       'public.team_tournament_publish_matchup(text,text,integer,integer,integer,text)'
     ) is null then
    v_legacy_n := v_legacy_n + 1;
    raise notice 'PRESENT_SUPPORTED_LEGACY_TO_REPLACE publish_matchup_2arg';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_user_player_id'
      and pg_get_functiondef(p.oid) ilike '%profiles%player_id%'
      and pg_get_functiondef(p.oid) not ilike '%athletes%'
  ) then
    v_legacy_n := v_legacy_n + 1;
    raise notice 'PRESENT_SUPPORTED_LEGACY_TO_REPLACE user_player_id.profiles_player_id';
  elsif to_regprocedure('public.team_tournament_user_player_id()') is not null then
    raise notice 'PRESENT_EXACT_OR_OTHER user_player_id';
  end if;

  -- Duplicate unexpected overloads of get_setup beyond 2-arg + 4-arg
  if (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_get_setup'
  ) > 2 then
    v_conflict := array_append(v_conflict, 'get_setup.too_many_overloads');
  end if;

  -- Partial alignment: some new RPCs present, required create path incomplete
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is not null
     and (
       to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null
       or to_regprocedure('public.team_tournament_get_dashboard(text)') is null
       or to_regprocedure('public.team_tournament_seed_mlp_disciplines(team_tournaments)') is null
     ) then
    v_partial := array_append(v_partial, 'create_without_dashboard_or_pairing_or_mlp_seed');
  end if;

  if to_regprocedure('public.team_tournament_get_dashboard(text)') is not null
     and to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null
     and to_regprocedure('public.team_tournament_list_my_dashboards()') is null then
    v_partial := array_append(v_partial, 'dashboard_without_create');
  end if;

  -- Unsafe anon execute on privileged writes that already exist
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'team_tournament_create',
          'team_tournament_commit_pairing',
          'team_tournament_close_tournament',
          'team_tournament_override_lineup',
          'team_tournament_set_captain_access',
          'team_tournament_revoke_referee_assignment'
        )
        and has_function_privilege('anon', p.oid, 'execute')
    ) then
      v_grant := array_append(v_grant, 'anon_execute.privileged_alignment_rpc');
    end if;
  end if;

  if array_length(v_conflict, 1) is not null then
    raise exception 'PRECHECK_FAIL conflict=%', array_to_string(v_conflict, ',');
  end if;
  if array_length(v_partial, 1) is not null then
    raise exception 'PRECHECK_FAIL partial_alignment_state=%', array_to_string(v_partial, ',');
  end if;
  if array_length(v_grant, 1) is not null then
    raise exception 'PRECHECK_FAIL unexpected_grants=%', array_to_string(v_grant, ',');
  end if;

  if to_regclass('public.team_tournament_package_apply_ledger') is not null then
    execute $q$
      select exists (
        select 1 from public.team_tournament_package_apply_ledger
        where package_id = 'team-tournament-production-alignment-01'
      )
    $q$ into v_already;
  end if;
  v_already := coalesce(v_already, false)
    and to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)') is not null
    and to_regprocedure('public.team_tournament_get_dashboard(text)') is not null;

  if v_already then
    raise notice 'PRECHECK_PASS already_applied_compatible PRESENT_EXACT=% ABSENT=% LEGACY=%',
      v_present_exact, v_absent, v_legacy_n;
  else
    raise notice 'PRECHECK_PASS production_prestate_ready ABSENT_SUPPORTED=% PRESENT_EXACT=% PRESENT_SUPPORTED_LEGACY_TO_REPLACE=%',
      v_absent, v_present_exact, v_legacy_n;
  end if;
end;
$$;

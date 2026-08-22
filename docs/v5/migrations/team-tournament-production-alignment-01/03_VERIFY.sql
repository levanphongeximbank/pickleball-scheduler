-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-production-alignment-01
-- LOCAL / Owner GO only. Do NOT apply on Staging/Production without Owner GO.
-- Proves current-main frontend signatures. Does not apply referee continuation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := '{}';
  v_n int;
  v_def text;
  v_uid uuid;
  v_created jsonb;
  v_id text;
  v_canon uuid;
  v_header uuid;
  v_disc int;
  v_tt_before int;
  v_canon_before int;
  v_cap_true int;
begin
  select count(*)::int into v_tt_before from public.team_tournaments;
  select count(*)::int into v_canon_before
  from public.canonical_tournaments where mode = 'team_tournament';
  select count(*)::int into v_cap_true
  from public.team_tournaments
  where coalesce((settings->>'captainAccessEnabled')::boolean, false) is true;

  -- CREATE_PATH_READY
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    v_fail := array_append(v_fail, 'missing.create');
  end if;
  if to_regprocedure('public.team_tournament_ensure_canonical(text,text,text,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.ensure_canonical');
  end if;
  if to_regprocedure('public.team_tournament_seed_mlp_disciplines(team_tournaments)') is null then
    v_fail := array_append(v_fail, 'missing.seed_mlp');
  end if;
  if to_regprocedure('public.team_tournament_merge_mlp_initial_settings(jsonb)') is null then
    v_fail := array_append(v_fail, 'missing.merge_mlp');
  end if;

  select pg_get_functiondef('public.team_tournament_seed_mlp_disciplines(team_tournaments)'::regprocedure)
    into v_def;
  if v_def is null or v_def not ilike '%mlp-wd%' or v_def not ilike '%dreambreaker%' then
    v_fail := array_append(v_fail, 'seed_mlp.catalog_literals');
  end if;
  select pg_get_functiondef('public.team_tournament_create(text,text,text,text,text,text,jsonb)'::regprocedure)
    into v_def;
  if v_def is null
     or v_def not ilike '%canonical_tournaments%'
     or v_def not ilike '%team_tournament_seed_mlp_disciplines%'
     or v_def not ilike '%team_tournament_merge_mlp_initial_settings%' then
    v_fail := array_append(v_fail, 'create.post417_semantics');
  end if;

  -- Dashboard
  if to_regprocedure('public.team_tournament_get_dashboard(text)') is null then
    v_fail := array_append(v_fail, 'missing.get_dashboard');
  end if;
  if to_regprocedure('public.team_tournament_list_my_dashboards()') is null then
    v_fail := array_append(v_fail, 'missing.list_my_dashboards');
  end if;
  if to_regprocedure('public.team_tournament_can_view_dashboard(text,boolean,boolean,boolean)') is null then
    v_fail := array_append(v_fail, 'missing.can_view_dashboard');
  end if;
  if to_regprocedure('public.team_tournament_status_is_athlete_visible(text)') is null then
    v_fail := array_append(v_fail, 'missing.status_is_athlete_visible');
  end if;

  -- Pairing / setup
  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    v_fail := array_append(v_fail, 'missing.commit_pairing');
  end if;
  if to_regprocedure('public.team_tournament_update_setup_config(text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.update_setup_config');
  end if;
  select pg_get_functiondef('public.team_tournament_update_setup_config(text,jsonb,integer,text)'::regprocedure)
    into v_def;
  if v_def is null or v_def not ilike '%scoringMode%' or v_def not ilike '%stageScoringPolicy%' then
    v_fail := array_append(v_fail, 'update_setup_config.scoringMode');
  end if;

  select count(*)::int into v_n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_get_setup';
  if v_n <> 1 then
    v_fail := array_append(v_fail, 'get_setup.overload_count=' || v_n::text);
  end if;
  if to_regprocedure('public.team_tournament_get_setup(text,text,integer,boolean)') is null then
    v_fail := array_append(v_fail, 'get_setup.4arg_missing');
  end if;
  if to_regprocedure('public.team_tournament_get_setup(text,text)') is not null then
    v_fail := array_append(v_fail, 'get_setup.2arg_still_present');
  end if;

  -- Captain
  if to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null then
    v_fail := array_append(v_fail, 'missing.get_captain_portal');
  end if;
  if to_regprocedure('public.team_tournament_set_captain_access(text,boolean,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.set_captain_access');
  end if;
  if to_regprocedure('public.team_tournament_get_visible_lineups(text,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.get_visible_lineups');
  end if;
  select pg_get_functiondef('public.team_tournament_user_player_id()'::regprocedure) into v_def;
  if v_def is null or v_def not ilike '%athletes%' or v_def ilike '%p.player_id%' then
    v_fail := array_append(v_fail, 'user_player_id.not_athletes_canonical');
  end if;

  -- CAS signatures
  if to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.save_lineup_draft_6arg');
  end if;
  if to_regprocedure('public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.submit_lineup_6arg');
  end if;
  if to_regprocedure('public.team_tournament_publish_matchup(text,text,integer,integer,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.publish_matchup_6arg');
  end if;
  if to_regprocedure('public.team_tournament_save_sub_match_draft(text,text,text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.save_sub_match_draft_6arg');
  end if;
  if to_regprocedure('public.team_tournament_upsert_standings(text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.upsert_standings_4arg');
  end if;
  if to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb)') is not null then
    v_fail := array_append(v_fail, 'stale.save_lineup_draft_4arg');
  end if;
  if to_regprocedure('public.team_tournament_publish_matchup(text,text)') is not null then
    v_fail := array_append(v_fail, 'stale.publish_matchup_2arg');
  end if;

  -- Close / override / organizer referee
  if to_regprocedure('public.team_tournament_close_tournament(text,jsonb,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.close_tournament');
  end if;
  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    v_fail := array_append(v_fail, 'missing.assert_close_readiness');
  end if;
  if to_regprocedure('public.team_tournament_resolve_stage_tiebreak_policy(team_tournaments,team_tournament_matchups)') is null then
    v_fail := array_append(v_fail, 'missing.resolve_stage_tiebreak_policy');
  end if;
  if to_regprocedure('public.team_tournament_override_lineup(text,text,text,jsonb,text,integer,integer,text)') is null then
    v_fail := array_append(v_fail, 'missing.override_lineup');
  end if;
  if to_regprocedure('public.team_tournament_get_lineup_override_ops(text,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.get_lineup_override_ops');
  end if;
  if to_regprocedure('public.team_tournament_revoke_referee_assignment(text,uuid,integer,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.revoke_referee_assignment');
  end if;
  if to_regprocedure('public.team_tournament_list_referee_assignments(text,text)') is null then
    v_fail := array_append(v_fail, 'missing.list_referee_assignments');
  end if;
  if to_regprocedure('public.team_tournament_search_referee_candidates(text,text,integer)') is null then
    v_fail := array_append(v_fail, 'missing.search_referee_candidates');
  end if;

  -- Continuation objects must remain absent (this package must not include them)
  if to_regprocedure(
    'public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null then
    v_fail := array_append(v_fail, 'unexpected.continuation.resolve_effective');
  end if;
  if to_regprocedure(
    'public.team_tournament_result_write_guard(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null then
    v_fail := array_append(v_fail, 'unexpected.continuation.result_write_guard');
  end if;

  -- PR #423 foundation intact
  if to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null then
    v_fail := array_append(v_fail, 'foundation.create_referee_assignment_missing');
  end if;

  -- Anon privileged execute DENY
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'team_tournament_create',
          'team_tournament_commit_pairing',
          'team_tournament_get_dashboard',
          'team_tournament_close_tournament',
          'team_tournament_save_lineup_draft',
          'team_tournament_set_captain_access',
          'team_tournament_revoke_referee_assignment'
        )
        and has_function_privilege('anon', p.oid, 'execute')
    ) then
      v_fail := array_append(v_fail, 'anon_privileged_execute');
    end if;
  end if;

  -- No historical captain backfill
  if v_cap_true <> (
    select count(*)::int from public.team_tournaments
    where coalesce((settings->>'captainAccessEnabled')::boolean, false) is true
  ) then
    v_fail := array_append(v_fail, 'captain_access_backfill_detected');
  end if;

  -- Throwaway create path (rolled back). Requires a JWT subject.
  begin
    v_uid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    v_uid := null;
  end;

  if v_uid is not null then
    v_created := public.team_tournament_create(
      public.user_venue_id(),
      'club-alignment-verify',
      'Alignment VERIFY throwaway',
      null, null, v_uid::text,
      jsonb_build_object('formatPreset', 'mlp_4', 'idempotencyKey', 'alignment-verify-' || gen_random_uuid()::text)
    );
    if coalesce(v_created->>'ok', '') <> 'true' then
      v_fail := array_append(v_fail, 'create_path.rpc=' || coalesce(v_created->>'code', 'fail'));
    else
      v_id := v_created->'tournament'->>'id';
      select c.id, tt.id into v_canon, v_header
      from public.canonical_tournaments c
      join public.team_tournaments tt on tt.tournament_id = c.id::text
      where c.id::text = v_id;
      if v_canon is null or v_header is null then
        v_fail := array_append(v_fail, 'create_path.dual_persist');
      end if;
      if v_canon is distinct from v_header then
        v_fail := array_append(v_fail, 'create_path.uuid_mismatch');
      end if;
      select count(*)::int into v_disc
      from public.team_tournament_disciplines d
      where d.team_tournament_id = v_header
        and d.external_discipline_id in ('mlp-wd','mlp-md','mlp-xd1','mlp-xd2','dreambreaker');
      if v_disc <> 5 then
        v_fail := array_append(v_fail, 'create_path.mlp_catalog=' || v_disc::text);
      end if;
      delete from public.team_tournaments where id = v_header;
      delete from public.canonical_tournaments where id = v_canon;
    end if;
  else
    raise notice 'VERIFY_NOTICE create_path_live_call skipped (no jwt sub); signatures still checked';
  end if;

  if (select count(*)::int from public.team_tournaments) <> v_tt_before then
    v_fail := array_append(v_fail, 'existing_tournaments_mutated');
  end if;
  if (
    select count(*)::int from public.canonical_tournaments where mode = 'team_tournament'
  ) <> v_canon_before then
    v_fail := array_append(v_fail, 'canonical_team_rows_leaked');
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;

  raise notice 'VERIFY_PASS CREATE_PATH_READY=YES existing_headers=% captain_enabled_untouched=%',
    v_tt_before, v_cap_true;
end;
$$;

select
  'CREATE_PATH_READY' as check_name,
  (to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is not null) as ok;

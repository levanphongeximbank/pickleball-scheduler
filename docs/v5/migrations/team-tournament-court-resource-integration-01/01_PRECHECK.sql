-- team-tournament-court-resource-integration-01 / 01_PRECHECK
-- Read-only contract proof. Do not apply 02_APPLY without Owner GO.

do $$
declare
  v_missing text[] := '{}';
  v_body text;
  v_column text;
  v_signature text;
begin
  if to_regclass('public.team_tournament_matchups') is null then
    raise exception 'PRECHECK_FAIL: public.team_tournament_matchups is missing';
  end if;

  foreach v_column in array array[
    'tenant_id', 'tournament_id', 'team_tournament_id', 'external_matchup_id',
    'scheduled_at', 'lineup_lock_at', 'court_label', 'schedule_meta'
  ] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'team_tournament_matchups'
        and column_name = v_column
    ) then
      v_missing := array_append(v_missing, 'team_tournament_matchups.' || v_column);
    end if;
  end loop;

  foreach v_column in array array['court_id', 'cluster_id', 'scheduled_end'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'team_tournament_matchups'
        and column_name = v_column
    ) then
      raise exception 'PRECHECK_FAIL: public.team_tournament_matchups.% already exists', v_column;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.team_tournament_setup_mutation_prepare(text,jsonb,text,integer,text)',
    'public.team_tournament_setup_mutation_bump_version(uuid,integer)',
    'public.team_tournament_setup_mutation_finalize(text,text,uuid,integer,jsonb,text,text,jsonb,uuid)',
    'public.team_tournament_setup_norm_projection(uuid,text,integer)',
    'public.team_tournament_replace_matchups(text,jsonb,integer,text)',
    'public.team_tournament_update_matchup_schedule(text,jsonb,integer,text)',
    'public.team_tournament_apply_schedule_batch(text,jsonb,integer,text)',
    'public.team_tournament_update_setup_config(text,jsonb,integer,text)',
    'public.team_tournament_get_setup(text,text,integer,boolean)',
    'public.team_tournament_get_dashboard(text)',
    'public.team_tournament_resolve_header(text)',
    'public.team_tournament_can_manage()',
    'public.team_tournament_assert_tenant(text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      v_missing := array_append(v_missing, v_signature);
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing dependencies: %', array_to_string(v_missing, ', ');
  end if;

  -- Prove that the deployed replace body is the latest Scenario-B superset.
  v_body := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text,jsonb,integer,text)'::regprocedure
  );
  if position('nextMatchupId' in v_body) = 0
     or position('nextSlot' in v_body) = 0
     or position('competitionStage' in v_body) = 0
     or position('bracketRoundLabel' in v_body) = 0
     or position('UNKNOWN_DISCIPLINE' in v_body) = 0
     or position('CONFIRM_DESTRUCTIVE_REQUIRED' in v_body) = 0 then
    raise exception 'PRECHECK_FAIL: replace_matchups is not the current Scenario-B superset';
  end if;

  -- Prove that setup update includes the newest qualification, tie-break and
  -- scoring-policy contracts before this package wraps it.
  v_body := pg_get_functiondef(
    'public.team_tournament_update_setup_config(text,jsonb,integer,text)'::regprocedure
  );
  if position('qualifiersPerGroup' in v_body) = 0
     or position('INVALID_QUALIFICATION_TOTAL' in v_body) = 0
     or position('stageTieBreakPolicy' in v_body) = 0
     or position('stageScoringPolicy' in v_body) = 0
     or position('scoringMode' in v_body) = 0
     or position('selectedCourtIds' in v_body) = 0 then
    raise exception 'PRECHECK_FAIL: update_setup_config is not the current deployed superset';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_update_matchup_schedule(text,jsonb,integer,text)'::regprocedure
  );
  if position('team_tournament_apply_domain_setup_mutation' in v_body) = 0
     or position('schedule.update' in v_body) = 0 then
    raise exception 'PRECHECK_FAIL: canonical schedule.update wrapper contract changed';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_apply_schedule_batch(text,jsonb,integer,text)'::regprocedure
  );
  if position('team_tournament_apply_domain_setup_mutation' in v_body) = 0
     or position('schedule.batch' in v_body) = 0 then
    raise exception 'PRECHECK_FAIL: canonical schedule.batch wrapper contract changed';
  end if;

  -- Package-private preserved bodies must not already exist.
  foreach v_signature in array array[
    'public.team_tournament_cri01_prior_setup_norm_projection(uuid,text,integer)',
    'public.team_tournament_cri01_prior_replace_matchups(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_update_matchup_schedule(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_apply_schedule_batch(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_update_setup_config(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_get_setup(text,text,integer,boolean)',
    'public.team_tournament_cri01_prior_get_dashboard(text)',
    'public.team_tournament_cri01_apply_schedule(text,jsonb,text,integer,text)',
    'public.team_tournament_cri01_validate_setup_payload(jsonb)'
  ] loop
    if to_regprocedure(v_signature) is not null then
      raise exception 'PRECHECK_FAIL: package helper already exists: %', v_signature;
    end if;
  end loop;

  -- #426 continuation: rename, opaque pairing, and referee assignment remain
  -- independent contracts and must survive this package unchanged.
  foreach v_signature in array array[
    'public.team_tournament_rename(text,text)',
    'public.team_tournament_form_pairing_opaque(text,jsonb,text,text,text,text,boolean)',
    'public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)',
    'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'PRECHECK_FAIL: #426 continuation dependency missing: %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.team_tournament_replace_matchups(text,jsonb,integer,text)',
    'public.team_tournament_update_matchup_schedule(text,jsonb,integer,text)',
    'public.team_tournament_apply_schedule_batch(text,jsonb,integer,text)',
    'public.team_tournament_update_setup_config(text,jsonb,integer,text)',
    'public.team_tournament_get_setup(text,text,integer,boolean)',
    'public.team_tournament_get_dashboard(text)'
  ] loop
    if exists (
      select 1
      from information_schema.role_routine_grants g
      where g.specific_schema = 'public'
        and g.routine_name = split_part(split_part(v_signature, '.', 2), '(', 1)
        and g.privilege_type = 'EXECUTE'
        and g.grantee in ('anon', 'PUBLIC')
    ) then
      raise exception 'PRECHECK_FAIL: anon/PUBLIC execute drift on %', v_signature;
    end if;
    if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'PRECHECK_FAIL: authenticated execute missing on %', v_signature;
    end if;
  end loop;

  raise notice 'PRECHECK_PASS: dependencies, supersets, grants, and #426 continuation proved';
end
$$;

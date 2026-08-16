-- team-tournament-court-resource-integration-01 / 03_VERIFY
-- Structural/read-only verification. No tournament row is mutated.

do $$
declare
  v_body text;
  v_constraint text;
  v_signature text;
  v_column record;
  v_anon_grants integer;
  v_auth_grants integer;
begin
  for v_column in
    select *
    from (values
      ('court_id', 'text'),
      ('cluster_id', 'text'),
      ('scheduled_end', 'timestamp with time zone')
    ) expected(column_name, data_type)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'team_tournament_matchups'
        and c.column_name = v_column.column_name
        and c.data_type = v_column.data_type
        and c.is_nullable = 'YES'
    ) then
      raise exception 'VERIFY_FAIL: column %.% missing or wrong type/nullability',
        'team_tournament_matchups', v_column.column_name;
    end if;
  end loop;

  select pg_get_constraintdef(c.oid)
    into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.team_tournament_matchups'::regclass
    and c.conname = 'team_tournament_matchups_scheduled_interval_chk';
  if v_constraint is null
     or position('scheduled_end > scheduled_at' in lower(v_constraint)) = 0 then
    raise exception 'VERIFY_FAIL: scheduled interval check constraint missing';
  end if;

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
    if to_regprocedure(v_signature) is null then
      raise exception 'VERIFY_FAIL: preserved/private function missing: %', v_signature;
    end if;
  end loop;

  v_body := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text,jsonb,integer,text)'::regprocedure
  );
  if position('scheduled_end' in lower(v_body)) = 0
     or position('court_id' in lower(v_body)) = 0
     or position('cluster_id' in lower(v_body)) = 0
     or position('nextMatchupId' in v_body) = 0
     or position('nextSlot' in v_body) = 0
     or position('competitionStage' in v_body) = 0
     or position('bracketRoundLabel' in v_body) = 0
     or position('UNKNOWN_DISCIPLINE' in v_body) = 0
     or position('CONFIRM_DESTRUCTIVE_REQUIRED' in v_body) = 0
     or position('hashtextextended' in lower(v_body)) = 0
     or position('(a.value->>''scheduledAt'')::timestamptz <' in v_body) = 0
     or position('(b.value->>''scheduledAt'')::timestamptz <' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: replace_matchups lost superset or canonical interval behavior';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_cri01_prior_replace_matchups(text,jsonb,integer,text)'::regprocedure
  );
  if position('nextSlot' in v_body) = 0
     or position('competitionStage' in v_body) = 0
     or position('bracketRoundLabel' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: exact prior replace_matchups superset was not preserved';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_update_setup_config(text,jsonb,integer,text)'::regprocedure
  );
  if position('team_tournament_cri01_prior_update_setup_config' in v_body) = 0
     or position('team_tournament_cri01_validate_setup_payload' in v_body) = 0
     or position('clusterId' in v_body) = 0
     or position('selectedCourtIds' in v_body) = 0
     or position('courtCapacityWindow' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: setup wrapper does not preserve prior superset plus canonical config';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_cri01_prior_update_setup_config(text,jsonb,integer,text)'::regprocedure
  );
  if position('qualifiersPerGroup' in v_body) = 0
     or position('INVALID_QUALIFICATION_TOTAL' in v_body) = 0
     or position('stageTieBreakPolicy' in v_body) = 0
     or position('stageScoringPolicy' in v_body) = 0
     or position('scoringMode' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: exact prior update_setup_config superset was not preserved';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_cri01_validate_setup_payload(jsonb)'::regprocedure
  );
  if position('?& array[' in lower(v_body)) = 0
     or position('v_end <= v_start' in v_body) = 0
     or position('INVALID_CLUSTER_ID' in v_body) = 0
     or position('INVALID_SELECTED_COURT_IDS' in v_body) = 0
     or position('INVALID_COURT_CAPACITY_WINDOW' in v_body) = 0
     or position('coalesce(v_window' in lower(v_body)) > 0 then
    raise exception 'VERIFY_FAIL: setup validation/default-free contract changed';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_cri01_apply_schedule(text,jsonb,text,integer,text)'::regprocedure
  );
  if position('schedule.update' in v_body) = 0
     or position('schedule.batch' in v_body) = 0
     or position('scheduled_end' in lower(v_body)) = 0
     or position('court_id' in lower(v_body)) = 0
     or position('cluster_id' in lower(v_body)) = 0
     or position('a.starts_at < b.ends_at' in lower(v_body)) = 0
     or position('b.starts_at < a.ends_at' in lower(v_body)) = 0
     or position('team_tournament_setup_mutation_finalize' in lower(v_body)) = 0 then
    raise exception 'VERIFY_FAIL: canonical schedule updater is incomplete';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_update_matchup_schedule(text,jsonb,integer,text)'::regprocedure
  );
  if position('team_tournament_cri01_apply_schedule' in v_body) = 0
     or position('schedule.update' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: schedule.update wrapper is not canonical';
  end if;
  v_body := pg_get_functiondef(
    'public.team_tournament_apply_schedule_batch(text,jsonb,integer,text)'::regprocedure
  );
  if position('team_tournament_cri01_apply_schedule' in v_body) = 0
     or position('schedule.batch' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: schedule.batch wrapper is not canonical';
  end if;

  foreach v_signature in array array[
    'public.team_tournament_setup_norm_projection(uuid,text,integer)',
    'public.team_tournament_get_setup(text,text,integer,boolean)',
    'public.team_tournament_get_dashboard(text)'
  ] loop
    v_body := pg_get_functiondef(to_regprocedure(v_signature));
    if position('courtId' in v_body) = 0
       or position('clusterId' in v_body) = 0
       or position('scheduledEnd' in v_body) = 0 then
      raise exception 'VERIFY_FAIL: projection missing canonical matchup fields: %', v_signature;
    end if;
  end loop;

  v_body := pg_get_functiondef(
    'public.team_tournament_setup_norm_projection(uuid,text,integer)'::regprocedure
  );
  if position('selectedCourtIds' in v_body) = 0
     or position('courtCapacityWindow' in v_body) = 0 then
    raise exception 'VERIFY_FAIL: normalized setup projection missing court config';
  end if;

  -- Compatibility is one-way: schedule_meta and court_label remain readable,
  -- but neither can become canonical court_id authority.
  foreach v_signature in array array[
    'public.team_tournament_replace_matchups(text,jsonb,integer,text)',
    'public.team_tournament_cri01_apply_schedule(text,jsonb,text,integer,text)'
  ] loop
    v_body := lower(pg_get_functiondef(to_regprocedure(v_signature)));
    if position('court_id = court_label' in v_body) > 0
       or position('court_id=court_label' in v_body) > 0
       or position('court_id = nullif(v_item->>''courtlabel''' in v_body) > 0
       or position('''courtid'', v_item->>''courtlabel''' in v_body) > 0 then
      raise exception 'VERIFY_FAIL: forbidden courtId=courtLabel promotion in %', v_signature;
    end if;
  end loop;

  -- API grants: anon/PUBLIC denied, authenticated behavior unchanged.
  foreach v_signature in array array[
    'team_tournament_replace_matchups',
    'team_tournament_update_matchup_schedule',
    'team_tournament_apply_schedule_batch',
    'team_tournament_update_setup_config',
    'team_tournament_get_setup',
    'team_tournament_get_dashboard'
  ] loop
    select count(*)::integer into v_anon_grants
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name = v_signature
      and privilege_type = 'EXECUTE'
      and grantee in ('anon', 'PUBLIC');
    select count(*)::integer into v_auth_grants
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name = v_signature
      and privilege_type = 'EXECUTE'
      and grantee = 'authenticated';
    if v_anon_grants <> 0 or v_auth_grants = 0 then
      raise exception 'VERIFY_FAIL: API grant drift on %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'team_tournament_cri01_validate_setup_payload',
    'team_tournament_cri01_apply_schedule',
    'team_tournament_cri01_prior_setup_norm_projection',
    'team_tournament_cri01_prior_replace_matchups',
    'team_tournament_cri01_prior_update_matchup_schedule',
    'team_tournament_cri01_prior_apply_schedule_batch',
    'team_tournament_cri01_prior_update_setup_config',
    'team_tournament_cri01_prior_get_setup',
    'team_tournament_cri01_prior_get_dashboard'
  ] loop
    if exists (
      select 1
      from information_schema.role_routine_grants
      where specific_schema = 'public'
        and routine_name = v_signature
        and privilege_type = 'EXECUTE'
        and grantee in ('anon', 'authenticated', 'PUBLIC')
    ) then
      raise exception 'VERIFY_FAIL: private helper is API-executable: %', v_signature;
    end if;
  end loop;

  -- #426 rename/pairing/referee continuation.
  v_body := pg_get_functiondef('public.team_tournament_rename(text,text)'::regprocedure);
  if position('canonical_tournaments' in lower(v_body)) = 0
     or position('team_tournaments' in lower(v_body)) = 0
     or position('tournament_id' in lower(v_body)) = 0 then
    raise exception 'VERIFY_FAIL: #426 rename continuation changed';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_form_pairing_opaque(text,jsonb,text,text,text,text,boolean)'::regprocedure
  );
  if position('private_pairing_load_active_rules_internal' in lower(v_body)) = 0
     or position('private_pairing_get_active_rules_for_scope' in lower(v_body)) > 0
     or position('team_tournament_can_manage' in lower(v_body)) = 0 then
    raise exception 'VERIFY_FAIL: #426 opaque pairing continuation changed';
  end if;

  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'VERIFY_FAIL: pairing commit continuation missing';
  end if;

  v_body := pg_get_functiondef(
    'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'::regprocedure
  );
  if position('MATCHUP_TEAMS_UNRESOLVED' in v_body) = 0
     or position('referee_v5_assignment_effective_status' in lower(v_body)) = 0
     or position('team_tournament_begin_command' in lower(v_body)) = 0 then
    raise exception 'VERIFY_FAIL: referee continuation changed';
  end if;

  raise notice 'VERIFY_PASS: columns, bodies, grants, projections, intervals, and #426 continuation';
end
$$;

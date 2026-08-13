-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-production-referee-foundation-01
-- LOCAL / Owner GO only. Do NOT apply on Staging/Production without Owner GO.
-- Read-only. STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
--
-- Fail closed. Missing-object diagnostic uses array_append (never text[] || scalar).
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_conflict text[] := '{}';
  v_partial text[] := '{}';
  v_grant text[] := '{}';
  v_table_count int := 0;
  v_fn_count int := 0;
  v_required_cols text[];
  v_col text;
begin
  -- ── Base Team Tournament objects (Production prestate must already have these)
  if to_regclass('public.team_tournaments') is null then
    v_missing := array_append(v_missing, 'team_tournaments');
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
  if to_regprocedure('public.team_tournament_start_dreambreaker(text,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_start_dreambreaker(text,text,integer,text)');
  end if;
  if to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)');
  end if;
  if to_regprocedure('public.is_super_admin()') is null then
    v_missing := array_append(v_missing, 'is_super_admin()');
  end if;
  if to_regprocedure('public.user_venue_id()') is null then
    v_missing := array_append(v_missing, 'user_venue_id()');
  end if;
  if to_regprocedure('public.team_tournament_begin_command(text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_begin_command(text,text,text,text,jsonb)');
  end if;
  if to_regprocedure('public.team_tournament_finish_command(text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_finish_command(text,text,text,text,text,jsonb)');
  end if;
  if to_regprocedure('public.team_tournament_write_audit(text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_write_audit(text,text,text,text,jsonb)');
  end if;
  if to_regclass('public.team_tournament_matchups') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'team_tournament_matchups'
         and column_name = 'requires_republish'
     ) then
    v_missing := array_append(v_missing, 'team_tournament_matchups.requires_republish');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL missing=%', array_to_string(v_missing, ',');
  end if;

  -- Extra overloads of confirm/save/start are allowed. Foundation does not replace them.
  raise notice 'PRECHECK_NOTICE existing_overloads_ignored_for confirm/save/start';

  -- ── Foundation table presence (0 = greenfield, 3 = already-applied, 1-2 = partial)
  if to_regclass('public.referee_assignments') is not null then
    v_table_count := v_table_count + 1;
    v_partial := array_append(v_partial, 'referee_assignments');
  end if;
  if to_regclass('public.match_live_states') is not null then
    v_table_count := v_table_count + 1;
    v_partial := array_append(v_partial, 'match_live_states');
  end if;
  if to_regclass('public.team_sub_match_referee_links') is not null then
    v_table_count := v_table_count + 1;
    v_partial := array_append(v_partial, 'team_sub_match_referee_links');
  end if;

  if v_table_count in (1, 2) then
    raise exception 'PRECHECK_FAIL partial_foundation_state=%', array_to_string(v_partial, ',');
  end if;

  -- ── Conflicting / incomplete table shape
  if v_table_count = 3 then
    v_required_cols := array[
      'id','tenant_id','tournament_id','match_id','referee_user_id','role','status',
      'assigned_at','expires_at','revoked_at','sub_match_id','matchup_id',
      'external_matchup_id','external_sub_match_id','version'
    ];
    foreach v_col in array v_required_cols loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'referee_assignments' and column_name = v_col
      ) then
        v_conflict := array_append(v_conflict, 'referee_assignments.missing_column.' || v_col);
      end if;
    end loop;

    v_required_cols := array[
      'id','tenant_id','tournament_id','match_id','team_a_id','team_b_id',
      'state_payload','state_version','version','status','last_event_sequence',
      'participants','scoring_format','points_to_win','win_by','best_of','scoring_system'
    ];
    foreach v_col in array v_required_cols loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'match_live_states' and column_name = v_col
      ) then
        v_conflict := array_append(v_conflict, 'match_live_states.missing_column.' || v_col);
      end if;
    end loop;

    v_required_cols := array[
      'id','tenant_id','tournament_id','team_tournament_id','matchup_id',
      'external_matchup_id','sub_match_id','external_sub_match_id',
      'referee_match_id','referee_assignment_id','status','snapshot','version'
    ];
    foreach v_col in array v_required_cols loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'team_sub_match_referee_links' and column_name = v_col
      ) then
        v_conflict := array_append(v_conflict, 'team_sub_match_referee_links.missing_column.' || v_col);
      end if;
    end loop;
  end if;

  -- ── Conflicting function signatures (wrong args for the required name)
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_create_referee_assignment'
      and pg_get_function_identity_arguments(p.oid)
        <> 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_referee_user_id uuid, p_expires_at timestamp with time zone, p_activate boolean, p_idempotency_key text, p_reason text'
      and pg_get_function_identity_arguments(p.oid)
        <> 'text, text, text, uuid, timestamp with time zone, boolean, text, text'
  ) then
    -- Allow the required 8-arg form; fail only if a same-name overload exists that is not that form
    -- and the required form is absent.
    if to_regprocedure(
      'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'
    ) is null then
      v_conflict := array_append(v_conflict, 'create_referee_assignment.wrong_signature');
    end if;
  end if;

  if to_regprocedure(
    'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'
  ) is not null then
    v_fn_count := v_fn_count + 1;
  end if;
  if to_regprocedure(
    'public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)'
  ) is not null then
    v_fn_count := v_fn_count + 1;
  end if;
  if to_regprocedure(
    'public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)'
  ) is not null then
    v_fn_count := v_fn_count + 1;
  end if;

  -- Partial functions without tables, or tables without functions
  if v_table_count = 0 and v_fn_count in (1, 2) then
    raise exception 'PRECHECK_FAIL partial_foundation_functions=%', v_fn_count;
  end if;
  if v_table_count = 3 and v_fn_count in (1, 2) then
    raise exception 'PRECHECK_FAIL partial_foundation_functions_with_tables=%', v_fn_count;
  end if;

  -- ── Unexpected anon grants on existing foundation tables
  if v_table_count = 3 and exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'public.referee_assignments', 'insert')
       or has_table_privilege('anon', 'public.referee_assignments', 'update')
       or has_table_privilege('anon', 'public.referee_assignments', 'delete') then
      v_grant := array_append(v_grant, 'anon_write.referee_assignments');
    end if;
    if has_table_privilege('anon', 'public.match_live_states', 'insert')
       or has_table_privilege('anon', 'public.match_live_states', 'update')
       or has_table_privilege('anon', 'public.match_live_states', 'delete') then
      v_grant := array_append(v_grant, 'anon_write.match_live_states');
    end if;
    if has_table_privilege('anon', 'public.team_sub_match_referee_links', 'insert')
       or has_table_privilege('anon', 'public.team_sub_match_referee_links', 'update')
       or has_table_privilege('anon', 'public.team_sub_match_referee_links', 'delete') then
      v_grant := array_append(v_grant, 'anon_write.team_sub_match_referee_links');
    end if;
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.rolname = 'anon'
    where n.nspname = 'public'
      and p.proname in (
        'team_tournament_create_referee_assignment',
        'team_tournament_build_v5_state_shell',
        'team_tournament_provision_eligibility'
      )
      and has_function_privilege('anon', p.oid, 'execute')
  ) then
    v_grant := array_append(v_grant, 'anon_execute.privileged_foundation_rpc');
  end if;

  if array_length(v_conflict, 1) is not null then
    raise exception 'PRECHECK_FAIL conflict=%', array_to_string(v_conflict, ',');
  end if;
  if array_length(v_grant, 1) is not null then
    raise exception 'PRECHECK_FAIL unexpected_grants=%', array_to_string(v_grant, ',');
  end if;

  -- Historical extras may exist; they are not foundation objects. Notice only.
  if to_regclass('public.referee_device_sessions') is not null then
    raise notice 'PRECHECK_NOTICE excluded_historical_table=referee_device_sessions present (not owned by this package)';
  end if;

  -- Final continuation must not already own the runtime helpers if we are applying foundation
  -- onto a schema that already ran canonical-referee-lifecycle-01 (wrong order).
  if to_regprocedure(
    'public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null
     and v_table_count = 0 then
    raise exception 'PRECHECK_FAIL conflict=final_continuation_present_without_foundation_tables';
  end if;

  if v_table_count = 3 and v_fn_count = 3 then
    raise notice 'PRECHECK_PASS already_applied_compatible';
  else
    raise notice 'PRECHECK_PASS greenfield_ready table_count=% fn_count=%', v_table_count, v_fn_count;
  end if;
end;
$$;

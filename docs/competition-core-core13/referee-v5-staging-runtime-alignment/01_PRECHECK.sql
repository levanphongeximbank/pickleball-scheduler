-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: referee-v5-staging-runtime-alignment
-- READ ONLY. Fail closed on unexpected Referee V5 commit signatures.
-- SQL_EXECUTION_GO=NO — author only. Do not execute in this gate.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := array[]::text[];
  v_n integer;
  v_args text;
  v_sec text;
  v_cfg text;
  v_ret text;
begin
  -- Expected V5D32 17-arg commit transition (current canonical).
  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'referee_v5_commit_match_transition';
  if v_n = 0 then
    v_fail := array_append(v_fail, 'missing.referee_v5_commit_match_transition');
  elsif v_n > 1 then
    v_fail := array_append(v_fail, format('overload.referee_v5_commit_match_transition=%s', v_n));
  else
    select pg_get_function_identity_arguments(p.oid),
           case p.prosecdef when true then 'definer' else 'invoker' end,
           coalesce(array_to_string(p.proconfig, ','), ''),
           pg_get_function_result(p.oid)
      into v_args, v_sec, v_cfg, v_ret
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'referee_v5_commit_match_transition';
    if v_args is distinct from
      'p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_command_type text, p_command_payload jsonb, p_expected_state_version integer, p_expected_event_sequence bigint, p_client_mutation_id text, p_idempotency_key text, p_request_hash text, p_next_state jsonb, p_generated_events jsonb, p_state_before_hash text, p_state_after_hash text, p_state_before jsonb, p_staging_fault text'
    then
      v_fail := array_append(v_fail, format('signature.transition=%s', v_args));
    end if;
    if v_sec is distinct from 'definer' then
      v_fail := array_append(v_fail, 'security.transition');
    end if;
    if position('pg_catalog' in v_cfg) = 0 or position('public' in v_cfg) = 0 then
      v_fail := array_append(v_fail, format('search_path.transition=%s', v_cfg));
    end if;
    if v_ret is distinct from 'jsonb' then
      v_fail := array_append(v_fail, format('return.transition=%s', v_ret));
    end if;
    if has_function_privilege(
      'anon',
      'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)',
      'EXECUTE'
    ) then
      v_fail := array_append(v_fail, 'grant.transition.anon');
    end if;
    if has_function_privilege(
      'authenticated',
      'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)',
      'EXECUTE'
    ) then
      v_fail := array_append(v_fail, 'grant.transition.authenticated');
    end if;
    if not has_function_privilege(
      'service_role',
      'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)',
      'EXECUTE'
    ) then
      v_fail := array_append(v_fail, 'grant.transition.service_role.missing');
    end if;
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'referee_v5_commit_match_finalization';
  if v_n = 0 then
    v_fail := array_append(v_fail, 'missing.referee_v5_commit_match_finalization');
  elsif v_n > 1 then
    v_fail := array_append(v_fail, format('overload.referee_v5_commit_match_finalization=%s', v_n));
  else
    select pg_get_function_identity_arguments(p.oid)
      into v_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'referee_v5_commit_match_finalization';
    if v_args is distinct from
      'p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_expected_state_version integer, p_idempotency_key text, p_request_hash text, p_revision jsonb, p_outbox_events jsonb, p_override_reason text, p_staging_fault text'
    then
      v_fail := array_append(v_fail, format('signature.finalization=%s', v_args));
    end if;
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'referee_v5_initialize_match_execution_state';
  if v_n <> 1 then
    v_fail := array_append(v_fail, format('initialize_execution.count=%s', v_n));
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'REFEREE_V5_STAGING_PRECHECK_FAILED: %', array_to_string(v_fail, ', ');
  end if;

  raise notice 'REFEREE_V5_STAGING_PRECHECK_PASS';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: referee-v5-staging-runtime-alignment
-- READ ONLY. Exact signatures, grants, security definer, search_path,
-- overload count, required START_MATCH / SCORE / PAUSE / FINALIZE deps.
-- SQL_EXECUTION_GO=NO — author only. Do not execute in this gate.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := array[]::text[];
  v_n integer;
  v_args text;
  v_sec text;
  v_cfg text;
begin
  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'referee_v5_commit_match_transition';
  if v_n is distinct from 1 then
    v_fail := array_append(v_fail, format('overload.transition=%s', v_n));
  end if;

  select pg_get_function_identity_arguments(p.oid),
         case p.prosecdef when true then 'definer' else 'invoker' end,
         coalesce(array_to_string(p.proconfig, ','), '')
    into v_args, v_sec, v_cfg
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'referee_v5_commit_match_transition';

  if v_args is distinct from
    'p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_command_type text, p_command_payload jsonb, p_expected_state_version integer, p_expected_event_sequence bigint, p_client_mutation_id text, p_idempotency_key text, p_request_hash text, p_next_state jsonb, p_generated_events jsonb, p_state_before_hash text, p_state_after_hash text, p_state_before jsonb, p_staging_fault text'
  then
    v_fail := array_append(v_fail, format('signature.transition=%s', v_args));
  end if;
  if v_sec is distinct from 'definer' then
    v_fail := array_append(v_fail, 'security.transition');
  end if;
  if position('search_path=pg_catalog, public' in v_cfg) = 0
     and position('search_path=pg_catalog,public' in replace(v_cfg, ' ', '')) = 0 then
    if position('pg_catalog' in v_cfg) = 0 or position('public' in v_cfg) = 0 then
      v_fail := array_append(v_fail, format('search_path.transition=%s', v_cfg));
    end if;
  end if;

  if has_function_privilege('public', 'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.transition.public');
  end if;
  if has_function_privilege('anon', 'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.transition.anon');
  end if;
  if has_function_privilege('authenticated', 'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.transition.authenticated');
  end if;
  if not has_function_privilege('service_role', 'public.referee_v5_commit_match_transition(text,text,text,uuid,text,jsonb,integer,bigint,text,text,text,jsonb,jsonb,text,text,jsonb,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.transition.service_role.missing');
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'referee_v5_commit_match_finalization';
  if v_n is distinct from 1 then
    v_fail := array_append(v_fail, format('overload.finalization=%s', v_n));
  end if;
  if not has_function_privilege('service_role', 'public.referee_v5_commit_match_finalization(text,text,text,uuid,integer,text,text,jsonb,jsonb,text,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.finalization.service_role.missing');
  end if;
  if has_function_privilege('anon', 'public.referee_v5_commit_match_finalization(text,text,text,uuid,integer,text,text,jsonb,jsonb,text,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.finalization.anon');
  end if;
  if has_function_privilege('authenticated', 'public.referee_v5_commit_match_finalization(text,text,text,uuid,integer,text,text,jsonb,jsonb,text,text)', 'EXECUTE') then
    v_fail := array_append(v_fail, 'grant.finalization.authenticated');
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'referee_v5_initialize_match_execution_state';
  if v_n is distinct from 1 then
    v_fail := array_append(v_fail, format('initialize_execution.count=%s', v_n));
  end if;

  if to_regclass('public.match_live_states') is null then
    v_fail := array_append(v_fail, 'missing.match_live_states');
  end if;
  if to_regclass('public.match_events') is null then
    v_fail := array_append(v_fail, 'missing.match_events');
  end if;
  if to_regclass('public.referee_assignments') is null then
    v_fail := array_append(v_fail, 'missing.referee_assignments');
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'REFEREE_V5_STAGING_VERIFY_FAILED: %', array_to_string(v_fail, ', ');
  end if;

  raise notice 'REFEREE_V5_STAGING_VERIFY_PASS';
end;
$$;

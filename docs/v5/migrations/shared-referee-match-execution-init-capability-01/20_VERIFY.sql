-- ═══════════════════════════════════════════════════════════════════
-- 20_VERIFY.sql
-- Package: shared-referee-match-execution-init-capability-01
-- LOCAL AUTHORING ONLY. Do NOT execute on Staging/Production.
-- SQL_EXECUTED=NO  STAGING_MUTATIONS=0  PRODUCTION_MUTATIONS=0
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := '{}';
  v_reg text := 'public.referee_v5_initialize_match_execution_state(text,text,text,text,text,text,text,jsonb,text,text)';
begin
  if to_regprocedure(v_reg) is null then
    v_fail := array_append(v_fail, 'missing.function');
  else
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'referee_v5_initialize_match_execution_state'
        and p.prosecdef = true
    ) then
      v_fail := array_append(v_fail, 'not.security_definer');
    end if;

    if has_function_privilege('anon', v_reg::regprocedure, 'execute') then
      v_fail := array_append(v_fail, 'grant.anon');
    end if;
    if has_function_privilege('authenticated', v_reg::regprocedure, 'execute') then
      v_fail := array_append(v_fail, 'grant.authenticated');
    end if;
    if has_function_privilege('public', v_reg::regprocedure, 'execute') then
      v_fail := array_append(v_fail, 'grant.public');
    end if;
    if not has_function_privilege('service_role', v_reg::regprocedure, 'execute') then
      v_fail := array_append(v_fail, 'missing.grant.service_role');
    end if;
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;

  raise notice 'VERIFY_PASS referee_v5_initialize_match_execution_state service_role only';
end;
$$;

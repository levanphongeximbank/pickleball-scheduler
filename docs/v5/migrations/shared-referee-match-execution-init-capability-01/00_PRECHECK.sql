-- ═══════════════════════════════════════════════════════════════════
-- 00_PRECHECK.sql
-- Package: shared-referee-match-execution-init-capability-01
-- LOCAL AUTHORING ONLY. Do NOT execute on Staging/Production.
-- SQL_EXECUTED=NO  STAGING_MUTATIONS=0  PRODUCTION_MUTATIONS=0
-- Read-only precheck. NEW_SCHEMA is not required.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
  v_col text;
begin
  if to_regclass('public.match_live_states') is null then
    v_missing := array_append(v_missing, 'match_live_states');
  end if;
  if to_regclass('public.match_sync_mutations') is null then
    v_missing := array_append(v_missing, 'match_sync_mutations');
  end if;
  if to_regprocedure('public.referee_v5_match_state_id(text,text,text)') is null then
    v_missing := array_append(v_missing, 'referee_v5_match_state_id');
  end if;

  foreach v_col in array array['state_payload', 'state_version', 'version', 'status', 'last_event_sequence']
  loop
    if to_regclass('public.match_live_states') is not null
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'match_live_states'
           and column_name = v_col
       ) then
      v_missing := array_append(v_missing, 'match_live_states.' || v_col);
    end if;
  end loop;

  foreach v_col in array array['request_hash', 'match_id', 'response_payload']
  loop
    if to_regclass('public.match_sync_mutations') is not null
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'match_sync_mutations'
           and column_name = v_col
       ) then
      v_missing := array_append(v_missing, 'match_sync_mutations.' || v_col);
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL missing=%', array_to_string(v_missing, ',');
  end if;

  raise notice 'PRECHECK_PASS shared referee match execution init prerequisites present';
end;
$$;

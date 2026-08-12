-- Daily Play end-to-end canonical remediation: post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Read-only. Run only after an approved APPLY; this implementation run did not apply Staging.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_rpc text;
  v_sig text;
BEGIN
  IF to_regclass('public.daily_play_court_leases') IS NULL THEN
    v_missing := array_append(v_missing, 'daily_play_court_leases');
  END IF;
  IF to_regclass('public.daily_play_command_ledger') IS NULL THEN
    v_missing := array_append(v_missing, 'daily_play_command_ledger');
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.daily_play_get_state(text,text,uuid)',
    'public.daily_play_check_in(text,text,uuid,text,integer,text)',
    'public.daily_play_check_out(text,text,uuid,text,integer,text)',
    'public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)',
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)',
    'public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)',
    'public.daily_play_cancel_match(text,text,uuid,text,integer,text)',
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      v_missing := array_append(v_missing, v_sig);
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing objects: %', array_to_string(v_missing, ', ');
  END IF;

  IF to_regclass('public.daily_play_courts') IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: forbidden daily_play_courts inventory table exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public' AND tablename='daily_play_court_leases'
      AND indexname='daily_play_court_leases_one_active_court_uidx'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%tenant_id, club_id, court_id%'
      AND indexdef ILIKE '%WHERE (status = ''active''%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: active court partial unique index missing or malformed';
  END IF;

  FOREACH v_rpc IN ARRAY ARRAY[
    'daily_play_get_state','daily_play_check_in','daily_play_check_out',
    'daily_play_create_matches','daily_play_assign_court','daily_play_submit_score',
    'daily_play_cancel_match','daily_play_change_court'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=v_rpc AND p.prosecdef
        AND coalesce(array_to_string(p.proconfig,','),'') ILIKE '%search_path=public%'
    ) THEN
      RAISE EXCEPTION 'VERIFY_FAIL: % is not SECURITY DEFINER with search_path=public', v_rpc;
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.daily_play_get_state(text,text,uuid)',
    'public.daily_play_check_in(text,text,uuid,text,integer,text)',
    'public.daily_play_check_out(text,text,uuid,text,integer,text)',
    'public.daily_play_create_matches(text,text,uuid,jsonb,integer,integer,text)',
    'public.daily_play_assign_court(text,text,uuid,text,text,integer,text)',
    'public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)',
    'public.daily_play_cancel_match(text,text,uuid,text,integer,text)',
    'public.daily_play_change_court(text,text,uuid,text,text,integer,text)'
  ] LOOP
    IF NOT has_function_privilege('authenticated',v_sig,'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on %', v_sig;
    END IF;
    -- anon receives PUBLIC privileges, so this also detects an accidental
    -- default PUBLIC EXECUTE grant.
    IF has_function_privilege('anon',v_sig,'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY_FAIL: anon/PUBLIC can execute %', v_sig;
    END IF;
  END LOOP;

  IF has_table_privilege('anon','public.daily_play_court_leases','SELECT')
     OR has_table_privilege('authenticated','public.daily_play_court_leases','SELECT')
     OR has_table_privilege('anon','public.daily_play_command_ledger','SELECT')
     OR has_table_privilege('authenticated','public.daily_play_command_ledger','SELECT') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: client role has direct table access';
  END IF;

  RAISE NOTICE 'VERIFY_OK: Daily Play canonical objects, CAS RPCs, index, and grants installed';
END
$$;

SELECT
  'COURT_INVENTORY_SSOT' AS check_item,
  'public.club_data_v3.data.courts' AS value,
  position(
    'club_data_v3' IN pg_get_functiondef(
      'public.daily_play_read_courts(text,jsonb)'::regprocedure
    )
  ) > 0 AS ok;

SELECT
  'ACTIVE_LEASE_UNIQUE_INDEX' AS check_item,
  indexdef AS value,
  true AS ok
FROM pg_indexes
WHERE schemaname='public' AND tablename='daily_play_court_leases'
  AND indexname='daily_play_court_leases_one_active_court_uidx';

SELECT
  'RPC_GRANTS_AUTHENTICATED_ONLY' AS check_item,
  p.proname AS value,
  has_function_privilege(
    'authenticated', p.oid, 'EXECUTE'
  )
  AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'daily_play_get_state','daily_play_check_in','daily_play_check_out',
    'daily_play_create_matches','daily_play_assign_court','daily_play_submit_score',
    'daily_play_cancel_match','daily_play_change_court'
  )
ORDER BY p.proname;

SELECT 'STAGING_APPLIED_BY_THIS_RUN' AS check_item, 'NO' AS value, true AS ok;

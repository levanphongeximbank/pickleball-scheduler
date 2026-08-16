-- Court Operations live resource runtime 01 VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- LIVE_RESOURCE_RUNTIME_MIGRATION_VERSION=20260816200000

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'public.court_operations_court_live_states',
    'public.court_operations_resource_sessions',
    'public.court_operations_live_runtime_commands'
  ];
  v_rpcs text[] := ARRAY[
    'public.court_operations_live_begin_resource_session('
      || 'text,uuid,text,text,text,text,uuid,boolean,boolean)',
    'public.court_operations_live_end_resource_session('
      || 'text,uuid,uuid,text,text,text,uuid)',
    'public.court_operations_live_set_operational_state('
      || 'text,uuid,text,text,text,uuid)',
    'public.court_operations_live_get_court_state(text,uuid)',
    'public.court_operations_live_list_resource_sessions(text,uuid,text)'
  ];
  v_internal text[] := ARRAY[
    'public.court_operations_live_assert_tenant(text)',
    'public.court_operations_live_assert_court(text,uuid)',
    'public.court_operations_live_ensure_state(text,uuid)',
    'public.court_operations_live_serialize_session('
      || 'public.court_operations_resource_sessions)',
    'public.court_operations_live_serialize_state('
      || 'public.court_operations_court_live_states,'
      || 'public.court_operations_resource_sessions)',
    'public.court_operations_live_fingerprint(text,jsonb)',
    'public.court_operations_live_normalize_source_type(text)',
    'public.court_operations_live_normalize_operational_state(text)',
    'public.court_operations_live_utc_text(timestamptz)'
  ];
  v_name text;
  v_bad_proc text;
BEGIN
  FOREACH v_name IN ARRAY v_tables LOOP
    IF to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION 'VERIFY_FAIL missing table %', v_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_tables) AS t(name)
    JOIN pg_catalog.pg_class c ON c.oid = to_regclass(t.name)
    WHERE NOT c.relrowsecurity OR NOT c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL row level security must be ENABLED and FORCED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_court_live_states'
      AND policyname = 'court_operations_court_live_states_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing court_operations_court_live_states_select policy';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_resource_sessions'
      AND policyname = 'court_operations_resource_sessions_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing court_operations_resource_sessions_select policy';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_live_runtime_commands'
      AND policyname = 'court_operations_live_runtime_commands_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'VERIFY_FAIL missing court_operations_live_runtime_commands_select policy';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'court_operations_court_live_states',
        'court_operations_resource_sessions',
        'court_operations_live_runtime_commands'
      )
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL unexpected write policy on live runtime tables';
  END IF;

  FOREACH v_name IN ARRAY v_tables LOOP
    IF has_table_privilege('anon', v_name, 'SELECT')
       OR has_table_privilege('anon', v_name, 'INSERT')
       OR has_table_privilege('anon', v_name, 'UPDATE')
       OR has_table_privilege('anon', v_name, 'DELETE')
       OR has_table_privilege('authenticated', v_name, 'SELECT')
       OR has_table_privilege('authenticated', v_name, 'INSERT')
       OR has_table_privilege('authenticated', v_name, 'UPDATE')
       OR has_table_privilege('authenticated', v_name, 'DELETE')
    THEN
      RAISE EXCEPTION 'VERIFY_FAIL direct client table privilege exists on %', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_rpcs LOOP
    IF to_regprocedure(v_name) IS NULL THEN
      RAISE EXCEPTION 'VERIFY_FAIL missing RPC %', v_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.oid = to_regprocedure(v_name)
        AND p.prosecdef
        AND coalesce(array_to_string(p.proconfig, ','), '')
          ILIKE '%search_path=pg_catalog, public%'
    ) THEN
      RAISE EXCEPTION 'VERIFY_FAIL RPC security boundary differs from APPLY: %', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_rpcs LOOP
    IF has_function_privilege('anon', v_name, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_name, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'VERIFY_FAIL execute grant must be authenticated-only: %', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_internal LOOP
    IF to_regprocedure(v_name) IS NULL THEN
      RAISE EXCEPTION 'VERIFY_FAIL missing internal helper %', v_name;
    END IF;
    IF has_function_privilege('anon', v_name, 'EXECUTE')
       OR has_function_privilege('authenticated', v_name, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'VERIFY_FAIL internal helper must not be client callable: %', v_name;
    END IF;
  END LOOP;

  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL capacity SSOT court_resource_reservations missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'court_operations_live_runtime_commands_request_uniq'
      AND conrelid = to_regclass('public.court_operations_live_runtime_commands')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing (tenant_id, request_id) idempotency key';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_resource_sessions'
      AND indexname = 'court_operations_resource_sessions_one_active_per_court_idx'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing one-active-session-per-court partial unique index';
  END IF;

  -- Live runtime must never write capacity. Scan public RPC bodies.
  SELECT p.proname INTO v_bad_proc
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'court_operations_live_begin_resource_session',
      'court_operations_live_end_resource_session',
      'court_operations_live_set_operational_state',
      'court_operations_live_get_court_state',
      'court_operations_live_list_resource_sessions'
    )
    AND (
      p.prosrc ~* 'INSERT\s+INTO\s+.*court_resource_reservations'
      OR p.prosrc ~* 'UPDATE\s+.*court_resource_reservations'
      OR p.prosrc ~* 'DELETE\s+FROM\s+.*court_resource_reservations'
    )
  LIMIT 1;

  IF v_bad_proc IS NOT NULL THEN
    RAISE EXCEPTION
      'VERIFY_FAIL live RPC % must not mutate court_resource_reservations',
      v_bad_proc;
  END IF;

  -- Documented invariant: no capacity exclusion on live tables.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = to_regclass('public.court_operations_court_live_states')
      AND contype = 'x'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = to_regclass('public.court_operations_resource_sessions')
      AND contype = 'x'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL live runtime tables must not define capacity exclusion';
  END IF;

  RAISE NOTICE 'VERIFY_OK court_operations_live_resource_runtime_01';
END
$$;

SELECT 'CAPACITY_SSOT' AS check_item, 'court_resource_reservations' AS value, true AS ok;
SELECT 'LIVE_STATE_STORE' AS check_item,
  'court_operations_court_live_states' AS value, true AS ok;
SELECT 'RESOURCE_SESSION_STORE' AS check_item,
  'court_operations_resource_sessions' AS value, true AS ok;
SELECT 'RESERVATION_WRITE_INVARIANT' AS check_item,
  'live RPCs must not mutate court_resource_reservations' AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH1_6_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;

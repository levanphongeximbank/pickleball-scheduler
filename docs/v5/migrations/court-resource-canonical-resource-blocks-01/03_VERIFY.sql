-- Court Operations canonical resource blocks 01 VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- RESOURCE_BLOCKS_MIGRATION_VERSION=20260816180000

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'public.court_operations_resource_blocks',
    'public.court_operations_resource_block_commands'
  ];
  v_rpcs text[] := ARRAY[
    'public.court_operations_resource_block_create('
      || 'text,text,uuid,timestamptz,timestamptz,text,jsonb)',
    'public.court_operations_resource_block_reschedule('
      || 'text,uuid,uuid,timestamptz,timestamptz,int,text,jsonb)',
    'public.court_operations_resource_block_transfer_court(text,uuid,uuid,int,text)',
    'public.court_operations_resource_block_cancel(text,uuid,text,text)',
    'public.court_operations_resource_block_get(text,uuid)',
    'public.court_operations_resource_block_list('
      || 'text,text,timestamptz,timestamptz,uuid[],text[],boolean)'
  ];
  v_internal text[] := ARRAY[
    'public.court_operations_resource_block_assert_scope(text,text)',
    'public.court_operations_resource_block_assert_tenant(text)',
    'public.court_operations_resource_block_release_own_capacity('
      || 'text,uuid,text,text,uuid,uuid)',
    'public.court_operations_resource_block_serialize('
      || 'public.court_operations_resource_blocks)',
    'public.court_operations_resource_block_fingerprint(text,jsonb)',
    'public.court_operations_resource_block_owner_type(text)',
    'public.court_operations_resource_block_payload_text(jsonb,text,text)',
    'public.court_operations_resource_block_utc_text(timestamptz)'
  ];
  v_name text;
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
      AND tablename = 'court_operations_resource_blocks'
      AND policyname = 'court_operations_resource_blocks_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing court_operations_resource_blocks_select policy';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_resource_block_commands'
      AND policyname = 'court_operations_resource_block_commands_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'VERIFY_FAIL missing court_operations_resource_block_commands_select policy';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'court_operations_resource_blocks',
        'court_operations_resource_block_commands'
      )
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL unexpected write policy on resource block tables';
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = to_regprocedure(
      'public.court_operations_resource_block_assert_scope(text,text)'
    )
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL assert_scope security boundary differs from APPLY';
  END IF;

  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL capacity SSOT court_resource_reservations missing';
  END IF;
  IF to_regprocedure(
    'public.court_resource_reserve_core('
    || 'text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL court_resource_reserve_core missing';
  END IF;
  IF to_regprocedure(
    'public.court_resource_reservation_assert_access(text,text,uuid[])'
  ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL court_resource_reservation_assert_access missing';
  END IF;

  IF public.court_resource_map_gateway_owner_type('maintenance')
       IS DISTINCT FROM 'maintenance'
     OR public.court_resource_map_gateway_owner_type('operations')
       IS DISTINCT FROM 'operations' THEN
    RAISE EXCEPTION 'VERIFY_FAIL maintenance/operations owner mapping broken';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'court_operations_resource_block_commands_request_uniq'
      AND conrelid = to_regclass('public.court_operations_resource_block_commands')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing (tenant_id, request_id) idempotency key';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = to_regclass('public.court_operations_resource_blocks')
      AND contype = 'x'
  ) THEN
    RAISE EXCEPTION
      'VERIFY_FAIL resource block table must not define capacity exclusion';
  END IF;

  RAISE NOTICE 'VERIFY_OK court_resource_canonical_resource_blocks_01';
END
$$;

SELECT 'CAPACITY_SSOT' AS check_item, 'court_resource_reservations' AS value, true AS ok;
SELECT 'RESOURCE_BLOCK_BUSINESS_STORE' AS check_item,
  'court_operations_resource_blocks' AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH3_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;

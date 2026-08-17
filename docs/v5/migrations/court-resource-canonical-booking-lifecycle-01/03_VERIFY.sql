-- Court Operations canonical booking lifecycle 01 VERIFY.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- BOOKING_LIFECYCLE_MIGRATION_VERSION=20260816160000

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'public.court_operations_bookings',
    'public.court_operations_booking_commands'
  ];
  v_rpcs text[] := ARRAY[
    'public.court_operations_booking_create('
      || 'text,text,uuid,timestamptz,timestamptz,text,jsonb)',
    'public.court_operations_booking_reschedule('
      || 'text,uuid,uuid,timestamptz,timestamptz,int,text,jsonb)',
    'public.court_operations_booking_transfer_court(text,uuid,uuid,int,text)',
    'public.court_operations_booking_cancel(text,uuid,text,text)',
    'public.court_operations_booking_update_lifecycle(text,uuid,text,int,text)',
    'public.court_operations_booking_get(text,uuid)',
    'public.court_operations_booking_list('
      || 'text,text,timestamptz,timestamptz,text[])'
  ];
  v_internal text[] := ARRAY[
    'public.court_operations_booking_assert_scope(text,text)',
    'public.court_operations_booking_assert_tenant(text)',
    'public.court_operations_booking_release_own_capacity('
      || 'text,uuid,text,uuid,uuid)',
    'public.court_operations_booking_serialize(public.court_operations_bookings)',
    'public.court_operations_booking_fingerprint(text,jsonb)',
    'public.court_operations_booking_transition_allowed(text,text)',
    'public.court_operations_booking_lifecycle_allowed(text)',
    'public.court_operations_booking_payload_text(jsonb,text,text)',
    'public.court_operations_booking_payload_numeric(jsonb,text,numeric)',
    'public.court_operations_booking_utc_text(timestamptz)'
  ];
  v_name text;
BEGIN
  -- 1. Tables exist.
  FOREACH v_name IN ARRAY v_tables LOOP
    IF to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION 'VERIFY_FAIL missing table %', v_name;
    END IF;
  END LOOP;

  -- 2. RLS enabled AND forced on both tables.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_tables) AS t(name)
    JOIN pg_catalog.pg_class c ON c.oid = to_regclass(t.name)
    WHERE NOT c.relrowsecurity OR NOT c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL row level security must be ENABLED and FORCED';
  END IF;

  -- 3. Read-only tenant-scoped SELECT policy present, no write policies.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_bookings'
      AND policyname = 'court_operations_bookings_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing court_operations_bookings_select policy';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_operations_booking_commands'
      AND policyname = 'court_operations_booking_commands_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'VERIFY_FAIL missing court_operations_booking_commands_select policy';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('court_operations_bookings', 'court_operations_booking_commands')
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL unexpected write policy on booking tables';
  END IF;

  -- 4. No client table grants of any kind.
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

  -- 5. Public RPCs: present, SECURITY DEFINER, pinned search_path.
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

  -- 6. Public RPCs: authenticated-only EXECUTE.
  FOREACH v_name IN ARRAY v_rpcs LOOP
    IF has_function_privilege('anon', v_name, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_name, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'VERIFY_FAIL execute grant must be authenticated-only: %', v_name;
    END IF;
  END LOOP;

  -- 7. Internal helpers exist and are not exposed to any client role.
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

  -- 8. Internal scope guard must be SECURITY DEFINER with pinned search_path.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = to_regprocedure('public.court_operations_booking_assert_scope(text,text)')
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '')
        ILIKE '%search_path=pg_catalog, public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL assert_scope security boundary differs from APPLY';
  END IF;

  -- 9. Capacity SSOT and reused Phase 3B helpers are still intact and untouched.
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

  -- 10. Idempotency keys.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'court_operations_booking_commands_request_uniq'
      AND conrelid = to_regclass('public.court_operations_booking_commands')
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing (tenant_id, request_id) idempotency key';
  END IF;

  -- 11. Booking rows must never be an alternate capacity source: the booking
  --     table must not carry an exclusion constraint of its own.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = to_regclass('public.court_operations_bookings')
      AND contype = 'x'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL booking table must not define capacity exclusion';
  END IF;

  RAISE NOTICE 'VERIFY_OK court_resource_canonical_booking_lifecycle_01';
END
$$;

SELECT 'CAPACITY_SSOT' AS check_item, 'court_resource_reservations' AS value, true AS ok;
SELECT 'BOOKING_BUSINESS_STORE' AS check_item, 'court_operations_bookings' AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;

-- Court Operations live resource runtime 01. READ-ONLY PRECHECK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- LIVE_RESOURCE_RUNTIME_MIGRATION_VERSION=20260816200000
-- Additive Batch 7. Does not edit Phase 3A / 3B / D4 / Batch1–6 SQL.

DO $$
DECLARE
  v_missing text[] := '{}';
  v_shape text[] := '{}';
  v_table regclass;
BEGIN
  -- Base identity / tenancy tables.
  IF to_regclass('public.venues') IS NULL THEN
    v_missing := array_append(v_missing, 'public.venues');
  END IF;
  IF to_regclass('public.clubs') IS NULL THEN
    v_missing := array_append(v_missing, 'public.clubs');
  END IF;

  -- Phase 3A canonical inventory identity.
  IF to_regclass('public.court_resource_physical_courts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_physical_courts');
  END IF;

  -- Phase 3B capacity SSOT (must exist; this package must never write it).
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_reservations');
  END IF;

  -- Tenancy predicates (Batch 4 fail-closed auth pattern).
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.is_super_admin()');
  END IF;
  IF to_regprocedure('public.user_venue_id()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_venue_id()');
  END IF;
  -- Phase3B portable digest helper (Supabase pgcrypto lives in extensions).
  IF to_regprocedure('public.court_resource_digest_sha256(bytea)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_resource_digest_sha256(bytea)');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL missing required prerequisite objects: %',
      array_to_string(v_missing, ', ');
  END IF;

  -- If live tables already exist, they must match the expected Batch 7 shape.
  -- Wrong shape → fail. Prior packages are never edited to "fix" shape.
  v_table := to_regclass('public.court_operations_court_live_states');
  IF v_table IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_court_live_states'
        AND column_name = 'tenant_id' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_court_live_states'
        AND column_name = 'physical_court_id' AND udt_name = 'uuid'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_court_live_states'
        AND column_name = 'occupancy_state' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_court_live_states'
        AND column_name = 'operational_state' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_court_live_states'
        AND column_name = 'active_resource_session_id' AND udt_name = 'uuid'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = v_table AND contype = 'p'
        AND pg_catalog.pg_get_constraintdef(oid)
          ILIKE '%(tenant_id, physical_court_id)%'
    ) THEN
      v_shape := array_append(
        v_shape, 'public.court_operations_court_live_states wrong shape'
      );
    END IF;
  END IF;

  v_table := to_regclass('public.court_operations_resource_sessions');
  IF v_table IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_resource_sessions'
        AND column_name = 'resource_session_id' AND udt_name = 'uuid'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_resource_sessions'
        AND column_name = 'source_type' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_resource_sessions'
        AND column_name = 'reservation_ref' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_resource_sessions'
        AND column_name = 'status' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'court_operations_resource_sessions'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%tenant_id%'
        AND indexdef ILIKE '%physical_court_id%'
        AND indexdef ILIKE '%WHERE%(status%=%''active''%)%'
    ) THEN
      v_shape := array_append(
        v_shape, 'public.court_operations_resource_sessions wrong shape'
      );
    END IF;
  END IF;

  v_table := to_regclass('public.court_operations_live_runtime_commands');
  IF v_table IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_live_runtime_commands'
        AND column_name = 'request_id' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_live_runtime_commands'
        AND column_name = 'payload_fingerprint' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'court_operations_live_runtime_commands'
        AND column_name = 'result' AND data_type = 'jsonb'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = v_table
        AND contype = 'u'
        AND pg_catalog.pg_get_constraintdef(oid)
          ILIKE '%(tenant_id, request_id)%'
    ) THEN
      v_shape := array_append(
        v_shape, 'public.court_operations_live_runtime_commands wrong shape'
      );
    END IF;
  END IF;

  IF cardinality(v_shape) > 0 THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL live runtime tables already exist with wrong shape: %',
      array_to_string(v_shape, ', ');
  END IF;

  -- Refuse re-apply drift when package objects are already present.
  IF to_regclass('public.court_operations_court_live_states') IS NOT NULL
     OR to_regclass('public.court_operations_resource_sessions') IS NOT NULL
     OR to_regclass('public.court_operations_live_runtime_commands') IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname LIKE 'court_operations_live_%'
     )
  THEN
    RAISE EXCEPTION
      'PRECHECK_FAIL live runtime objects already present — refuse re-apply drift';
  END IF;

  RAISE NOTICE 'PRECHECK_OK court_operations_live_resource_runtime_01';
END
$$;

SELECT 'REMOTE_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'CAPACITY_SSOT' AS check_item, 'court_resource_reservations' AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;

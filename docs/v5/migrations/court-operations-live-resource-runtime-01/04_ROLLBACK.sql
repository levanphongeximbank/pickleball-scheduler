-- Court Operations live resource runtime 01 ROLLBACK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- LIVE_RESOURCE_RUNTIME_MIGRATION_VERSION=20260816200000
--
-- Drops ONLY objects created by this package. Does not touch Phase 3A,
-- Phase 3B, D4, or Batch 1–6 objects, and does not delete any row in
-- public.court_resource_reservations.
--
-- Ordering matters:
--   1. Public RPCs and helpers first (serialize takes table composite types).
--   2. Drop live_states before sessions (active_resource_session_id FK).
--   3. Commands ledger anytime after RPCs.
--
-- No CASCADE is used anywhere here, so this rollback can never delete capacity
-- data.

BEGIN;

-- 1. Public RPCs.
DROP FUNCTION IF EXISTS public.court_operations_live_list_resource_sessions(
  text, uuid, text
);
DROP FUNCTION IF EXISTS public.court_operations_live_get_court_state(text, uuid);
DROP FUNCTION IF EXISTS public.court_operations_live_set_operational_state(
  text, uuid, text, text, text, uuid
);
DROP FUNCTION IF EXISTS public.court_operations_live_end_resource_session(
  text, uuid, uuid, text, text, text, uuid
);
DROP FUNCTION IF EXISTS public.court_operations_live_begin_resource_session(
  text, uuid, text, text, text, text, uuid, boolean, boolean
);

-- 2. Internal helpers.
DROP FUNCTION IF EXISTS public.court_operations_live_ensure_state(text, uuid);
DROP FUNCTION IF EXISTS public.court_operations_live_assert_court(text, uuid);
DROP FUNCTION IF EXISTS public.court_operations_live_assert_tenant(text);
DROP FUNCTION IF EXISTS public.court_operations_live_serialize_state(
  public.court_operations_court_live_states,
  public.court_operations_resource_sessions
);
DROP FUNCTION IF EXISTS public.court_operations_live_serialize_session(
  public.court_operations_resource_sessions
);
DROP FUNCTION IF EXISTS public.court_operations_live_normalize_operational_state(text);
DROP FUNCTION IF EXISTS public.court_operations_live_normalize_source_type(text);
DROP FUNCTION IF EXISTS public.court_operations_live_fingerprint(text, jsonb);
DROP FUNCTION IF EXISTS public.court_operations_live_utc_text(timestamptz);

-- 3. Tables (live_states before sessions due to FK).
DROP TABLE IF EXISTS public.court_operations_live_runtime_commands;
ALTER TABLE IF EXISTS public.court_operations_court_live_states
  DROP CONSTRAINT IF EXISTS court_operations_court_live_states_active_resource_session_id_fkey;
ALTER TABLE IF EXISTS public.court_operations_court_live_states
  DROP CONSTRAINT IF EXISTS court_operations_court_live_states_physical_court_id_fkey;
ALTER TABLE IF EXISTS public.court_operations_court_live_states
  DROP CONSTRAINT IF EXISTS court_operations_court_live_states_tenant_id_fkey;
DROP TABLE IF EXISTS public.court_operations_court_live_states;

ALTER TABLE IF EXISTS public.court_operations_resource_sessions
  DROP CONSTRAINT IF EXISTS court_operations_resource_sessions_physical_court_id_fkey;
ALTER TABLE IF EXISTS public.court_operations_resource_sessions
  DROP CONSTRAINT IF EXISTS court_operations_resource_sessions_tenant_id_fkey;
DROP TABLE IF EXISTS public.court_operations_resource_sessions;

COMMIT;

DO $$
BEGIN
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL capacity SSOT court_resource_reservations was removed';
  END IF;
  IF to_regclass('public.court_operations_court_live_states') IS NOT NULL
     OR to_regclass('public.court_operations_resource_sessions') IS NOT NULL
     OR to_regclass('public.court_operations_live_runtime_commands') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL live runtime tables still present';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'court_operations_live_%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL live runtime functions still present';
  END IF;
  RAISE NOTICE 'ROLLBACK_OK court_operations_live_resource_runtime_01';
END
$$;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_operations_live_*' AS value, true AS ok;
SELECT 'RESERVATION_ROWS_DELETED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH1_6_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;

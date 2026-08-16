-- Court Operations canonical resource blocks 01 ROLLBACK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- RESOURCE_BLOCKS_MIGRATION_VERSION=20260816180000
--
-- Drops ONLY objects created by this package. Does not touch Phase 3A,
-- Phase 3B, D4, Batch 1, Batch 2 or Batch 3 objects, and does not delete any
-- row in public.court_resource_reservations.
--
-- Ordering matters:
--   1. Functions first. serialize takes the table composite type.
--   2. public.court_operations_resource_block_commands (no inbound FK).
--   3. public.court_operations_resource_blocks last.
--
-- No CASCADE is used anywhere here, so this rollback can never delete capacity
-- data.

BEGIN;

-- 1. Public RPCs.
DROP FUNCTION IF EXISTS public.court_operations_resource_block_list(
  text, text, timestamptz, timestamptz, uuid[], text[], boolean
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_get(text, uuid);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_cancel(
  text, uuid, text, text
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_transfer_court(
  text, uuid, uuid, int, text
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_reschedule(
  text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_create(
  text, text, uuid, timestamptz, timestamptz, text, jsonb
);

-- 2. Internal helpers.
DROP FUNCTION IF EXISTS public.court_operations_resource_block_release_own_capacity(
  text, uuid, text, text, uuid, uuid
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_assert_scope(text, text);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_assert_tenant(text);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_serialize(
  public.court_operations_resource_blocks
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_owner_type(text);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_fingerprint(text, jsonb);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_payload_text(
  jsonb, text, text
);
DROP FUNCTION IF EXISTS public.court_operations_resource_block_utc_text(timestamptz);

-- 3. Idempotency ledger.
DROP TABLE IF EXISTS public.court_operations_resource_block_commands;

-- 4. Resource block business aggregate.
ALTER TABLE IF EXISTS public.court_operations_resource_blocks
  DROP CONSTRAINT IF EXISTS court_operations_resource_blocks_reservation_id_fkey;
ALTER TABLE IF EXISTS public.court_operations_resource_blocks
  DROP CONSTRAINT IF EXISTS court_operations_resource_blocks_physical_court_id_fkey;
DROP TABLE IF EXISTS public.court_operations_resource_blocks;

COMMIT;

DO $$
BEGIN
  IF to_regclass('public.court_resource_reservations') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL capacity SSOT court_resource_reservations was removed';
  END IF;
  IF to_regprocedure(
    'public.court_resource_reserve_core('
    || 'text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL court_resource_reserve_core was removed';
  END IF;
  IF to_regclass('public.court_operations_resource_blocks') IS NOT NULL
     OR to_regclass('public.court_operations_resource_block_commands') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL resource block tables still present';
  END IF;
  RAISE NOTICE 'ROLLBACK_OK court_resource_canonical_resource_blocks_01';
END
$$;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_operations_resource_block*' AS value, true AS ok;
SELECT 'RESERVATION_ROWS_DELETED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH1_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH2_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH3_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;

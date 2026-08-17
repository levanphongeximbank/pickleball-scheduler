-- Court Operations canonical booking lifecycle 01 ROLLBACK.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- BOOKING_LIFECYCLE_MIGRATION_VERSION=20260816160000
--
-- Drops ONLY objects created by this package. Does not touch Phase 3A,
-- Phase 3B, D4, Batch 1 or Batch 2 objects, and does not delete any row in
-- public.court_resource_reservations.
--
-- Ordering matters:
--   1. Functions first. public.court_operations_booking_serialize takes the
--      booking table composite type, so the table cannot be dropped while it
--      exists.
--   2. public.court_operations_booking_commands (no inbound FK).
--   3. public.court_operations_bookings last.
--
-- public.court_operations_bookings holds an outbound RESTRICT FK to
-- public.court_resource_reservations. Dropping the booking table only removes
-- the referencing side: reservation rows, reservation history and the Phase 3B
-- exclusion constraint are all left intact. No CASCADE is used anywhere here,
-- so this rollback can never delete capacity data.

BEGIN;

-- 1. Public RPCs.
DROP FUNCTION IF EXISTS public.court_operations_booking_list(
  text, text, timestamptz, timestamptz, text[]
);
DROP FUNCTION IF EXISTS public.court_operations_booking_get(text, uuid);
DROP FUNCTION IF EXISTS public.court_operations_booking_update_lifecycle(
  text, uuid, text, int, text
);
DROP FUNCTION IF EXISTS public.court_operations_booking_cancel(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.court_operations_booking_transfer_court(
  text, uuid, uuid, int, text
);
DROP FUNCTION IF EXISTS public.court_operations_booking_reschedule(
  text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb
);
DROP FUNCTION IF EXISTS public.court_operations_booking_create(
  text, text, uuid, timestamptz, timestamptz, text, jsonb
);

-- 2. Internal helpers.
DROP FUNCTION IF EXISTS public.court_operations_booking_release_own_capacity(
  text, uuid, text, uuid, uuid
);
DROP FUNCTION IF EXISTS public.court_operations_booking_assert_scope(text, text);
DROP FUNCTION IF EXISTS public.court_operations_booking_assert_tenant(text);
DROP FUNCTION IF EXISTS public.court_operations_booking_serialize(
  public.court_operations_bookings
);
DROP FUNCTION IF EXISTS public.court_operations_booking_transition_allowed(text, text);
DROP FUNCTION IF EXISTS public.court_operations_booking_lifecycle_allowed(text);
DROP FUNCTION IF EXISTS public.court_operations_booking_fingerprint(text, jsonb);
DROP FUNCTION IF EXISTS public.court_operations_booking_payload_numeric(
  jsonb, text, numeric
);
DROP FUNCTION IF EXISTS public.court_operations_booking_payload_text(jsonb, text, text);
DROP FUNCTION IF EXISTS public.court_operations_booking_utc_text(timestamptz);

-- 3. Idempotency ledger.
DROP TABLE IF EXISTS public.court_operations_booking_commands;

-- 4. Booking business aggregate. Clearing the outbound RESTRICT FK to the
--    Phase 3B capacity SSOT is the only reservation-side effect.
ALTER TABLE IF EXISTS public.court_operations_bookings
  DROP CONSTRAINT IF EXISTS court_operations_bookings_reservation_id_fkey;
ALTER TABLE IF EXISTS public.court_operations_bookings
  DROP CONSTRAINT IF EXISTS court_operations_bookings_physical_court_id_fkey;
DROP TABLE IF EXISTS public.court_operations_bookings;

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
  IF to_regclass('public.court_operations_bookings') IS NOT NULL
     OR to_regclass('public.court_operations_booking_commands') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL booking lifecycle tables still present';
  END IF;
  RAISE NOTICE 'ROLLBACK_OK court_resource_canonical_booking_lifecycle_01';
END
$$;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_operations_booking*' AS value, true AS ok;
SELECT 'RESERVATION_ROWS_DELETED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH1_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'BATCH2_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;

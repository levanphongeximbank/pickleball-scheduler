-- Official/Open canonical court reservation 01: BACKFILL PRECHECK (read only).
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Run after 02_APPLY_SCHEMA + 03_VERIFY_SCHEMA.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.court_reservations') IS NULL THEN
    v_missing := array_append(v_missing, 'public.court_reservations');
  END IF;
  IF to_regclass('public.club_data_v3') IS NULL THEN
    v_missing := array_append(v_missing, 'public.club_data_v3');
  END IF;
  IF to_regclass('public.canonical_tournaments') IS NULL THEN
    v_missing := array_append(v_missing, 'public.canonical_tournaments');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='court_reservations' AND column_name='origin'
  ) THEN
    v_missing := array_append(v_missing, 'court_reservations.origin');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'BACKFILL_PRECHECK_FAIL: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE 'BACKFILL_PRECHECK_OK: schema ready; 05_BACKFILL is additive and idempotent';
END
$$;

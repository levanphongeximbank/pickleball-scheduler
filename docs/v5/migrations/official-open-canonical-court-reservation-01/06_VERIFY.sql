-- Official/Open canonical court reservation 01: READ-ONLY verify after schema + optional backfill.
-- LOCAL PACKAGE ONLY. Run 03_VERIFY_SCHEMA first, then this file.
-- DO NOT APPLY WITHOUT OWNER GO STAGING.

DO $$
BEGIN
  IF to_regclass('public.court_reservations') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: court_reservations missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='court_reservations' AND column_name='origin'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: court_reservations.origin missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='court_reservations_idempotency_uidx'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: court_reservations idempotency unique index missing';
  END IF;
  IF to_regprocedure('public.canonical_tournament_update(text,text,uuid,jsonb,bigint)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: versioned canonical_tournament_update missing';
  END IF;
  RAISE NOTICE 'VERIFY_OK: official-open-canonical-court-reservation-01 post-backfill contracts';
END
$$;

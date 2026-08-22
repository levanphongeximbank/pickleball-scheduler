-- Official/Open canonical court reservation 01 ROLLBACK.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Restores exact Daily #424 assign/change bodies and pre-package canonical_tournament_update.
-- Does not replay Daily #424 package. Does not drop daily_play_court_leases.

BEGIN;

DO $$
DECLARE
  v_runtime bigint := 0;
  v_mutated_backfill bigint := 0;
  v_ledger_runtime bigint := 0;
BEGIN
  IF to_regclass('public.court_reservations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='court_reservations' AND column_name='origin'
    ) THEN
      SELECT count(*) INTO v_runtime
      FROM public.court_reservations
      WHERE origin = 'runtime';
      SELECT count(*) INTO v_mutated_backfill
      FROM public.court_reservations
      WHERE origin = 'package_backfill'
        AND updated_at IS DISTINCT FROM created_at;
    ELSE
      SELECT count(*) INTO v_runtime FROM public.court_reservations WHERE status = 'active';
    END IF;
  END IF;
  IF to_regclass('public.court_reservation_command_ledger') IS NOT NULL THEN
    SELECT count(*) INTO v_ledger_runtime
    FROM public.court_reservation_command_ledger
    WHERE command IN ('reserve_courts', 'commit_group_schedule');
  END IF;
  IF v_runtime > 0 OR v_mutated_backfill > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK_UNSAFE: runtime_rows=% mutated_backfill=% — fail closed',
      v_runtime, v_mutated_backfill;
  END IF;
  IF v_ledger_runtime > 0 THEN
    RAISE EXCEPTION 'ROLLBACK_UNSAFE: runtime command ledger rows=% — fail closed', v_ledger_runtime;
  END IF;
END
$$;

-- Remove unmutated package-created backfill rows only.
DELETE FROM public.court_reservations
 WHERE origin = 'package_backfill'
   AND updated_at IS NOT DISTINCT FROM created_at;

-- Restore Daily #424 bodies BEFORE dropping court_assert_available.

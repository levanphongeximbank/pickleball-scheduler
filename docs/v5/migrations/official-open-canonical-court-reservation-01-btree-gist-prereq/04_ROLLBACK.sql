-- btree_gist prerequisite ROLLBACK.
-- Fail-closed if reservation exclusion constraint depends on it.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'court_reservations_no_active_overlap'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_UNSAFE: court_reservations exclusion constraint still depends on btree_gist';
  END IF;
END
$$;

DROP EXTENSION IF EXISTS btree_gist;

COMMIT;

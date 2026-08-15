-- Venue/Court canonical cluster membership binding rollback.
-- DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Drops only the new writer. Does not delete club or court business data.

BEGIN;

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bind_club_courts_to_cluster';

  IF v_count > 1 THEN
    RAISE EXCEPTION
      'ROLLBACK_FAIL: unexpected bind_club_courts_to_cluster overload count=%. Refusing to drop an ambiguous writer.',
      v_count;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer);

COMMIT;

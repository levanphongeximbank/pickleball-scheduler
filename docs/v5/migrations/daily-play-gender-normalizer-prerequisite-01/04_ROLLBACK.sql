-- Daily Play gender-normalizer prerequisite rollback.
-- DO NOT APPLY WITHOUT OWNER GO.
-- Fail-closed: never drop the helper while dependents remain.
--
-- Order:
--   1. Roll back daily-play-canonical-session-close-final-lifecycle-01 first
--      (drops daily_play_athlete_gender_key which calls this helper).
--   2. Only then run this rollback, and only if no remaining function
--      still references team_tournament_normalize_gender_key.
--
-- If the helper existed before this package (e.g. Staging Team Tournament),
-- dependents remain and DROP is refused.

DO $$
DECLARE
  v_reg text := 'public.team_tournament_normalize_gender_key(text)';
  v_oid oid;
  v_dependents text;
BEGIN
  IF to_regprocedure(v_reg) IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_REFUSED: % is not present. Nothing to drop.', v_reg;
  END IF;

  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'team_tournament_normalize_gender_key'
  LIMIT 1;

  SELECT string_agg(n.nspname || '.' || p.proname, ', ' ORDER BY p.proname)
  INTO v_dependents
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid <> v_oid
    AND pg_get_functiondef(p.oid) ILIKE '%team_tournament_normalize_gender_key%';

  IF v_dependents IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK_REFUSED: dependent function(s) still reference %: %. Roll back Daily Play / Team dependents first. After #424 is applied, this helper must not be dropped.',
      v_reg, v_dependents;
  END IF;
END
$$;

BEGIN;

DROP FUNCTION IF EXISTS public.team_tournament_normalize_gender_key(text);

COMMIT;

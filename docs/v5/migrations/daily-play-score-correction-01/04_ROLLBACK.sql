-- Daily Play canonical score correction rollback.
-- DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Drops only objects owned by this additive package.

BEGIN;

DROP FUNCTION IF EXISTS public.daily_play_correct_score(
  text, text, uuid, text, integer, integer, integer, text, text
);

COMMIT;

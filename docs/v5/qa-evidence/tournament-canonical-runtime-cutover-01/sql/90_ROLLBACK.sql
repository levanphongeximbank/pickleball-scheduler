-- ROLLBACK — TOURNAMENT-CANONICAL-RUNTIME-CUTOVER-01
-- Local package ONLY.

BEGIN;

DROP FUNCTION IF EXISTS public.canonical_tournament_apply_engine_state(text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.canonical_tournament_list_mine(text, text, text);
DROP FUNCTION IF EXISTS public.canonical_tournament_delete(text, text, uuid);
DROP FUNCTION IF EXISTS public.canonical_tournament_update(text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.canonical_tournament_get(text, text, uuid);
DROP FUNCTION IF EXISTS public.canonical_tournament_create(text, text, jsonb);
DROP FUNCTION IF EXISTS public.canonical_tournament_list(text, text, jsonb);
DROP TABLE IF EXISTS public.canonical_tournaments;

COMMIT;

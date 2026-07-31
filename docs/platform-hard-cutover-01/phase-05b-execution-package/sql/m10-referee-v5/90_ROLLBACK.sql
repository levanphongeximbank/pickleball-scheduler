-- M10 rollback boundary (HONEST)
-- Removes Referee V5-owned objects introduced by this package.
-- Preserves legacy token RPCs: referee_get_match_by_token, referee_update_match_score.
-- Does NOT restore any pre-existing non-V5 objects (none expected on Production).
-- If any shared object was replaced (none intended), recovery = backup/PITR only.
-- Excludes Staging-only artefacts: phase_v5d3_staging_fault_injection, PHASE_V5D4 fault injection,
-- PHASE_V5E1 publication alter (STAGING ONLY).

BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'referee_v5%'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.match_integration_outbox CASCADE;
DROP TABLE IF EXISTS public.match_sync_mutations CASCADE;
DROP TABLE IF EXISTS public.referee_device_sessions CASCADE;
DROP TABLE IF EXISTS public.match_disputes CASCADE;
DROP TABLE IF EXISTS public.match_incidents CASCADE;
DROP TABLE IF EXISTS public.match_result_revisions CASCADE;
DROP TABLE IF EXISTS public.match_game_states CASCADE;
DROP TABLE IF EXISTS public.match_events CASCADE;
DROP TABLE IF EXISTS public.match_participant_positions CASCADE;
DROP TABLE IF EXISTS public.match_live_states CASCADE;
DROP TABLE IF EXISTS public.referee_assignments CASCADE;

COMMIT;

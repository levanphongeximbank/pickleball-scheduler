-- PLATFORM-HARD-CUTOVER-01 Phase 4 — DROP legacy club_ai_data
-- Prerequisites: wipe complete; SPA without REST to club_ai_data deployed.
-- Canonical club cloud SoT remains public.club_data_v3.
-- IRREVERSIBLE without backup recreate. NOT executed by this PR.

BEGIN;

DROP POLICY IF EXISTS club_ai_data_deny_all_clients ON public.club_ai_data;
DROP POLICY IF EXISTS club_ai_data_anon_insert ON public.club_ai_data;
DROP POLICY IF EXISTS club_ai_data_anon_update ON public.club_ai_data;
DROP POLICY IF EXISTS club_ai_data_anon_select ON public.club_ai_data;

DROP TABLE IF EXISTS public.club_ai_data;

COMMIT;

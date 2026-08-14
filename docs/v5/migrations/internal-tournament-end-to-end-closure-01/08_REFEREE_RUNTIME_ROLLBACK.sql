-- ═══════════════════════════════════════════════════════════════════
-- 08_REFEREE_RUNTIME_ROLLBACK.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-016
-- STAGING ONLY. Do not run unless Owner GO for rollback.
-- ROLLBACK_RUN=NO for the forward remediation.
--
-- Drops only the Internal ensure RPC and the match uniqueness index
-- added in 06_APPLY. Does not drop referee_token uniqueness or
-- referee_get_match_by_token / Team ensure.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.canonical_ensure_internal_referee_match_live(text);

DROP INDEX IF EXISTS public.tournament_match_live_club_tournament_match_uidx;

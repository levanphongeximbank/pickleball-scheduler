-- ═══════════════════════════════════════════════════════════════════
-- 12_REFEREE_COMMIT_ROLLBACK.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-017
-- STAGING ONLY. Do not run unless Owner GO for rollback.
-- ROLLBACK_RUN=NO for the forward remediation.
--
-- Drops only the Internal referee canonical commit RPC added in 10_APPLY.
-- Does not drop 016 ensure RPC or Team referee functions.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.canonical_commit_internal_referee_match_result(text, integer, integer, bigint);

-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: referee-v5-staging-runtime-alignment
-- HONEST ROLLBACK. Do not drop live Referee V5 commit RPCs.
-- SQL_EXECUTION_GO=NO — author only. Do not execute in this gate.
-- ═══════════════════════════════════════════════════════════════════
--
-- This package reapplies the current canonical V5D32 / V5D4 bodies that
-- already exist on Staging pg_proc (2026-08-18 audit) and issues
-- NOTIFY pgrst, 'reload schema'.
--
-- A destructive DROP of referee_v5_commit_match_transition /
-- referee_v5_commit_match_finalization would take Referee V5 offline
-- and cannot reconstruct a pre-V5D32 15/16-arg body from this package.
--
-- Rollback = no-op unless a captured previous definition is supplied
-- by a later Owner GO. This file therefore fails closed.
--
-- Prerequisite for a real restore: exact captured pg_get_functiondef
-- from before APPLY. That capture is NOT stored here and MUST NOT be
-- fabricated.

do $$
begin
  raise exception
    'REFEREE_V5_STAGING_ROLLBACK_REFUSED — do not drop canonical commit RPCs; restore requires a captured previous definition that this package does not contain';
end;
$$;

-- M9 Production pre-wipe rollback CANDIDATE for future TT5D
-- Production applicability (2026-07-31 SELECT-only):
--   referee_assignments ABSENT
--   TT5B links ABSENT
--   TT5D objects ABSENT
-- Therefore future Production TT5D apply would introduce NEW objects after M10+TT5B.
-- Pre-wipe rollback (only before runtime writes): DROP newly introduced TT5D objects
-- in dependency-safe reverse order. No cascading drops. No emptying tables. No identity deletes.
-- Classification while Phase 5C blocked: ROLLBACK_CANDIDATE_NOT_CERTIFIED
-- After wipe/runtime: BACKUP_RESTORE_REQUIRED
-- Production backup/PITR/restore remains NOT_PROVABLE_CANNOT_WAIVE

-- Not executed. Production mutations must remain 0.

-- Reverse-order DROP candidates (only if future apply introduced them and no writes):
-- DROP FUNCTION IF EXISTS public.team_tournament_referee_match_access_ops(text, text);
-- DROP FUNCTION IF EXISTS public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean);
-- (do not drop referee_v5_current_user_has_assignment if M10-owned — restore M10 body instead)
-- DROP FUNCTION IF EXISTS public.team_tournament_list_referee_corrections(text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text);
-- DROP TABLE IF EXISTS public.team_tournament_referee_correction_requests;
-- DROP FUNCTION IF EXISTS public.team_tournament_reopen_referee_match(text, text, text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_list_referee_assignments(text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text);
-- DROP FUNCTION IF EXISTS public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text);
-- DROP FUNCTION IF EXISTS public.referee_v5_mark_assignment_expired_if_needed(uuid);
-- DROP FUNCTION IF EXISTS public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz);
-- DROP INDEX IF EXISTS public.referee_assignments_sub_match_idx;
-- ALTER columns introduced by TT5D may be dropped ONLY before runtime writes.

SELECT 'M9_PRODUCTION_PREWIPE_ROLLBACK_CANDIDATE_NOT_EXECUTED' AS status;
SELECT 'ROLLBACK_CANDIDATE_NOT_CERTIFIED' AS classification;
SELECT 'BACKUP_RESTORE_REQUIRED' AS after_wipe_or_runtime_writes;

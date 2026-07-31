-- Phase 5D exact baseline rollback — restores pre-mutation Staging state captured in evidence/02.
-- Author-only. Restores captured baseline attributes/ACLs/provenance. No table drops or truncates. No Production identifiers as targets.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('phase5d_tt5d_controlled_reconciliation_rollback', 0));

-- Restore volatility
ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) IMMUTABLE;

-- Restore function ACLs to captured baseline
-- restore referee_v5_apply_admin_result_revision
REVOKE ALL ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) TO service_role;

-- restore referee_v5_assert_assignment_write
REVOKE ALL ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) TO authenticated, service_role;

-- restore referee_v5_assignment_effective_status
REVOKE ALL ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- restore referee_v5_current_user_has_assignment
REVOKE ALL ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) TO anon, authenticated, service_role;

-- restore referee_v5_mark_assignment_expired_if_needed
REVOKE ALL ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) TO authenticated, service_role;

-- restore team_tournament_create_referee_assignment
REVOKE ALL ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) TO authenticated, service_role;

-- restore team_tournament_list_referee_assignments
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_assignments(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_assignments(text, text) TO authenticated, service_role;

-- restore team_tournament_list_referee_corrections
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_corrections(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_corrections(text, text) TO authenticated, service_role;

-- restore team_tournament_referee_match_access_ops
REVOKE ALL ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) TO authenticated, service_role;

-- restore team_tournament_reopen_referee_match
REVOKE ALL ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) TO authenticated, service_role;

-- restore team_tournament_request_referee_correction
REVOKE ALL ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) TO authenticated, service_role;

-- restore team_tournament_review_referee_correction
REVOKE ALL ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) TO authenticated, service_role;

-- restore team_tournament_revoke_referee_assignment
REVOKE ALL ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) TO authenticated, service_role;

-- Restore correction table ACL to captured baseline (authenticated ALL)
REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

-- Remove controlled provenance row if present
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260731150000' AND name = 'phase5d_tt5d_controlled_reconciliation';

COMMIT;

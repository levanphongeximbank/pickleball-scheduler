-- M8 Competition Remote SSOT — 51 grants tighten (Staging privilege hardening)
-- Target: Staging only. Owner GO required before apply.
-- Scope (fail-closed, additive REVOKE only):
--   1) REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER on all competition_ssot_* tables FROM authenticated
--   2) REVOKE EXECUTE on the three text-tenant RPCs FROM anon
-- Preserves:
--   - authenticated package-50 required privileges (re-asserted below; participants DELETE intentionally removed by this harden)
--   - service_role ALL on tables
--   - sequence USAGE + SELECT for authenticated + service_role
-- Does NOT alter tables/columns/indexes/constraints/RLS/policies/RPC bodies/data.

BEGIN;

-- 1) Strip excess table privileges from authenticated (all SSOT tables)
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_competitions FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_participants FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_matches FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_finalized_results FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_standings_snapshots FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_command_log FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_audit_events FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.competition_ssot_idempotency FROM authenticated;

-- 2) Strip anon EXECUTE on the three SECURITY DEFINER RPCs (exact text signatures)
REVOKE EXECUTE ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) FROM anon;

-- 3) Re-assert package-50 required authenticated privileges (minus intentional DELETE harden)
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_matches TO authenticated;
GRANT SELECT ON public.competition_ssot_finalized_results TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_standings_snapshots TO authenticated;
GRANT SELECT ON public.competition_ssot_command_log TO authenticated;
GRANT SELECT ON public.competition_ssot_audit_events TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_idempotency TO authenticated;

-- 4) Preserve service_role ALL
GRANT ALL ON public.competition_ssot_competitions TO service_role;
GRANT ALL ON public.competition_ssot_participants TO service_role;
GRANT ALL ON public.competition_ssot_matches TO service_role;
GRANT ALL ON public.competition_ssot_finalized_results TO service_role;
GRANT ALL ON public.competition_ssot_standings_snapshots TO service_role;
GRANT ALL ON public.competition_ssot_command_log TO service_role;
GRANT ALL ON public.competition_ssot_audit_events TO service_role;
GRANT ALL ON public.competition_ssot_idempotency TO service_role;

-- 5) Preserve sequence USAGE + SELECT
GRANT USAGE, SELECT ON SEQUENCE public.competition_ssot_command_log_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.competition_ssot_audit_events_id_seq TO authenticated, service_role;

-- 6) Preserve authenticated + service_role EXECUTE on RPCs
GRANT EXECUTE ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competition_ssot_append_command(text, uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.competition_ssot_upsert_working_score(text, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text) TO service_role;

COMMIT;

-- M8 Competition Remote SSOT — 52 grants exact baseline (residual INSERT/UPDATE tighten)
-- Target: Staging only. Owner GO required before apply.
-- Scope: REVOKE only authenticated INSERT/UPDATE privileges that exceed 50_GRANTS.sql.
-- Does NOT revoke any privilege required by 50_GRANTS.sql.
-- Note: participants DELETE remains absent (intentional 51 harden); 52 does not re-grant DELETE.
-- Does NOT alter tables/data/indexes/constraints/RLS/policies/RPC bodies/service_role/sequences.

BEGIN;

-- 50_GRANTS: finalized_results = SELECT only
REVOKE INSERT, UPDATE ON public.competition_ssot_finalized_results FROM authenticated;

-- 50_GRANTS: command_log = SELECT only
REVOKE INSERT, UPDATE ON public.competition_ssot_command_log FROM authenticated;

-- 50_GRANTS: audit_events = SELECT only
REVOKE INSERT, UPDATE ON public.competition_ssot_audit_events FROM authenticated;

-- 50_GRANTS: standings_snapshots = SELECT, INSERT (no UPDATE)
REVOKE UPDATE ON public.competition_ssot_standings_snapshots FROM authenticated;

-- 50_GRANTS: idempotency = SELECT, INSERT (no UPDATE)
REVOKE UPDATE ON public.competition_ssot_idempotency FROM authenticated;

-- Re-assert required authenticated privileges from 50_GRANTS (no DELETE re-grant)
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_matches TO authenticated;
GRANT SELECT ON public.competition_ssot_finalized_results TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_standings_snapshots TO authenticated;
GRANT SELECT ON public.competition_ssot_command_log TO authenticated;
GRANT SELECT ON public.competition_ssot_audit_events TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_idempotency TO authenticated;

COMMIT;

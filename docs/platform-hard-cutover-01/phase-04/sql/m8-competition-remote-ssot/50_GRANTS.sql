-- M8 grants for authenticated read/write where RLS allows; finalized writes via RPC only
BEGIN;

GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_ssot_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.competition_ssot_matches TO authenticated;
GRANT SELECT ON public.competition_ssot_finalized_results TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_standings_snapshots TO authenticated;
GRANT SELECT ON public.competition_ssot_command_log TO authenticated;
GRANT SELECT ON public.competition_ssot_audit_events TO authenticated;
GRANT SELECT, INSERT ON public.competition_ssot_idempotency TO authenticated;

GRANT ALL ON public.competition_ssot_competitions TO service_role;
GRANT ALL ON public.competition_ssot_participants TO service_role;
GRANT ALL ON public.competition_ssot_matches TO service_role;
GRANT ALL ON public.competition_ssot_finalized_results TO service_role;
GRANT ALL ON public.competition_ssot_standings_snapshots TO service_role;
GRANT ALL ON public.competition_ssot_command_log TO service_role;
GRANT ALL ON public.competition_ssot_audit_events TO service_role;
GRANT ALL ON public.competition_ssot_idempotency TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.competition_ssot_command_log_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.competition_ssot_audit_events_id_seq TO authenticated, service_role;

COMMIT;

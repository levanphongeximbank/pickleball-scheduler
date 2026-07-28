-- M8 Competition Remote SSOT — indexes
BEGIN;

CREATE INDEX IF NOT EXISTS competition_ssot_competitions_tenant_idx
  ON public.competition_ssot_competitions (tenant_id);
CREATE INDEX IF NOT EXISTS competition_ssot_participants_comp_idx
  ON public.competition_ssot_participants (competition_id);
CREATE INDEX IF NOT EXISTS competition_ssot_matches_comp_status_idx
  ON public.competition_ssot_matches (competition_id, status);
CREATE INDEX IF NOT EXISTS competition_ssot_finalized_comp_idx
  ON public.competition_ssot_finalized_results (competition_id);
CREATE INDEX IF NOT EXISTS competition_ssot_command_log_comp_idx
  ON public.competition_ssot_command_log (competition_id, created_at);
CREATE INDEX IF NOT EXISTS competition_ssot_audit_tenant_idx
  ON public.competition_ssot_audit_events (tenant_id, created_at);

COMMIT;

-- =============================================================================
-- REPORTING-02 — Indexes
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS reporting_report_definitions_tenant_status_idx
  ON public.reporting_report_definitions (tenant_id, status);

CREATE INDEX IF NOT EXISTS reporting_report_definitions_tenant_type_idx
  ON public.reporting_report_definitions (tenant_id, report_type);

CREATE INDEX IF NOT EXISTS reporting_report_definitions_scope_kind_idx
  ON public.reporting_report_definitions (scope_kind, tenant_id);

CREATE INDEX IF NOT EXISTS reporting_report_definitions_updated_at_idx
  ON public.reporting_report_definitions (updated_at DESC);

CREATE INDEX IF NOT EXISTS reporting_saved_reports_owner_tenant_idx
  ON public.reporting_saved_reports (owner_id, tenant_id);

CREATE INDEX IF NOT EXISTS reporting_saved_reports_definition_idx
  ON public.reporting_saved_reports (report_definition_id);

CREATE INDEX IF NOT EXISTS reporting_saved_reports_tenant_status_idx
  ON public.reporting_saved_reports (tenant_id, status);

CREATE INDEX IF NOT EXISTS reporting_saved_filters_owner_tenant_idx
  ON public.reporting_saved_filters (owner_id, tenant_id);

CREATE INDEX IF NOT EXISTS reporting_saved_filters_definition_idx
  ON public.reporting_saved_filters (report_definition_id);

CREATE INDEX IF NOT EXISTS reporting_saved_filters_tenant_status_idx
  ON public.reporting_saved_filters (tenant_id, status);

CREATE INDEX IF NOT EXISTS reporting_executions_definition_idx
  ON public.reporting_executions (report_definition_id);

CREATE INDEX IF NOT EXISTS reporting_executions_tenant_status_idx
  ON public.reporting_executions (tenant_id, status);

CREATE INDEX IF NOT EXISTS reporting_executions_actor_idx
  ON public.reporting_executions (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reporting_executions_created_at_idx
  ON public.reporting_executions (created_at DESC);

CREATE INDEX IF NOT EXISTS reporting_export_jobs_execution_idx
  ON public.reporting_export_jobs (execution_id);

CREATE INDEX IF NOT EXISTS reporting_export_jobs_definition_idx
  ON public.reporting_export_jobs (report_definition_id);

CREATE INDEX IF NOT EXISTS reporting_export_jobs_tenant_status_idx
  ON public.reporting_export_jobs (tenant_id, status);

CREATE INDEX IF NOT EXISTS reporting_export_jobs_actor_idx
  ON public.reporting_export_jobs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reporting_export_jobs_created_at_idx
  ON public.reporting_export_jobs (created_at DESC);

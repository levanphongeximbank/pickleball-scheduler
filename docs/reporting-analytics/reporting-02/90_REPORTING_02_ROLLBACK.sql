-- =============================================================================
-- REPORTING-02 — Rollback / down strategy
-- Purpose: Manual rollback for authored REPORTING-02 objects.
-- Status: DOCUMENTATION + SCRIPT — run only under Owner authorization after
--         backup. Does NOT run automatically. Does NOT touch Staging/Production
--         unless explicitly authorized.
-- Order: drop policies/helper → drop indexes → drop tables (children first).
-- Warning: DROP TABLE is irreversible without restore.
-- =============================================================================

SET search_path = public, pg_temp;

DROP POLICY IF EXISTS reporting_export_jobs_select ON public.reporting_export_jobs;
DROP POLICY IF EXISTS reporting_executions_select ON public.reporting_executions;
DROP POLICY IF EXISTS reporting_saved_filters_select ON public.reporting_saved_filters;
DROP POLICY IF EXISTS reporting_saved_reports_select ON public.reporting_saved_reports;
DROP POLICY IF EXISTS reporting_report_definitions_select ON public.reporting_report_definitions;

DROP FUNCTION IF EXISTS public.reporting_02_scope_allows(text, text, text, text);

DROP INDEX IF EXISTS public.reporting_export_jobs_created_at_idx;
DROP INDEX IF EXISTS public.reporting_export_jobs_actor_idx;
DROP INDEX IF EXISTS public.reporting_export_jobs_tenant_status_idx;
DROP INDEX IF EXISTS public.reporting_export_jobs_definition_idx;
DROP INDEX IF EXISTS public.reporting_export_jobs_execution_idx;
DROP INDEX IF EXISTS public.reporting_executions_created_at_idx;
DROP INDEX IF EXISTS public.reporting_executions_actor_idx;
DROP INDEX IF EXISTS public.reporting_executions_tenant_status_idx;
DROP INDEX IF EXISTS public.reporting_executions_definition_idx;
DROP INDEX IF EXISTS public.reporting_saved_filters_tenant_status_idx;
DROP INDEX IF EXISTS public.reporting_saved_filters_definition_idx;
DROP INDEX IF EXISTS public.reporting_saved_filters_owner_tenant_idx;
DROP INDEX IF EXISTS public.reporting_saved_reports_tenant_status_idx;
DROP INDEX IF EXISTS public.reporting_saved_reports_definition_idx;
DROP INDEX IF EXISTS public.reporting_saved_reports_owner_tenant_idx;
DROP INDEX IF EXISTS public.reporting_report_definitions_updated_at_idx;
DROP INDEX IF EXISTS public.reporting_report_definitions_scope_kind_idx;
DROP INDEX IF EXISTS public.reporting_report_definitions_tenant_type_idx;
DROP INDEX IF EXISTS public.reporting_report_definitions_tenant_status_idx;

DROP TABLE IF EXISTS public.reporting_export_jobs;
DROP TABLE IF EXISTS public.reporting_executions;
DROP TABLE IF EXISTS public.reporting_saved_filters;
DROP TABLE IF EXISTS public.reporting_saved_reports;
DROP TABLE IF EXISTS public.reporting_report_definitions;

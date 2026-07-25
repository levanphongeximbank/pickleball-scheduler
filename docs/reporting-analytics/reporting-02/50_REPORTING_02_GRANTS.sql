-- =============================================================================
-- REPORTING-02 — Grants and security hardening
-- Purpose: Restrict table grants. No anonymous access. No PUBLIC table grants.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON TABLE public.reporting_report_definitions FROM PUBLIC;
REVOKE ALL ON TABLE public.reporting_report_definitions FROM anon;
REVOKE ALL ON TABLE public.reporting_saved_reports FROM PUBLIC;
REVOKE ALL ON TABLE public.reporting_saved_reports FROM anon;
REVOKE ALL ON TABLE public.reporting_saved_filters FROM PUBLIC;
REVOKE ALL ON TABLE public.reporting_saved_filters FROM anon;
REVOKE ALL ON TABLE public.reporting_executions FROM PUBLIC;
REVOKE ALL ON TABLE public.reporting_executions FROM anon;
REVOKE ALL ON TABLE public.reporting_export_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.reporting_export_jobs FROM anon;

-- Authenticated: SELECT only (writes blocked at policy + grant level)
GRANT SELECT ON TABLE public.reporting_report_definitions TO authenticated;
GRANT SELECT ON TABLE public.reporting_saved_reports TO authenticated;
GRANT SELECT ON TABLE public.reporting_saved_filters TO authenticated;
GRANT SELECT ON TABLE public.reporting_executions TO authenticated;
GRANT SELECT ON TABLE public.reporting_export_jobs TO authenticated;

-- service_role: full DML for trusted server adapters (bypasses RLS in Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reporting_report_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reporting_saved_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reporting_saved_filters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reporting_executions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reporting_export_jobs TO service_role;

-- Scope helper
REVOKE ALL ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) TO service_role;

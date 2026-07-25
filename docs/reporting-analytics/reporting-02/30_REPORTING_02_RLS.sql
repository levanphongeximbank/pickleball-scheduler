-- =============================================================================
-- REPORTING-02 — RLS enablement and fail-closed policies
-- Purpose: Tenant/venue-scoped RLS for Reporting tables using ONLY verified
--          PICK_VN helpers: auth.uid(), public.user_venue_id(),
--          public.user_has_permission(text), public.is_super_admin().
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
--
-- Architecture note (Sprint-2 identity — same as Customer/CRM):
--   Verified JWT binding is profiles.venue_id via user_venue_id().
--   Policies require tenant_id = user_venue_id() for tenant-bound rows.
--   When venue_id is present, venue_id must also equal user_venue_id().
--   PLATFORM_CROSS_TENANT denied by default for authenticated JWT.
--
-- Write boundary:
--   Authenticated JWT clients may SELECT when permission/super_admin allows.
--   Authenticated INSERT/UPDATE/DELETE policies are intentionally ABSENT.
--   Lifecycle writes (execution/export status) go through trusted service_role /
--   server adapters only. Clients cannot self-advance status to succeeded.
--
-- No anonymous policies. No USING-true open policies. No invented tenant resolver.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.reporting_02_scope_allows(
  p_scope_kind text,
  p_tenant_id text,
  p_club_id text,
  p_venue_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.user_venue_id() IS NOT NULL
    AND (
      CASE
        WHEN p_scope_kind = 'PLATFORM_CROSS_TENANT' THEN
          public.is_super_admin()
          OR public.user_has_permission('reporting.scope.cross_tenant')
        WHEN p_scope_kind = 'VENUE' THEN
          length(trim(coalesce(p_tenant_id, ''))) > 0
          AND length(trim(coalesce(p_venue_id, ''))) > 0
          AND p_tenant_id = public.user_venue_id()
          AND p_venue_id = public.user_venue_id()
        WHEN p_scope_kind = 'CLUB' THEN
          length(trim(coalesce(p_tenant_id, ''))) > 0
          AND length(trim(coalesce(p_club_id, ''))) > 0
          AND p_tenant_id = public.user_venue_id()
        WHEN p_scope_kind = 'TENANT' THEN
          length(trim(coalesce(p_tenant_id, ''))) > 0
          AND p_tenant_id = public.user_venue_id()
        ELSE
          false
      END
    );
$$;

COMMENT ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) IS
  'REPORTING-02 fail-closed scope gate. Uses only verified helpers. Cross-tenant denied unless super_admin or reporting.scope.cross_tenant.';

REVOKE ALL ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_02_scope_allows(text, text, text, text) TO authenticated;

-- Enable + FORCE RLS
ALTER TABLE public.reporting_report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_export_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reporting_report_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_saved_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_saved_filters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_export_jobs FORCE ROW LEVEL SECURITY;

-- Drop prior REPORTING-02 policies if re-authored
DROP POLICY IF EXISTS reporting_report_definitions_select ON public.reporting_report_definitions;
DROP POLICY IF EXISTS reporting_saved_reports_select ON public.reporting_saved_reports;
DROP POLICY IF EXISTS reporting_saved_filters_select ON public.reporting_saved_filters;
DROP POLICY IF EXISTS reporting_executions_select ON public.reporting_executions;
DROP POLICY IF EXISTS reporting_export_jobs_select ON public.reporting_export_jobs;

-- No authenticated write policies (fail-closed writes).

CREATE POLICY reporting_report_definitions_select
  ON public.reporting_report_definitions
  FOR SELECT
  TO authenticated
  USING (
    public.reporting_02_scope_allows(scope_kind, tenant_id, club_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('reporting.dashboard.view')
      OR public.user_has_permission('reporting.report.execute')
      OR public.user_has_permission('reporting.report.save')
    )
  );

CREATE POLICY reporting_saved_reports_select
  ON public.reporting_saved_reports
  FOR SELECT
  TO authenticated
  USING (
    public.reporting_02_scope_allows(scope_kind, tenant_id, club_id, venue_id)
    AND (
      public.is_super_admin()
      OR owner_id = auth.uid()::text
      OR public.user_has_permission('reporting.report.save')
      OR public.user_has_permission('reporting.report.execute')
    )
  );

CREATE POLICY reporting_saved_filters_select
  ON public.reporting_saved_filters
  FOR SELECT
  TO authenticated
  USING (
    public.reporting_02_scope_allows(scope_kind, tenant_id, club_id, venue_id)
    AND (
      public.is_super_admin()
      OR owner_id = auth.uid()::text
      OR public.user_has_permission('reporting.filter.save')
      OR public.user_has_permission('reporting.report.execute')
    )
  );

CREATE POLICY reporting_executions_select
  ON public.reporting_executions
  FOR SELECT
  TO authenticated
  USING (
    public.reporting_02_scope_allows(scope_kind, tenant_id, club_id, venue_id)
    AND (
      public.is_super_admin()
      OR actor_id = auth.uid()::text
      OR public.user_has_permission('reporting.report.execute')
    )
  );

CREATE POLICY reporting_export_jobs_select
  ON public.reporting_export_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.reporting_02_scope_allows(scope_kind, tenant_id, club_id, venue_id)
    AND (
      public.is_super_admin()
      OR actor_id = auth.uid()::text
      OR public.user_has_permission('reporting.report.export')
    )
  );

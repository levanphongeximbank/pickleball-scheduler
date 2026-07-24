-- =============================================================================
-- CUSTOMER-05 — RLS enablement and fail-closed policies
-- Purpose: Tenant/venue isolation for linkage tables.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
--
-- Reuses public.customer_phase3_scope_allows(text, text) from CUSTOMER-03.
-- Authenticated JWT: SELECT only when customer.view / customer.edit / super_admin.
-- Authenticated INSERT/UPDATE/DELETE intentionally ABSENT.
-- Trusted writes via service_role + customer_save_linkage.
-- No anonymous policies. No open USING-true policies.
-- =============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.customer_linkages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_linkage_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_linkages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_linkage_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_linkages_select ON public.customer_linkages;
DROP POLICY IF EXISTS customer_linkages_insert ON public.customer_linkages;
DROP POLICY IF EXISTS customer_linkages_update ON public.customer_linkages;
DROP POLICY IF EXISTS customer_linkages_delete ON public.customer_linkages;
DROP POLICY IF EXISTS customer_linkage_history_select ON public.customer_linkage_history;
DROP POLICY IF EXISTS customer_linkage_history_insert ON public.customer_linkage_history;
DROP POLICY IF EXISTS customer_linkage_history_update ON public.customer_linkage_history;
DROP POLICY IF EXISTS customer_linkage_history_delete ON public.customer_linkage_history;

CREATE POLICY customer_linkages_select ON public.customer_linkages
  FOR SELECT
  TO authenticated
  USING (
    public.customer_phase3_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('customer.view')
      OR public.user_has_permission('customer.edit')
    )
  );

CREATE POLICY customer_linkage_history_select ON public.customer_linkage_history
  FOR SELECT
  TO authenticated
  USING (
    public.customer_phase3_scope_allows(tenant_id, venue_id)
    AND (
      public.is_super_admin()
      OR public.user_has_permission('customer.view')
      OR public.user_has_permission('customer.edit')
    )
  );

-- Intentionally no authenticated write policies.
-- Intentionally no anon policies.
-- Intentionally no open true-allow policies.

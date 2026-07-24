-- =============================================================================
-- CUSTOMER-06 — RLS enablement and fail-closed policies
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- Reuses public.customer_phase3_scope_allows(text, text) from CUSTOMER-03.
-- Authenticated JWT: SELECT only. No authenticated writes. No anon. No open true-allow policies.
-- Trusted writes via service_role + RPCs.
-- =============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.customer_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_merge_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_merge_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_duplicate_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_merge_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_merge_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_duplicate_candidates_select ON public.customer_duplicate_candidates;
DROP POLICY IF EXISTS customer_merge_proposals_select ON public.customer_merge_proposals;
DROP POLICY IF EXISTS customer_merge_history_select ON public.customer_merge_history;

CREATE POLICY customer_duplicate_candidates_select ON public.customer_duplicate_candidates
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

CREATE POLICY customer_merge_proposals_select ON public.customer_merge_proposals
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

CREATE POLICY customer_merge_history_select ON public.customer_merge_history
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

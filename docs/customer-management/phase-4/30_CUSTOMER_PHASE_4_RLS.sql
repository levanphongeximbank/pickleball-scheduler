-- =============================================================================
-- CUSTOMER-04 — RLS enablement and fail-closed policies
-- Purpose: Tenant/venue isolation for consent/preference tables.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
--
-- Reuses public.customer_phase3_scope_allows(text, text) from CUSTOMER-03.
-- Authenticated JWT: SELECT only when customer.view / customer.edit / super_admin.
-- Authenticated INSERT/UPDATE/DELETE intentionally ABSENT.
-- Trusted writes via service_role + customer_save_consent / customer_save_preference.
-- No anonymous policies. No open USING-true policies.
-- =============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preference_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_consent_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preference_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_consents_select ON public.customer_consents;
DROP POLICY IF EXISTS customer_consents_insert ON public.customer_consents;
DROP POLICY IF EXISTS customer_consents_update ON public.customer_consents;
DROP POLICY IF EXISTS customer_consents_delete ON public.customer_consents;
DROP POLICY IF EXISTS customer_consent_history_select ON public.customer_consent_history;
DROP POLICY IF EXISTS customer_consent_history_insert ON public.customer_consent_history;
DROP POLICY IF EXISTS customer_consent_history_update ON public.customer_consent_history;
DROP POLICY IF EXISTS customer_consent_history_delete ON public.customer_consent_history;
DROP POLICY IF EXISTS customer_prefs_select ON public.customer_communication_preferences;
DROP POLICY IF EXISTS customer_prefs_insert ON public.customer_communication_preferences;
DROP POLICY IF EXISTS customer_prefs_update ON public.customer_communication_preferences;
DROP POLICY IF EXISTS customer_prefs_delete ON public.customer_communication_preferences;
DROP POLICY IF EXISTS customer_preference_history_select ON public.customer_preference_history;
DROP POLICY IF EXISTS customer_preference_history_insert ON public.customer_preference_history;
DROP POLICY IF EXISTS customer_preference_history_update ON public.customer_preference_history;
DROP POLICY IF EXISTS customer_preference_history_delete ON public.customer_preference_history;

CREATE POLICY customer_consents_select ON public.customer_consents
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

CREATE POLICY customer_consent_history_select ON public.customer_consent_history
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

CREATE POLICY customer_prefs_select ON public.customer_communication_preferences
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

CREATE POLICY customer_preference_history_select ON public.customer_preference_history
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

-- No authenticated write policies (fail-closed). No anon policies.

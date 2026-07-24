-- =============================================================================
-- CUSTOMER-04 — Grants
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON TABLE public.customer_consents FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_consents FROM anon;
REVOKE ALL ON TABLE public.customer_consent_history FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_consent_history FROM anon;
REVOKE ALL ON TABLE public.customer_communication_preferences FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_communication_preferences FROM anon;
REVOKE ALL ON TABLE public.customer_preference_history FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_preference_history FROM anon;

GRANT SELECT ON TABLE public.customer_consents TO authenticated;
GRANT SELECT ON TABLE public.customer_consent_history TO authenticated;
GRANT SELECT ON TABLE public.customer_communication_preferences TO authenticated;
GRANT SELECT ON TABLE public.customer_preference_history TO authenticated;

-- No INSERT/UPDATE/DELETE grants to authenticated (fail-closed writes).

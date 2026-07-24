-- =============================================================================
-- CUSTOMER-05 — Grants (fail-closed)
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON TABLE public.customer_linkages FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_linkage_history FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_linkages FROM anon;
REVOKE ALL ON TABLE public.customer_linkage_history FROM anon;

GRANT SELECT ON TABLE public.customer_linkages TO authenticated;
GRANT SELECT ON TABLE public.customer_linkage_history TO authenticated;

GRANT ALL ON TABLE public.customer_linkages TO service_role;
GRANT ALL ON TABLE public.customer_linkage_history TO service_role;

-- Authenticated has no INSERT/UPDATE/DELETE grants on linkage tables.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_linkages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_linkage_history FROM authenticated;

-- =============================================================================
-- CUSTOMER-06 — Grants (fail-closed)
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON TABLE public.customer_duplicate_candidates FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_merge_proposals FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_merge_history FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_duplicate_candidates FROM anon;
REVOKE ALL ON TABLE public.customer_merge_proposals FROM anon;
REVOKE ALL ON TABLE public.customer_merge_history FROM anon;

GRANT SELECT ON TABLE public.customer_duplicate_candidates TO authenticated;
GRANT SELECT ON TABLE public.customer_merge_proposals TO authenticated;
GRANT SELECT ON TABLE public.customer_merge_history TO authenticated;

GRANT ALL ON TABLE public.customer_duplicate_candidates TO service_role;
GRANT ALL ON TABLE public.customer_merge_proposals TO service_role;
GRANT ALL ON TABLE public.customer_merge_history TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_duplicate_candidates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_merge_proposals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_merge_history FROM authenticated;

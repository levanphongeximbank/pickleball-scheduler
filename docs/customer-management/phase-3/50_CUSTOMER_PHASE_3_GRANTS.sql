-- =============================================================================
-- CUSTOMER-03 — Grants and security hardening
-- Purpose: Restrict table/RPC grants. No anonymous access. No PUBLIC execute.
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

-- Tables: revoke broad grants
REVOKE ALL ON TABLE public.customers FROM PUBLIC;
REVOKE ALL ON TABLE public.customers FROM anon;
REVOKE ALL ON TABLE public.customer_contact_points FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_contact_points FROM anon;
REVOKE ALL ON TABLE public.customer_addresses FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_addresses FROM anon;

-- Authenticated: SELECT only (writes blocked at policy + grant level)
GRANT SELECT ON TABLE public.customers TO authenticated;
GRANT SELECT ON TABLE public.customer_contact_points TO authenticated;
GRANT SELECT ON TABLE public.customer_addresses TO authenticated;

-- service_role: full DML for trusted server adapters (bypasses RLS in Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_contact_points TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO service_role;

-- RPC: service_role only
REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb) TO service_role;

-- Scope helper already granted to authenticated in RLS pack; harden again
REVOKE ALL ON FUNCTION public.customer_phase3_scope_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_phase3_scope_allows(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_phase3_scope_allows(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_phase3_scope_allows(text, text) TO service_role;

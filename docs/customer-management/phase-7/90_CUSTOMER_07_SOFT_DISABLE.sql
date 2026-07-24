-- =============================================================================
-- CUSTOMER-07 — Soft-disable (non-destructive)
-- Purpose: Disable Customer trusted write surface without dropping tables/data.
-- Status: MANUAL — run only under Owner authorization on Staging.
-- Does NOT drop tables. Does NOT touch non-Customer objects.
-- Does NOT run automatically. Does NOT apply to Production unless separately
-- authorized in a different change set.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.customer_save_aggregate(jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_save_merge_proposal(jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.customer_execute_merge(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- Note: SELECT policies remain; re-enable by re-running phase grants SQL.

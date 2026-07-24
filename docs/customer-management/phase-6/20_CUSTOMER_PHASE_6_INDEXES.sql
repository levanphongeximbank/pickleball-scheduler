-- =============================================================================
-- CUSTOMER-06 — Indexes
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS customers_merged_into_idx
  ON public.customers (tenant_id, venue_id, merged_into_customer_id)
  WHERE merged_into_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_status_scope_idx
  ON public.customers (tenant_id, venue_id, status);

CREATE INDEX IF NOT EXISTS customer_duplicate_candidates_scope_idx
  ON public.customer_duplicate_candidates (tenant_id, venue_id, status);

CREATE INDEX IF NOT EXISTS customer_duplicate_candidates_customer_a_idx
  ON public.customer_duplicate_candidates (tenant_id, venue_id, customer_id_a);

CREATE INDEX IF NOT EXISTS customer_duplicate_candidates_customer_b_idx
  ON public.customer_duplicate_candidates (tenant_id, venue_id, customer_id_b);

CREATE INDEX IF NOT EXISTS customer_merge_proposals_scope_idx
  ON public.customer_merge_proposals (tenant_id, venue_id, status);

CREATE INDEX IF NOT EXISTS customer_merge_proposals_survivor_idx
  ON public.customer_merge_proposals (tenant_id, venue_id, survivor_customer_id);

CREATE INDEX IF NOT EXISTS customer_merge_history_scope_idx
  ON public.customer_merge_history (tenant_id, venue_id, survivor_customer_id);

CREATE INDEX IF NOT EXISTS customer_merge_history_absorbed_idx
  ON public.customer_merge_history (tenant_id, venue_id, absorbed_customer_id);

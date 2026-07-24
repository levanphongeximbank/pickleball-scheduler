-- =============================================================================
-- CUSTOMER-07 — Fix duplicate-candidate ordered-pair collation
-- Purpose: Align CHECK (customer_id_a < customer_id_b) with JavaScript / C
--          lexicographic ordering used by orderCustomerPair().
-- Staging en_US.UTF-8 collation sorts 'cust_id1_' before 'cust_id15_', while
-- JS and COLLATE "C" sort the opposite — causing false CHECK failures.
-- Status: Staging-only controlled apply via CUSTOMER-07 apply script (append).
-- Idempotent. Non-destructive to data.
-- =============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.customer_duplicate_candidates
  DROP CONSTRAINT IF EXISTS customer_duplicate_candidates_pair_ordered;

ALTER TABLE public.customer_duplicate_candidates
  ADD CONSTRAINT customer_duplicate_candidates_pair_ordered
  CHECK (customer_id_a COLLATE "C" < customer_id_b COLLATE "C");

COMMENT ON CONSTRAINT customer_duplicate_candidates_pair_ordered
  ON public.customer_duplicate_candidates IS
  'CUSTOMER-07: ordered pair uses COLLATE C to match domain orderCustomerPair.';

-- =============================================================================
-- CUSTOMER-06 — Soft-disable / rollback strategy (authored only)
-- Does NOT drop CUSTOMER-03/04/05 objects.
-- Prefer revoke execute + disable policies before destructive drops.
-- =============================================================================

SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.customer_save_duplicate_candidate(jsonb, integer) FROM service_role;
REVOKE ALL ON FUNCTION public.customer_save_merge_proposal(jsonb, integer) FROM service_role;
REVOKE ALL ON FUNCTION public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM service_role;

-- Optional destructive cleanup (Owner-gated only; never Production auto)
-- DROP TRIGGER IF EXISTS customer_merge_history_immutable_trg ON public.customer_merge_history;
-- DROP FUNCTION IF EXISTS public.customer_merge_history_immutable_guard();
-- DROP FUNCTION IF EXISTS public.customer_execute_merge(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS public.customer_save_merge_proposal(jsonb, integer);
-- DROP FUNCTION IF EXISTS public.customer_save_duplicate_candidate(jsonb, integer);
-- DROP TABLE IF EXISTS public.customer_merge_history;
-- DROP TABLE IF EXISTS public.customer_merge_proposals;
-- DROP TABLE IF EXISTS public.customer_duplicate_candidates;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS merge_proposal_id;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS merge_history_id;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS merged_at;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS merged_into_customer_id;

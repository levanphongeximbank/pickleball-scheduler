-- =============================================================================
-- CUSTOMER-05 — Soft-disable / rollback strategy (authored only)
-- Does NOT drop CUSTOMER-03/04 objects.
-- Prefer revoke execute + disable policies before destructive drops.
-- =============================================================================

SET search_path = public, pg_temp;

-- 1) Soft-disable trusted write path
REVOKE ALL ON FUNCTION public.customer_save_linkage(
  jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean
) FROM service_role;

-- 2) Optional destructive cleanup (Owner-gated only; never Production auto)
-- DROP TRIGGER IF EXISTS customer_linkage_history_no_update ON public.customer_linkage_history;
-- DROP TRIGGER IF EXISTS customer_linkage_history_no_delete ON public.customer_linkage_history;
-- DROP FUNCTION IF EXISTS public.customer_linkage_history_immutable();
-- DROP FUNCTION IF EXISTS public.customer_save_linkage(jsonb, jsonb, integer, integer, integer, text, boolean, text, boolean);
-- DROP TABLE IF EXISTS public.customer_linkage_history;
-- DROP TABLE IF EXISTS public.customer_linkages;

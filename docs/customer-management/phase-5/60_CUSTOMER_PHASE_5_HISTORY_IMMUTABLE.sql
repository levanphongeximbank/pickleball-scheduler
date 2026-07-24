-- =============================================================================
-- CUSTOMER-05 — Append-only history immutability guards
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_linkage_history_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'customer_linkage_history is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS customer_linkage_history_immutable_trg
  ON public.customer_linkage_history;
CREATE TRIGGER customer_linkage_history_immutable_trg
  BEFORE UPDATE OR DELETE ON public.customer_linkage_history
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_linkage_history_immutable_guard();

REVOKE ALL ON FUNCTION public.customer_linkage_history_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_linkage_history_immutable_guard() FROM anon;

COMMENT ON FUNCTION public.customer_linkage_history_immutable_guard() IS
  'CUSTOMER-05 append-only guard for customer_linkage_history.';

-- =============================================================================
-- CUSTOMER-04 — Append-only history immutability guards
-- Status: AUTHORED ONLY — do not apply without Owner authorization.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.customer_consent_history_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'customer_consent_history is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_preference_history_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'customer_preference_history is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS customer_consent_history_immutable_trg
  ON public.customer_consent_history;
CREATE TRIGGER customer_consent_history_immutable_trg
  BEFORE UPDATE OR DELETE ON public.customer_consent_history
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_consent_history_immutable_guard();

DROP TRIGGER IF EXISTS customer_preference_history_immutable_trg
  ON public.customer_preference_history;
CREATE TRIGGER customer_preference_history_immutable_trg
  BEFORE UPDATE OR DELETE ON public.customer_preference_history
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_preference_history_immutable_guard();

REVOKE ALL ON FUNCTION public.customer_consent_history_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_consent_history_immutable_guard() FROM anon;
REVOKE ALL ON FUNCTION public.customer_preference_history_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_preference_history_immutable_guard() FROM anon;

COMMENT ON FUNCTION public.customer_consent_history_immutable_guard() IS
  'CUSTOMER-04 append-only guard for customer_consent_history.';

COMMENT ON FUNCTION public.customer_preference_history_immutable_guard() IS
  'CUSTOMER-04 append-only guard for customer_preference_history.';

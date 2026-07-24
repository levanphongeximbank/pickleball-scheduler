-- =============================================================================
-- CUSTOMER-04 — Rollback / disable strategy
-- Status: AUTHORED ONLY. Prefer disable (revoke grants + drop policies) over
--         DROP TABLE when Staging already has data. Full DROP is last resort.
-- Does not touch CUSTOMER-03 customers / contact / address tables.
-- =============================================================================

SET search_path = public, pg_temp;

-- Soft disable: revoke client grants and drop SELECT policies
DROP POLICY IF EXISTS customer_consents_select ON public.customer_consents;
DROP POLICY IF EXISTS customer_consent_history_select ON public.customer_consent_history;
DROP POLICY IF EXISTS customer_prefs_select ON public.customer_communication_preferences;
DROP POLICY IF EXISTS customer_preference_history_select ON public.customer_preference_history;

REVOKE ALL ON TABLE public.customer_consents FROM authenticated;
REVOKE ALL ON TABLE public.customer_consent_history FROM authenticated;
REVOKE ALL ON TABLE public.customer_communication_preferences FROM authenticated;
REVOKE ALL ON TABLE public.customer_preference_history FROM authenticated;

REVOKE ALL ON FUNCTION public.customer_save_consent(jsonb, jsonb, integer) FROM service_role;
REVOKE ALL ON FUNCTION public.customer_save_preference(jsonb, jsonb, integer) FROM service_role;

-- Hard rollback (Owner-gated only; destroys CUSTOMER-04 objects)
DROP TRIGGER IF EXISTS customer_consent_history_immutable_trg ON public.customer_consent_history;
DROP TRIGGER IF EXISTS customer_preference_history_immutable_trg ON public.customer_preference_history;
DROP FUNCTION IF EXISTS public.customer_consent_history_immutable_guard();
DROP FUNCTION IF EXISTS public.customer_preference_history_immutable_guard();
DROP FUNCTION IF EXISTS public.customer_save_consent(jsonb, jsonb, integer);
DROP FUNCTION IF EXISTS public.customer_save_preference(jsonb, jsonb, integer);

DROP TABLE IF EXISTS public.customer_preference_history;
DROP TABLE IF EXISTS public.customer_communication_preferences;
DROP TABLE IF EXISTS public.customer_consent_history;
DROP TABLE IF EXISTS public.customer_consents;

-- =============================================================================
-- CRM Phase 1G — Grants and security hardening
-- Purpose: Restrict table/RPC grants. No anonymous access. No PUBLIC execute.
-- Status: AUTHORED ONLY — do not apply in Phase 1G.
-- =============================================================================

SET search_path = public, pg_temp;

-- Tables: revoke broad grants, allow authenticated DML gated by RLS
REVOKE ALL ON TABLE public.crm_tags FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_tags FROM anon;
REVOKE ALL ON TABLE public.crm_tag_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_tag_assignments FROM anon;
REVOKE ALL ON TABLE public.crm_consent_records FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_consent_records FROM anon;
REVOKE ALL ON TABLE public.crm_pending_events FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_pending_events FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_tags TO authenticated;
-- No DELETE on crm_tags

GRANT SELECT, INSERT, DELETE ON TABLE public.crm_tag_assignments TO authenticated;
-- No UPDATE required for assignments in Phase 1G

GRANT SELECT, INSERT ON TABLE public.crm_consent_records TO authenticated;
-- No UPDATE / DELETE on consent (append-only)

GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_pending_events TO authenticated;
-- No DELETE on pending events in Phase 1G

-- RPCs
REVOKE ALL ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  TO authenticated;

REVOKE ALL ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  TO authenticated;

-- service_role worker wiring is deferred (Phase 1H+). Do not grant PUBLIC.

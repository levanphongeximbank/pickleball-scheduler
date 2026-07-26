-- =============================================================================
-- BM-FINAL-SAFETY-01 — Exact rollback for Staging grant remediation
-- Status: PREPARED ONLY — use only to restore pre-remediation grants if needed
-- Target project ref (exact): qyewbxjsiiyufanzcjcq
-- Production ref (blocked):   expuvcohlcjzvrrauvud
--
-- Restores the exact excess grants observed in Phase A read-only evidence.
-- Does not modify data rows or schema objects.
-- =============================================================================

BEGIN;

GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_tags
  TO authenticated;

GRANT TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_tag_assignments
  TO authenticated;

GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_consent_records
  TO authenticated;

GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_pending_events
  TO authenticated;

GRANT EXECUTE
  ON FUNCTION public.crm_phase1g_scope_allows(text, text)
  TO anon;

COMMIT;

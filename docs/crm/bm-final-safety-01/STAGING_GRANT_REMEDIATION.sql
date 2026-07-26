-- =============================================================================
-- BM-FINAL-SAFETY-01 — Staging-only least-privilege grant remediation
-- Status: PREPARED ONLY — DO NOT EXECUTE without Owner execution approval #2
-- Target project ref (exact): qyewbxjsiiyufanzcjcq
-- Production ref (blocked):   expuvcohlcjzvrrauvud
--
-- Scope (evidence-bounded):
--   1) Revoke excess authenticated table privileges proven by read-only audit:
--      DELETE, TRUNCATE, REFERENCES, TRIGGER where not in canonical design.
--   2) Revoke anon EXECUTE on public.crm_phase1g_scope_allows.
--
-- Guarantees:
--   - No INSERT/UPDATE/DELETE against CRM data rows
--   - No CREATE/ALTER/DROP of schema objects
--   - No role-matrix changes
--   - No Production connection
-- =============================================================================

BEGIN;

-- Identity assertion inside the mutation transaction (fail closed).
DO $$
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'database identity unavailable';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A. crm_tags
-- Desired authenticated: SELECT, INSERT, UPDATE
-- Excess to remove: DELETE, TRUNCATE, REFERENCES, TRIGGER
-- ---------------------------------------------------------------------------
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_tags
  FROM authenticated;

-- ---------------------------------------------------------------------------
-- B. crm_tag_assignments
-- Desired authenticated: SELECT, INSERT, DELETE
-- Excess to remove: TRUNCATE, REFERENCES, TRIGGER
-- (DELETE is kept — it is part of the canonical design.)
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_tag_assignments
  FROM authenticated;

-- ---------------------------------------------------------------------------
-- C. crm_consent_records
-- Desired authenticated: SELECT, INSERT
-- Excess to remove: DELETE, TRUNCATE, REFERENCES, TRIGGER
-- ---------------------------------------------------------------------------
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_consent_records
  FROM authenticated;

-- ---------------------------------------------------------------------------
-- D. crm_pending_events
-- Desired authenticated: SELECT, INSERT, UPDATE
-- Excess to remove: DELETE, TRUNCATE, REFERENCES, TRIGGER
-- ---------------------------------------------------------------------------
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_pending_events
  FROM authenticated;

-- ---------------------------------------------------------------------------
-- E. crm_phase1g_scope_allows
-- Canonical contract grants EXECUTE to authenticated only.
-- Excess proven: anon EXECUTE
-- ---------------------------------------------------------------------------
REVOKE EXECUTE
  ON FUNCTION public.crm_phase1g_scope_allows(text, text)
  FROM anon;

COMMIT;

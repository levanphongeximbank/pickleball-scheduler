-- =============================================================================
-- OPERATION B1B — WP1 Rollback Artifact
-- Target: public.qa_identity_quarantines and WP1-created guards only
-- Status: AUTHORED ONLY — NOT EXECUTED.
-- Do not run against Staging or Production without a separate Owner GO.
--
-- Removes only WP1-created objects, dependency-safe order:
--   1) hard-delete deny trigger/function
--   2) immutable-field trigger/function
--   3) table (indexes + constraints drop with table)
--
-- Does NOT:
--   - alter public.profiles
--   - alter profiles_status_check
--   - delete Auth users
--   - modify unrelated objects
--   - use CASCADE
-- =============================================================================

SET search_path = public, pg_temp;

-- 1) Hard-delete denial
DROP TRIGGER IF EXISTS qa_identity_quarantines_deny_hard_delete_trg
  ON public.qa_identity_quarantines;
DROP FUNCTION IF EXISTS public.qa_identity_quarantines_deny_hard_delete();

-- 2) Immutable-field enforcement
DROP TRIGGER IF EXISTS qa_identity_quarantines_immutable_fields_trg
  ON public.qa_identity_quarantines;
DROP FUNCTION IF EXISTS public.qa_identity_quarantines_immutable_fields_guard();

-- 3) Canonical authority table (indexes/constraints removed with table)
DROP TABLE IF EXISTS public.qa_identity_quarantines;

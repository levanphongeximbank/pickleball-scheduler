-- =============================================================================
-- CRM Phase 1G — Optional immutable consent enforcement (trigger)
-- Purpose: Block UPDATE and DELETE on crm_consent_records to enforce
--          append-only history at the database layer.
-- Status: AUTHORED ONLY — do not apply in Phase 1G.
--
-- Rollback implications:
--   Dropping this trigger is required before any emergency schema maintenance
--   that must UPDATE/DELETE consent rows. Prefer appending corrective rows
--   instead of mutating history. Controlled path: DROP TRIGGER then perform
--   maintenance as a privileged operator, then recreate the trigger.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.crm_consent_records_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'crm_consent_records is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'integrity_constraint_violation';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS crm_consent_records_immutable_trg ON public.crm_consent_records;

CREATE TRIGGER crm_consent_records_immutable_trg
  BEFORE UPDATE OR DELETE ON public.crm_consent_records
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_consent_records_immutable_guard();

REVOKE ALL ON FUNCTION public.crm_consent_records_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_consent_records_immutable_guard() FROM anon;

COMMENT ON FUNCTION public.crm_consent_records_immutable_guard() IS
  'CRM Phase 1G append-only guard for crm_consent_records. Blocks UPDATE and DELETE.';

-- =============================================================================
-- OPERATION B1B — WP2 Rollback Artifact
-- Target: WP2 RLS + controlled writer/read RPCs + WP2-only helpers only
-- Status: AUTHORED ONLY — NOT EXECUTED.
-- Do not run against Staging or Production without a separate Owner GO.
--
-- Dependency-safe order (must run BEFORE WP1 90_QA_IDENTITY_QUARANTINES_ROLLBACK):
--   1) Revoke WP2 RPC EXECUTE grants
--   2) Drop set-based read RPC
--   3) Drop state readback RPC
--   4) Drop five lifecycle RPCs
--   5) Drop WP2-only helpers
--   6) Disable RLS enabled by WP2 (no WP2 table policies were created)
--   7) Preserve WP1 table, constraints, indexes, triggers, and rows
--
-- Does NOT:
--   - DROP public.qa_identity_quarantines
--   - run WP1 rollback
--   - delete quarantine data
--   - use CASCADE
--   - alter profiles / profiles_status_check
--   - mutate auth.users
--   - drop public.audit_logs
--   - remove additive audit_logs_action_check values (rows may reference them)
-- =============================================================================

SET search_path = public, auth, pg_temp;

-- 1) Revoke EXECUTE grants on exposed WP2 RPCs (idempotent)
DO $revoke$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'public.qa_quarantine_list_active(uuid[])',
    'public.qa_quarantine_get_state(uuid)',
    'public.qa_quarantine_release(uuid, integer, text)',
    'public.qa_quarantine_record_compensated_failure(uuid, integer, text, text)',
    'public.qa_quarantine_activate_preexisting_ban(uuid, integer)',
    'public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean)',
    'public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb)',
    'public.operation_b1b_validate_qa_prepare_contract(jsonb)'
  ]
  LOOP
    IF to_regprocedure(r) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', r);
    END IF;
  END LOOP;
END
$revoke$;

-- 2) Drop set-based read RPC
DROP FUNCTION IF EXISTS public.qa_quarantine_list_active(uuid[]);

-- 3) Drop state readback RPC
DROP FUNCTION IF EXISTS public.qa_quarantine_get_state(uuid);

-- 4) Drop five lifecycle writer RPCs
DROP FUNCTION IF EXISTS public.qa_quarantine_release(uuid, integer, text);
DROP FUNCTION IF EXISTS public.qa_quarantine_record_compensated_failure(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.qa_quarantine_activate_preexisting_ban(uuid, integer);
DROP FUNCTION IF EXISTS public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean);
DROP FUNCTION IF EXISTS public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb);

-- 4b) Drop Option C preclaim / contract helpers
DROP FUNCTION IF EXISTS public.operation_b1b_validate_qa_prepare_contract(jsonb);
DROP FUNCTION IF EXISTS public.operation_b1b_qa_label_email_contract_is_valid(text, text);
DROP FUNCTION IF EXISTS public.operation_b1b_qa_label_email_contract_check(text, text);

-- 5) Drop WP2-only internal helpers
DROP FUNCTION IF EXISTS public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb);
DROP FUNCTION IF EXISTS public.qa_quarantine_actor_text();
DROP FUNCTION IF EXISTS public.qa_quarantine_is_directory_filter_reader();
DROP FUNCTION IF EXISTS public.qa_quarantine_is_authorized_caller();
DROP FUNCTION IF EXISTS public.qa_quarantine_is_service_role();

-- Ensure forbidden batched alias remains absent (no-op if never created)
DROP FUNCTION IF EXISTS public.qa_quarantine_list_active_batched(uuid[]);

-- 6) Restore WP1 RLS posture: WP1 did not enable RLS; WP2 enabled it with zero policies.
--    No WP2 CREATE POLICY objects were authored, so none are dropped here.
ALTER TABLE IF EXISTS public.qa_identity_quarantines DISABLE ROW LEVEL SECURITY;

-- Preserve WP1 table privilege lockdown (do not re-grant direct DML)
DO $table_lock$
BEGIN
  IF to_regclass('public.qa_identity_quarantines') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC;
    REVOKE ALL ON TABLE public.qa_identity_quarantines FROM anon;
    REVOKE ALL ON TABLE public.qa_identity_quarantines FROM authenticated;
  END IF;
END
$table_lock$;

-- Explicit preservation markers (no-op references for reviewers/tests):
--   public.qa_identity_quarantines table retained
--   qa_identity_quarantines_immutable_fields_trg retained
--   qa_identity_quarantines_deny_hard_delete_trg retained
--   public.audit_logs retained
--   NO CASCADE
--   OLD_OWNER_GO_REUSABLE=NO
--   OLD_BATCH_REUSABLE=NO
--   BATCH_ID=b37186cf-e620-4f27-aba3-d7e8750ae7df non-reusable

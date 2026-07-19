-- PICK_VN Notification Phase 2B — Production rollback pack
-- PRODUCTION ONLY. Project ref: expuvcohlcjzvrrauvud
--
-- Reverse ONLY Notification-owned objects.
-- Do NOT remove shared Platform / Identity / audit_logs / Competition Engine objects.
--
-- Rollback order (reverse of apply):
--   1. Security grants note (no-op / re-apply Staging grants only if intentional)
--   2. Ops RPCs + worker_runs (phase16-equivalent) — DEFAULT: preserve data columns
--   3. Delivery attempts + runtime config + claim RPCs (phase15-equivalent)
--   4. Foundation inbox/jobs (phase13-equivalent) — DESTRUCTIVE; requires confirm
--
-- Modes:
--   A) DATA-PRESERVING (default): drop Notification RPCs / worker_runs / attempts /
--      runtime_config; KEEP notification_inbox + notification_delivery_jobs rows.
--   B) DESTRUCTIVE: also DROP inbox + jobs tables. Requires explicit operator confirm
--      in apply-rollback script (NOTIFICATION_PHASE2B_DESTRUCTIVE_ROLLBACK=1).
--
-- Guards:
--   - Refuse if runtime environment is staging (wrong target)
--   - Refuse if project_ref is Staging QA ref
--   - Prefer preserving queued and delivered records
--
-- Post-rollback verification:
--   node scripts/verify-notification-phase2b-production.mjs
--   Expect: missing objects reported as findings (not crash) → FAIL or PASS depending mode

-- ═══════════════════════════════════════════════════════════════════
-- PREFLIGHT GUARD (always run first)
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_env text;
  v_ref text;
BEGIN
  BEGIN
    SELECT value INTO v_env FROM public.notification_runtime_config WHERE key = 'environment';
  EXCEPTION WHEN undefined_table THEN
    v_env := NULL;
  END;
  BEGIN
    SELECT value INTO v_ref FROM public.notification_runtime_config WHERE key = 'project_ref';
  EXCEPTION WHEN undefined_table THEN
    v_ref := NULL;
  END;

  IF coalesce(v_env, '') = 'staging' THEN
    RAISE EXCEPTION 'phase2b_rollback_refuses_staging_environment';
  END IF;
  IF coalesce(v_ref, '') = 'qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION 'phase2b_rollback_refuses_staging_project_ref';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION A — DATA-PRESERVING (default)
-- Drops Notification ops/worker RPCs and auxiliary tables only.
-- ═══════════════════════════════════════════════════════════════════

-- Phase 16-equivalent ops RPCs
DROP FUNCTION IF EXISTS public.notification_delivery_list_dead_letters(text, text, integer);
DROP FUNCTION IF EXISTS public.notification_qa_cleanup_run_namespace(text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.notification_delivery_recover_stale_leases(text, text, text, integer);
DROP FUNCTION IF EXISTS public.notification_delivery_replay_job(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.notification_delivery_cancel_job(uuid, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.notification_queue_health(text, text);
DROP FUNCTION IF EXISTS public.notification_worker_mark_abandoned_runs(text, integer);
DROP FUNCTION IF EXISTS public.notification_worker_run_complete(
  text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer
);
DROP FUNCTION IF EXISTS public.notification_worker_run_heartbeat(text);
DROP FUNCTION IF EXISTS public.notification_worker_run_start(text, text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.notification_assert_environment_allowed(text, boolean);
DROP FUNCTION IF EXISTS public.notification_sanitize_reason(text, integer);
DROP FUNCTION IF EXISTS public.notification_caller_tenant_id();
DROP FUNCTION IF EXISTS public.notification_is_queue_admin();
DROP FUNCTION IF EXISTS public.notification_delivery_claim_jobs(text, integer, integer, text, text, text, text);

DROP TABLE IF EXISTS public.notification_worker_runs;

DROP INDEX IF EXISTS idx_notification_delivery_jobs_active_channel;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_dead_letter;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_run_namespace;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_env_claim;

-- Phase 15-equivalent worker RPCs + attempts + runtime config
DROP FUNCTION IF EXISTS public.notification_qa_cleanup_namespaced_inbox(text, text, uuid[], text);
DROP FUNCTION IF EXISTS public.notification_delivery_complete_job(
  uuid, uuid, text, text, text, text, timestamptz, text, text, integer, boolean
);
DROP FUNCTION IF EXISTS public.notification_delivery_record_attempt(
  uuid, integer, text, text, text, text, text, text, boolean, timestamptz, text, text, timestamptz, timestamptz
);
DROP FUNCTION IF EXISTS public.notification_delivery_claim_jobs(text, integer, integer, text);
DROP FUNCTION IF EXISTS public.notification_delivery_assert_transition(text, text, boolean);
DROP FUNCTION IF EXISTS public.notification_runtime_config_get(text);
DROP FUNCTION IF EXISTS public.notification_delivery_is_service_role();

DROP TABLE IF EXISTS public.notification_delivery_attempts CASCADE;
DROP TABLE IF EXISTS public.notification_runtime_config CASCADE;

DROP INDEX IF EXISTS idx_notification_delivery_jobs_claim;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_lease;

-- NOTE: notification_inbox and notification_delivery_jobs rows are PRESERVED by default.
-- Environment / lease columns on jobs are left in place (non-destructive).

-- ═══════════════════════════════════════════════════════════════════
-- SECTION B — DESTRUCTIVE (commented; enable only with explicit confirm)
-- Uncomment ONLY after Owner approval + NOTIFICATION_PHASE2B_DESTRUCTIVE_ROLLBACK=1
-- ═══════════════════════════════════════════════════════════════════
-- DROP FUNCTION IF EXISTS public.notification_delivery_enqueue(uuid, text, text, text, text, text, text);
-- DROP FUNCTION IF EXISTS public.notification_inbox_create(...);
-- DROP TABLE IF EXISTS public.notification_delivery_jobs CASCADE;
-- DROP TABLE IF EXISTS public.notification_inbox CASCADE;

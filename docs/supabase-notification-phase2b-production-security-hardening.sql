-- PICK_VN Notification Phase 2B — Production security hardening
-- PRODUCTION ONLY. Project ref: expuvcohlcjzvrrauvud
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: production-13..16 + runtime-config
-- Re-run: GRANT/REVOKE / ALTER FUNCTION safe
-- Transaction boundaries: single batch; stop on first error
--
-- Goals:
-- 1. SECURITY DEFINER functions SET search_path = public
-- 2. Worker RPCs remain service_role-only
-- 3. Revoke anon / authenticated / PUBLIC execute where applicable
-- 4. No first-tenant / first-venue fallback (enforced in RPC bodies)

BEGIN;

-- ─── Helper: assert search_path on known Notification SECURITY DEFINER fns ──
DO $$
DECLARE
  r record;
  v_has_path boolean;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname LIKE 'notification_%'
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_proc p2,
           LATERAL unnest(coalesce(p2.proconfig, array[]::text[])) AS cfg
      WHERE p2.oid = r.oid
        AND (cfg LIKE 'search_path=%public%' OR cfg = 'search_path=public')
    ) INTO v_has_path;

    IF NOT v_has_path THEN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public',
        r.proname,
        r.args
      );
      RAISE NOTICE 'phase2b: set search_path=public on public.%(%)',
        r.proname, r.args;
    END IF;
  END LOOP;
END $$;

-- ─── Revoke client roles from worker / ops RPCs ─────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS reg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'notification_delivery_claim_jobs',
        'notification_delivery_complete_job',
        'notification_delivery_record_attempt',
        'notification_delivery_recover_stale_leases',
        'notification_delivery_replay_job',
        'notification_delivery_cancel_job',
        'notification_qa_cleanup_namespaced_inbox',
        'notification_qa_cleanup_run_namespace',
        'notification_worker_run_start',
        'notification_worker_run_heartbeat',
        'notification_worker_run_complete',
        'notification_worker_mark_abandoned_runs',
        'notification_delivery_is_service_role',
        'notification_runtime_config_get',
        'notification_assert_environment_allowed'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.reg);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.reg);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.reg);
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.reg);
    EXCEPTION WHEN undefined_object THEN
      RAISE NOTICE 'phase2b: service_role missing — skip GRANT for %', r.reg;
    END;
  END LOOP;
END $$;

-- Queue health / dead-letters: admin or service_role only (revoke PUBLIC)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS reg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'notification_queue_health',
        'notification_delivery_list_dead_letters',
        'notification_is_queue_admin',
        'notification_caller_tenant_id',
        'notification_sanitize_reason'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.reg);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.reg);
  END LOOP;
END $$;

-- ─── Re-assert fail-closed runtime config (idempotent) ──────────────
INSERT INTO public.notification_runtime_config (key, value, updated_at)
VALUES
  ('environment', 'production', now()),
  ('project_ref', 'expuvcohlcjzvrrauvud', now()),
  ('allow_qa_cleanup', 'false', now()),
  ('allow_worker', 'false', now()),
  ('live_delivery_enabled', 'false', now()),
  ('external_providers_enabled', 'false', now()),
  ('worker_concurrency', '0', now()),
  ('production_worker_enable', 'false', now()),
  ('production_rollout_approved', 'false', now()),
  ('allow_replay', 'false', now()),
  ('allow_cancel', 'false', now()),
  ('allow_stale_lease_recovery', 'false', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

COMMIT;

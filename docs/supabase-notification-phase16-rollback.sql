-- PICK_VN Notification Phase 1.6 ROLLBACK
-- Staging only. Does NOT drop Phase 1.5 tables/functions.
-- Leaves environment columns on jobs (non-destructive) unless empty.

-- Ops RPCs
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

DROP TABLE IF EXISTS public.notification_worker_runs;

DROP INDEX IF EXISTS idx_notification_delivery_jobs_active_channel;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_dead_letter;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_run_namespace;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_env_claim;

-- Restore Phase 1.5 claim signature (4 args)
DROP FUNCTION IF EXISTS public.notification_delivery_claim_jobs(text, integer, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.notification_delivery_claim_jobs(
  p_worker_id text,
  p_batch_size integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 60,
  p_tenant_id text DEFAULT NULL
)
RETURNS SETOF public.notification_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_lease interval;
  v_allow text;
  v_env text;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_worker');
  v_env := public.notification_runtime_config_get('environment');
  IF COALESCE(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'worker_disabled';
  END IF;
  IF COALESCE(v_env, '') = 'production' THEN
    RAISE EXCEPTION 'production_worker_blocked';
  END IF;

  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'worker_id_required';
  END IF;

  v_limit := LEAST(50, GREATEST(1, COALESCE(p_batch_size, 10)));
  v_lease := make_interval(secs => LEAST(300, GREATEST(5, COALESCE(p_lease_seconds, 60))));

  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.notification_delivery_jobs j
    WHERE (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id)
      AND (
        (
          j.status IN ('QUEUED', 'RETRY_SCHEDULED')
          AND j.next_attempt_at <= now()
        )
        OR (
          j.status = 'PROCESSING'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at < now()
        )
      )
    ORDER BY j.priority ASC, j.next_attempt_at ASC, j.created_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.notification_delivery_jobs j
    SET status = 'PROCESSING',
        worker_id = trim(p_worker_id),
        claimed_at = now(),
        lease_expires_at = now() + v_lease,
        claim_token = gen_random_uuid(),
        updated_at = now()
    FROM picked
    WHERE j.id = picked.id
    RETURNING j.*
  )
  SELECT * FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_claim_jobs(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_claim_jobs(text, integer, integer, text) TO service_role;

-- Restore Phase 1.5 enqueue (3 args) — re-apply from phase15.sql if needed
DROP FUNCTION IF EXISTS public.notification_delivery_enqueue(uuid, text, text, text, text);

-- Restore QA cleanup to phase14s-only (re-apply phase15 body)
CREATE OR REPLACE FUNCTION public.notification_qa_cleanup_namespaced_inbox(
  p_tenant_id text,
  p_namespace_prefix text,
  p_ids uuid[],
  p_expected_project_ref text DEFAULT 'qyewbxjsiiyufanzcjcq'
)
RETURNS TABLE (deleted_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow text;
  v_env text;
  v_ref text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_qa_cleanup');
  v_env := public.notification_runtime_config_get('environment');
  v_ref := public.notification_runtime_config_get('project_ref');

  IF COALESCE(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'qa_cleanup_disabled';
  END IF;
  IF COALESCE(v_env, '') = 'production' THEN
    RAISE EXCEPTION 'qa_cleanup_disabled_in_production';
  END IF;
  IF COALESCE(v_ref, '') <> COALESCE(p_expected_project_ref, '') THEN
    RAISE EXCEPTION 'project_ref_mismatch';
  END IF;
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
    RAISE EXCEPTION 'tenant_id_required';
  END IF;
  IF p_namespace_prefix IS NULL OR p_namespace_prefix NOT LIKE 'phase14s:%' THEN
    RAISE EXCEPTION 'invalid_namespace';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  DELETE FROM public.notification_inbox n
  WHERE n.tenant_id = p_tenant_id
    AND n.recipient_user_id = v_uid
    AND n.id = ANY (p_ids)
    AND n.idempotency_key LIKE (p_namespace_prefix || '%')
  RETURNING n.id;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_qa_cleanup_namespaced_inbox(text, text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_qa_cleanup_namespaced_inbox(text, text, uuid[], text) TO authenticated;

DELETE FROM public.notification_runtime_config
WHERE key IN (
  'allow_replay',
  'allow_cancel',
  'allow_stale_lease_recovery',
  'max_replay_count',
  'worker_heartbeat_stale_seconds',
  'phase16_ops_enabled'
);

-- NOTE: environment / run_namespace / cancel / replay columns on jobs are retained
-- (non-destructive). Re-apply docs/supabase-notification-phase15.sql enqueue if dropped.

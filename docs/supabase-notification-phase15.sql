-- PICK_VN Notification Phase 1.5
-- Delivery worker foundation: claim/lease, attempts, retry, QA cleanup
-- Apply on Staging only. Do NOT apply to Production.
-- Rollback: docs/supabase-notification-phase15-rollback.sql
--
-- Extends Phase 1.3 notification_delivery_jobs. Leaves legacy public.notifications intact.
-- Live Email/SMS/Zalo/Web Push are NOT enabled by this migration.

-- ─── Runtime config (staging flags; Production must not enable QA cleanup/worker) ─
CREATE TABLE IF NOT EXISTS public.notification_runtime_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_runtime_config_no_client ON public.notification_runtime_config;
CREATE POLICY notification_runtime_config_no_client ON public.notification_runtime_config
  FOR ALL
  USING (false)
  WITH CHECK (false);

INSERT INTO public.notification_runtime_config (key, value, updated_at)
VALUES
  ('environment', 'staging', now()),
  ('project_ref', 'qyewbxjsiiyufanzcjcq', now()),
  ('allow_qa_cleanup', 'true', now()),
  ('allow_worker', 'true', now()),
  ('live_delivery_enabled', 'false', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- ─── Expand delivery job statuses + worker columns ──────────────────
ALTER TABLE public.notification_delivery_jobs
  DROP CONSTRAINT IF EXISTS notification_delivery_jobs_status_check;

ALTER TABLE public.notification_delivery_jobs
  ADD CONSTRAINT notification_delivery_jobs_status_check
  CHECK (status IN (
    'CREATED',
    'QUEUED',
    'PROCESSING',
    'SENT',
    'RETRY_SCHEDULED',
    'FAILED',
    'DEAD_LETTERED',
    'CANCELLED'
  ));

ALTER TABLE public.notification_delivery_jobs
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS delivery_mode text,
  ADD COLUMN IF NOT EXISTS delivery_idempotency_key text;

UPDATE public.notification_delivery_jobs
SET next_attempt_at = COALESCE(next_attempt_at, scheduled_at, now())
WHERE next_attempt_at IS NULL;

DROP INDEX IF EXISTS idx_notification_delivery_jobs_queue;
CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_claim
  ON public.notification_delivery_jobs (priority ASC, next_attempt_at ASC, created_at ASC)
  WHERE status IN ('QUEUED', 'RETRY_SCHEDULED', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_lease
  ON public.notification_delivery_jobs (lease_expires_at)
  WHERE status = 'PROCESSING';

-- ─── Delivery attempts audit ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.notification_delivery_jobs(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  worker_id text NOT NULL,
  channel text NOT NULL,
  provider text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result text NOT NULL DEFAULT 'STARTED'
    CHECK (result IN (
      'STARTED',
      'SUCCESS',
      'TRANSIENT_FAILURE',
      'PERMANENT_FAILURE',
      'SKIPPED'
    )),
  error_code text,
  sanitized_error_message text,
  retryable boolean NOT NULL DEFAULT false,
  next_attempt_at timestamptz,
  provider_message_id text,
  delivery_mode text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_attempts_job_attempt_uq UNIQUE (job_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_job
  ON public.notification_delivery_attempts (job_id, attempt_number);

ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

-- Attempts are worker/service_role only — no browser policies.
DROP POLICY IF EXISTS notification_delivery_attempts_no_client ON public.notification_delivery_attempts;
CREATE POLICY notification_delivery_attempts_no_client ON public.notification_delivery_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Helpers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      current_setting('request.jwt.claim.role', true),
      (auth.jwt() ->> 'role')
    ) = 'service_role'
    -- Staging/server scripts using SUPABASE_DB_URL may set this for one transaction:
    OR COALESCE(current_setting('app.notification_worker_role', true), '') = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_is_service_role() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notification_runtime_config_get(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.notification_runtime_config WHERE key = p_key LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.notification_runtime_config_get(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notification_delivery_assert_transition(
  p_from text,
  p_to text,
  p_explicit_retry boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION 'noop_transition';
  END IF;

  IF p_from = 'CREATED' AND p_to IN ('QUEUED', 'CANCELLED') THEN
    RETURN;
  ELSIF p_from = 'QUEUED' AND p_to IN ('PROCESSING', 'CANCELLED') THEN
    RETURN;
  ELSIF p_from = 'PROCESSING' AND p_to IN ('SENT', 'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED') THEN
    RETURN;
  ELSIF p_from = 'RETRY_SCHEDULED' AND p_to IN ('PROCESSING', 'CANCELLED') THEN
    RETURN;
  ELSIF p_from = 'FAILED' AND p_to = 'RETRY_SCHEDULED' THEN
    IF NOT COALESCE(p_explicit_retry, false) THEN
      RAISE EXCEPTION 'failed_retry_requires_explicit';
    END IF;
    RETURN;
  ELSIF p_from = 'FAILED' AND p_to = 'CANCELLED' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_transition: % -> %', p_from, p_to;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_assert_transition(text, text, boolean) FROM PUBLIC;

-- ─── Claim jobs (service_role only) ─────────────────────────────────
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

-- ─── Record attempt (service_role only) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_record_attempt(
  p_job_id uuid,
  p_attempt_number integer,
  p_worker_id text,
  p_channel text,
  p_provider text,
  p_result text,
  p_error_code text DEFAULT NULL,
  p_sanitized_error_message text DEFAULT NULL,
  p_retryable boolean DEFAULT false,
  p_next_attempt_at timestamptz DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL,
  p_delivery_mode text DEFAULT 'sandbox',
  p_started_at timestamptz DEFAULT now(),
  p_completed_at timestamptz DEFAULT now()
)
RETURNS public.notification_delivery_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_delivery_attempts;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  INSERT INTO public.notification_delivery_attempts (
    job_id,
    attempt_number,
    worker_id,
    channel,
    provider,
    started_at,
    completed_at,
    result,
    error_code,
    sanitized_error_message,
    retryable,
    next_attempt_at,
    provider_message_id,
    delivery_mode
  ) VALUES (
    p_job_id,
    p_attempt_number,
    p_worker_id,
    p_channel,
    p_provider,
    COALESCE(p_started_at, now()),
    p_completed_at,
    COALESCE(NULLIF(trim(p_result), ''), 'STARTED'),
    NULLIF(trim(p_error_code), ''),
    NULLIF(left(COALESCE(p_sanitized_error_message, ''), 400), ''),
    COALESCE(p_retryable, false),
    p_next_attempt_at,
    NULLIF(trim(p_provider_message_id), ''),
    COALESCE(NULLIF(trim(p_delivery_mode), ''), 'sandbox')
  )
  ON CONFLICT (job_id, attempt_number) DO UPDATE
  SET completed_at = EXCLUDED.completed_at,
      result = EXCLUDED.result,
      error_code = EXCLUDED.error_code,
      sanitized_error_message = EXCLUDED.sanitized_error_message,
      retryable = EXCLUDED.retryable,
      next_attempt_at = EXCLUDED.next_attempt_at,
      provider_message_id = EXCLUDED.provider_message_id,
      delivery_mode = EXCLUDED.delivery_mode
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_record_attempt(
  uuid, integer, text, text, text, text, text, text, boolean, timestamptz, text, text, timestamptz, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_record_attempt(
  uuid, integer, text, text, text, text, text, text, boolean, timestamptz, text, text, timestamptz, timestamptz
) TO service_role;

-- ─── Complete / fail / retry job (service_role only) ────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_complete_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_worker_id text,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_last_error text DEFAULT NULL,
  p_next_attempt_at timestamptz DEFAULT NULL,
  p_delivery_mode text DEFAULT NULL,
  p_delivery_idempotency_key text DEFAULT NULL,
  p_attempt_number integer DEFAULT NULL,
  p_explicit_retry boolean DEFAULT false
)
RETURNS public.notification_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.notification_delivery_jobs;
  v_sanitized text;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT * INTO v_job
  FROM public.notification_delivery_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_job.claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'claim_token_mismatch';
  END IF;
  IF v_job.worker_id IS DISTINCT FROM p_worker_id THEN
    RAISE EXCEPTION 'worker_id_mismatch';
  END IF;

  PERFORM public.notification_delivery_assert_transition(
    v_job.status,
    p_status,
    COALESCE(p_explicit_retry, false)
  );

  v_sanitized := NULLIF(left(COALESCE(p_last_error, ''), 400), '');

  UPDATE public.notification_delivery_jobs
  SET status = p_status,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      last_error = CASE WHEN p_last_error IS NULL THEN last_error ELSE v_sanitized END,
      next_attempt_at = CASE
        WHEN p_status = 'RETRY_SCHEDULED' THEN COALESCE(p_next_attempt_at, now())
        ELSE next_attempt_at
      END,
      attempts = COALESCE(p_attempt_number, attempts + 1),
      delivery_mode = COALESCE(NULLIF(trim(p_delivery_mode), ''), delivery_mode),
      delivery_idempotency_key = COALESCE(
        NULLIF(trim(p_delivery_idempotency_key), ''),
        delivery_idempotency_key
      ),
      processed_at = CASE
        WHEN p_status IN ('SENT', 'DEAD_LETTERED', 'CANCELLED') THEN now()
        ELSE processed_at
      END,
      worker_id = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      claim_token = NULL,
      updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  -- in_app success/failure updates inbox delivery status without creating rows
  IF v_job.channel = 'in_app' AND p_status IN ('SENT', 'FAILED') THEN
    UPDATE public.notification_inbox n
    SET status = CASE
          WHEN n.status = 'READ' THEN n.status
          WHEN p_status = 'SENT' THEN 'SENT'
          ELSE 'FAILED'
        END,
        updated_at = now()
    WHERE n.id = v_job.notification_id
      AND n.status <> 'READ';
  END IF;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_complete_job(
  uuid, uuid, text, text, text, text, timestamptz, text, text, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_complete_job(
  uuid, uuid, text, text, text, text, timestamptz, text, text, integer, boolean
) TO service_role;

-- ─── Phase 1.4S QA cleanup (authenticated recipient; staging-only; namespaced) ─
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

-- Keep enqueue compatible + Phase 1.3 hardening tenant checks; stamp priority/next_attempt_at
CREATE OR REPLACE FUNCTION public.notification_delivery_enqueue(
  p_notification_id uuid,
  p_tenant_id text,
  p_channel text DEFAULT 'in_app'
)
RETURNS public.notification_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.notification_delivery_jobs;
  v_channel text;
  v_inbox public.notification_inbox;
  v_caller_venue text;
  v_priority integer := 100;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.venue_id INTO v_caller_venue
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND coalesce(p.status, 'active') = 'active';

  IF v_caller_venue IS NULL OR v_caller_venue IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'tenant_scope_denied';
  END IF;

  SELECT * INTO v_inbox
  FROM public.notification_inbox
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_not_found';
  END IF;

  IF v_inbox.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'notification_tenant_mismatch';
  END IF;

  v_channel := COALESCE(NULLIF(trim(p_channel), ''), 'in_app');

  IF upper(COALESCE(v_inbox.priority, 'NORMAL')) IN ('URGENT', 'CRITICAL') THEN
    v_priority := 10;
  ELSIF upper(COALESCE(v_inbox.priority, 'NORMAL')) = 'HIGH' THEN
    v_priority := 30;
  ELSIF upper(COALESCE(v_inbox.priority, 'NORMAL')) = 'LOW' THEN
    v_priority := 200;
  ELSE
    v_priority := 100;
  END IF;

  SELECT * INTO v_job
  FROM public.notification_delivery_jobs
  WHERE notification_id = p_notification_id
    AND channel = v_channel;

  IF FOUND THEN
    RETURN v_job;
  END IF;

  INSERT INTO public.notification_delivery_jobs (
    notification_id,
    tenant_id,
    channel,
    status,
    scheduled_at,
    next_attempt_at,
    priority,
    max_attempts
  ) VALUES (
    p_notification_id,
    p_tenant_id,
    v_channel,
    'QUEUED',
    now(),
    now(),
    v_priority,
    5
  )
  RETURNING * INTO v_job;

  UPDATE public.notification_inbox
  SET status = 'QUEUED',
      updated_at = now()
  WHERE id = p_notification_id
    AND status = 'CREATED';

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_enqueue(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_enqueue(uuid, text, text) TO authenticated;

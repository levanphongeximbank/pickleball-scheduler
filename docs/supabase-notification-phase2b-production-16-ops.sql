-- PICK_VN Notification Phase 2B — Production Ops Schema (from Phase 1.6)
-- PRODUCTION ONLY. Project ref: expuvcohlcjzvrrauvud
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: docs/supabase-notification-phase2b-production-15-delivery-worker.sql
-- Re-run: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT config upsert safe
--
-- FAIL-CLOSED seeds: allow_worker=false, allow_qa_cleanup=false, allow_replay=false,
-- allow_cancel=false, allow_stale_lease_recovery=false, live_delivery_enabled=false
-- Environment column DEFAULT = production. No Staging seeds. No QA cleanup enablement.
-- Live Email/SMS/Zalo/Web Push remain disabled. Worker remains structurally disabled.

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
  ('allow_stale_lease_recovery', 'false', now()),
  ('max_replay_count', '3', now()),
  ('worker_heartbeat_stale_seconds', '120', now()),
  ('phase16_ops_enabled', 'true', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- ─── Environment + scope columns on delivery jobs ───────────────────
ALTER TABLE public.notification_delivery_jobs
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS run_namespace text,
  ADD COLUMN IF NOT EXISTS job_source text,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS replayed_from_job_id uuid,
  ADD COLUMN IF NOT EXISTS replay_requested_by text,
  ADD COLUMN IF NOT EXISTS replay_reason text,
  ADD COLUMN IF NOT EXISTS replay_generation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_count integer NOT NULL DEFAULT 0;

-- Backfill environment from runtime config (fail-closed default staging for existing Staging rows)
UPDATE public.notification_delivery_jobs
SET environment = COALESCE(
  environment,
  public.notification_runtime_config_get('environment'),
  'production'
)
WHERE environment IS NULL;

ALTER TABLE public.notification_delivery_jobs
  ALTER COLUMN environment SET DEFAULT 'production';

ALTER TABLE public.notification_delivery_jobs
  ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.notification_delivery_jobs
  DROP CONSTRAINT IF EXISTS notification_delivery_jobs_environment_check;

ALTER TABLE public.notification_delivery_jobs
  ADD CONSTRAINT notification_delivery_jobs_environment_check
  CHECK (environment IN ('local', 'test', 'staging', 'production'));

ALTER TABLE public.notification_delivery_jobs
  DROP CONSTRAINT IF EXISTS notification_delivery_jobs_replay_generation_check;

ALTER TABLE public.notification_delivery_jobs
  ADD CONSTRAINT notification_delivery_jobs_replay_generation_check
  CHECK (replay_generation >= 0 AND replay_generation <= 100);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_env_claim
  ON public.notification_delivery_jobs (environment, priority ASC, next_attempt_at ASC, created_at ASC)
  WHERE status IN ('QUEUED', 'RETRY_SCHEDULED', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_run_namespace
  ON public.notification_delivery_jobs (environment, run_namespace)
  WHERE run_namespace IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_dead_letter
  ON public.notification_delivery_jobs (environment, status, updated_at DESC)
  WHERE status IN ('DEAD_LETTERED', 'FAILED');

-- ─── Environment on attempts ────────────────────────────────────────
ALTER TABLE public.notification_delivery_attempts
  ADD COLUMN IF NOT EXISTS environment text;

UPDATE public.notification_delivery_attempts a
SET environment = COALESCE(
  a.environment,
  j.environment,
  public.notification_runtime_config_get('environment'),
  'production'
)
FROM public.notification_delivery_jobs j
WHERE a.job_id = j.id
  AND a.environment IS NULL;

UPDATE public.notification_delivery_attempts
SET environment = COALESCE(
  environment,
  public.notification_runtime_config_get('environment'),
  'production'
)
WHERE environment IS NULL;

ALTER TABLE public.notification_delivery_attempts
  ALTER COLUMN environment SET DEFAULT 'production';

ALTER TABLE public.notification_delivery_attempts
  ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.notification_delivery_attempts
  DROP CONSTRAINT IF EXISTS notification_delivery_attempts_environment_check;

ALTER TABLE public.notification_delivery_attempts
  ADD CONSTRAINT notification_delivery_attempts_environment_check
  CHECK (environment IN ('local', 'test', 'staging', 'production'));

-- ─── Worker run audit ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  worker_id text NOT NULL,
  environment text NOT NULL
    CHECK (environment IN ('local', 'test', 'staging', 'production')),
  run_namespace text,
  tenant_id text,
  job_source text,
  status text NOT NULL DEFAULT 'STARTED'
    CHECK (status IN (
      'STARTED',
      'RUNNING',
      'COMPLETED',
      'PARTIAL_FAILURE',
      'FAILED',
      'ABANDONED'
    )),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  claimed_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  retry_scheduled_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  dead_lettered_count integer NOT NULL DEFAULT 0,
  cancelled_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  sanitized_error_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  batch_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_worker_runs_env_heartbeat
  ON public.notification_worker_runs (environment, heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_worker_runs_status
  ON public.notification_worker_runs (environment, status, heartbeat_at DESC);

ALTER TABLE public.notification_worker_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_worker_runs_no_client ON public.notification_worker_runs;
CREATE POLICY notification_worker_runs_no_client ON public.notification_worker_runs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── Admin / service helpers ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_is_queue_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF public.notification_delivery_is_service_role() THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT upper(coalesce(p.role, '')) INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND coalesce(p.status, 'active') = 'active';
  RETURN v_role IN ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN');
END;
$$;

REVOKE ALL ON FUNCTION public.notification_is_queue_admin() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notification_caller_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.venue_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND coalesce(p.status, 'active') = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.notification_caller_tenant_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notification_assert_environment_allowed(
  p_environment text,
  p_allow_production boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_runtime text;
BEGIN
  v_env := lower(trim(coalesce(p_environment, '')));
  IF v_env = '' THEN
    v_env := lower(trim(coalesce(public.notification_runtime_config_get('environment'), '')));
  END IF;
  IF v_env NOT IN ('local', 'test', 'staging', 'production') THEN
    RAISE EXCEPTION 'invalid_environment';
  END IF;
  v_runtime := lower(trim(coalesce(public.notification_runtime_config_get('environment'), '')));
  IF v_env = 'production' AND NOT coalesce(p_allow_production, false) THEN
    RAISE EXCEPTION 'production_execution_blocked';
  END IF;
  IF v_runtime = 'production' AND NOT coalesce(p_allow_production, false) THEN
    RAISE EXCEPTION 'production_execution_blocked';
  END IF;
  -- Fail closed: worker env must match runtime config when runtime is set
  IF v_runtime <> '' AND v_env <> v_runtime AND v_env <> 'test' AND v_env <> 'local' THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;
  RETURN v_env;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_assert_environment_allowed(text, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notification_sanitize_reason(p_reason text, p_max integer DEFAULT 240)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    left(
      regexp_replace(
        coalesce(p_reason, ''),
        '(?i)(password|secret|token|apikey|api_key|authorization|bearer|postgres(ql)?://)[^\s]*',
        '[REDACTED]',
        'g'
      ),
      GREATEST(40, LEAST(coalesce(p_max, 240), 400))
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.notification_sanitize_reason(text, integer) FROM PUBLIC;

-- ─── Claim jobs (scoped by environment + optional namespace/tenant/source) ─
DROP FUNCTION IF EXISTS public.notification_delivery_claim_jobs(text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.notification_delivery_claim_jobs(
  p_worker_id text,
  p_batch_size integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 60,
  p_tenant_id text DEFAULT NULL,
  p_environment text DEFAULT NULL,
  p_run_namespace text DEFAULT NULL,
  p_job_source text DEFAULT NULL
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
  IF COALESCE(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'worker_disabled';
  END IF;

  -- Phase 2B: Production claim requires explicit tenant + namespace (no open claim)
  IF coalesce(public.notification_runtime_config_get('environment'), 'production') = 'production' THEN
    IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
      RAISE EXCEPTION 'tenant_scope_required';
    END IF;
    IF p_run_namespace IS NULL OR length(trim(p_run_namespace)) = 0 THEN
      RAISE EXCEPTION 'namespace_scope_required';
    END IF;
  END IF;


  v_env := public.notification_assert_environment_allowed(p_environment, false);

  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'worker_id_required';
  END IF;

  v_limit := LEAST(50, GREATEST(1, COALESCE(p_batch_size, 10)));
  v_lease := make_interval(secs => LEAST(300, GREATEST(5, COALESCE(p_lease_seconds, 60))));

  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.notification_delivery_jobs j
    WHERE j.environment = v_env
      AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id)
      AND (
        p_run_namespace IS NULL
        OR length(trim(p_run_namespace)) = 0
        OR j.run_namespace = trim(p_run_namespace)
      )
      AND (
        p_job_source IS NULL
        OR length(trim(p_job_source)) = 0
        OR j.job_source = trim(p_job_source)
      )
      AND (
        (
          j.status IN ('QUEUED', 'RETRY_SCHEDULED')
          AND j.next_attempt_at <= now()
          AND coalesce(j.cancel_requested, false) = false
        )
        OR (
          j.status = 'PROCESSING'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at < now()
          AND coalesce(j.cancel_requested, false) = false
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

REVOKE ALL ON FUNCTION public.notification_delivery_claim_jobs(text, integer, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_claim_jobs(text, integer, integer, text, text, text, text) TO service_role;

-- ─── Record attempt (stamp environment) ─────────────────────────────
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
  v_env text;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT environment INTO v_env
  FROM public.notification_delivery_jobs
  WHERE id = p_job_id;

  v_env := coalesce(
    v_env,
    public.notification_runtime_config_get('environment'),
  'production'
  );

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
    delivery_mode,
    environment
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
    COALESCE(NULLIF(trim(p_delivery_mode), ''), 'sandbox'),
    v_env
  )
  ON CONFLICT (job_id, attempt_number) DO UPDATE
  SET completed_at = EXCLUDED.completed_at,
      result = EXCLUDED.result,
      error_code = EXCLUDED.error_code,
      sanitized_error_message = EXCLUDED.sanitized_error_message,
      retryable = EXCLUDED.retryable,
      next_attempt_at = EXCLUDED.next_attempt_at,
      provider_message_id = EXCLUDED.provider_message_id,
      delivery_mode = EXCLUDED.delivery_mode,
      environment = EXCLUDED.environment
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

-- Drop old 3-arg overload if present; 5-arg with defaults accepts 3-arg calls
DROP FUNCTION IF EXISTS public.notification_delivery_enqueue(uuid, text, text);

-- ─── Enqueue stamps server-side environment (+ optional QA scope) ───
CREATE OR REPLACE FUNCTION public.notification_delivery_enqueue(
  p_notification_id uuid,
  p_tenant_id text,
  p_channel text DEFAULT 'in_app',
  p_run_namespace text DEFAULT NULL,
  p_job_source text DEFAULT NULL
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
  v_env text;
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

  v_env := coalesce(public.notification_runtime_config_get('environment'),
  'production');
  IF v_env = 'production' THEN
    RAISE EXCEPTION 'production_enqueue_blocked_phase16';
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
    max_attempts,
    environment,
    run_namespace,
    job_source
  ) VALUES (
    p_notification_id,
    p_tenant_id,
    v_channel,
    'QUEUED',
    now(),
    now(),
    v_priority,
    5,
    v_env,
    NULLIF(trim(p_run_namespace), ''),
    NULLIF(trim(p_job_source), '')
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

REVOKE ALL ON FUNCTION public.notification_delivery_enqueue(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_enqueue(uuid, text, text, text, text) TO authenticated;

-- ─── Worker run start / heartbeat / complete ────────────────────────
CREATE OR REPLACE FUNCTION public.notification_worker_run_start(
  p_run_id text,
  p_worker_id text,
  p_environment text,
  p_run_namespace text DEFAULT NULL,
  p_tenant_id text DEFAULT NULL,
  p_job_source text DEFAULT NULL,
  p_batch_size integer DEFAULT NULL
)
RETURNS public.notification_worker_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_row public.notification_worker_runs;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  v_env := public.notification_assert_environment_allowed(p_environment, false);
  IF p_run_id IS NULL OR length(trim(p_run_id)) = 0 THEN
    RAISE EXCEPTION 'run_id_required';
  END IF;
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'worker_id_required';
  END IF;

  INSERT INTO public.notification_worker_runs (
    run_id, worker_id, environment, run_namespace, tenant_id, job_source,
    status, started_at, heartbeat_at, batch_size
  ) VALUES (
    trim(p_run_id),
    trim(p_worker_id),
    v_env,
    NULLIF(trim(p_run_namespace), ''),
    NULLIF(trim(p_tenant_id), ''),
    NULLIF(trim(p_job_source), ''),
    'STARTED',
    now(),
    now(),
    p_batch_size
  )
  ON CONFLICT (run_id) DO UPDATE
  SET heartbeat_at = now(),
      status = 'RUNNING',
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_worker_run_start(text, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_worker_run_start(text, text, text, text, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.notification_worker_run_heartbeat(
  p_run_id text
)
RETURNS public.notification_worker_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_worker_runs;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  UPDATE public.notification_worker_runs
  SET heartbeat_at = now(),
      status = CASE WHEN status IN ('STARTED', 'RUNNING') THEN 'RUNNING' ELSE status END,
      updated_at = now()
  WHERE run_id = trim(p_run_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker_run_not_found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_worker_run_heartbeat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_worker_run_heartbeat(text) TO service_role;

CREATE OR REPLACE FUNCTION public.notification_worker_run_complete(
  p_run_id text,
  p_status text,
  p_claimed_count integer DEFAULT 0,
  p_sent_count integer DEFAULT 0,
  p_retry_scheduled_count integer DEFAULT 0,
  p_failed_count integer DEFAULT 0,
  p_dead_lettered_count integer DEFAULT 0,
  p_cancelled_count integer DEFAULT 0,
  p_skipped_count integer DEFAULT 0,
  p_sanitized_error_count integer DEFAULT 0,
  p_duration_ms integer DEFAULT NULL
)
RETURNS public.notification_worker_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_worker_runs;
  v_status text;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  v_status := upper(trim(coalesce(p_status, 'COMPLETED')));
  IF v_status NOT IN ('COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'ABANDONED') THEN
    RAISE EXCEPTION 'invalid_worker_run_status';
  END IF;

  UPDATE public.notification_worker_runs
  SET status = v_status,
      completed_at = now(),
      heartbeat_at = now(),
      claimed_count = coalesce(p_claimed_count, 0),
      sent_count = coalesce(p_sent_count, 0),
      retry_scheduled_count = coalesce(p_retry_scheduled_count, 0),
      failed_count = coalesce(p_failed_count, 0),
      dead_lettered_count = coalesce(p_dead_lettered_count, 0),
      cancelled_count = coalesce(p_cancelled_count, 0),
      skipped_count = coalesce(p_skipped_count, 0),
      sanitized_error_count = coalesce(p_sanitized_error_count, 0),
      duration_ms = coalesce(
        p_duration_ms,
        greatest(0, (extract(epoch from (now() - started_at)) * 1000)::integer)
      ),
      updated_at = now()
  WHERE run_id = trim(p_run_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker_run_not_found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_worker_run_complete(
  text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_worker_run_complete(
  text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.notification_worker_mark_abandoned_runs(
  p_environment text DEFAULT NULL,
  p_stale_seconds integer DEFAULT NULL
)
RETURNS TABLE (run_id text, previous_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_stale integer;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  v_env := public.notification_assert_environment_allowed(p_environment, false);
  v_stale := GREATEST(
    30,
    coalesce(
      p_stale_seconds,
      nullif(public.notification_runtime_config_get('worker_heartbeat_stale_seconds'), '')::integer,
      120
    )
  );

  RETURN QUERY
  UPDATE public.notification_worker_runs r
  SET status = 'ABANDONED',
      completed_at = coalesce(r.completed_at, now()),
      updated_at = now()
  WHERE r.environment = v_env
    AND r.status IN ('STARTED', 'RUNNING')
    AND r.heartbeat_at < now() - make_interval(secs => v_stale)
  RETURNING r.run_id, r.status;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_worker_mark_abandoned_runs(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_worker_mark_abandoned_runs(text, integer) TO service_role;

-- ─── Queue health (aggregated; no secrets) ──────────────────────────
CREATE OR REPLACE FUNCTION public.notification_queue_health(
  p_environment text DEFAULT NULL,
  p_tenant_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_tenant text;
  v_is_admin boolean;
  v_stale integer;
  v_result jsonb;
BEGIN
  v_is_admin := public.notification_is_queue_admin();
  IF NOT v_is_admin AND NOT public.notification_delivery_is_service_role() THEN
    -- Tenant owners may inspect their own tenant aggregates only
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'queue_health_forbidden';
    END IF;
    SELECT upper(coalesce(p.role, '')) INTO v_tenant
    FROM public.profiles p
    WHERE p.id = auth.uid();
    IF v_tenant NOT IN ('VENUE_OWNER', 'TENANT_OWNER', 'COURT_OWNER') THEN
      RAISE EXCEPTION 'queue_health_forbidden';
    END IF;
    v_tenant := public.notification_caller_tenant_id();
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'queue_health_forbidden';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'queue_health_tenant_denied';
    END IF;
  ELSE
    v_tenant := NULLIF(trim(p_tenant_id), '');
  END IF;

  v_env := lower(trim(coalesce(
    NULLIF(p_environment, ''),
    public.notification_runtime_config_get('environment'),
  'production'
  )));
  IF v_env NOT IN ('local', 'test', 'staging', 'production') THEN
    RAISE EXCEPTION 'invalid_environment';
  END IF;

  v_stale := coalesce(
    nullif(public.notification_runtime_config_get('worker_heartbeat_stale_seconds'), '')::integer,
    120
  );

  SELECT jsonb_build_object(
    'environment', v_env,
    'tenantId', v_tenant,
    'queued', count(*) FILTER (WHERE j.status = 'QUEUED'),
    'processing', count(*) FILTER (WHERE j.status = 'PROCESSING'),
    'retryScheduled', count(*) FILTER (WHERE j.status = 'RETRY_SCHEDULED'),
    'failed', count(*) FILTER (WHERE j.status = 'FAILED'),
    'deadLettered', count(*) FILTER (WHERE j.status = 'DEAD_LETTERED'),
    'cancelled', count(*) FILTER (WHERE j.status = 'CANCELLED'),
    'sent', count(*) FILTER (WHERE j.status = 'SENT'),
    'oldestQueuedAgeSeconds', coalesce(
      extract(epoch from (now() - min(j.created_at) FILTER (WHERE j.status = 'QUEUED')))::integer,
      0
    ),
    'oldestRetryAgeSeconds', coalesce(
      extract(epoch from (now() - min(j.next_attempt_at) FILTER (WHERE j.status = 'RETRY_SCHEDULED')))::integer,
      0
    ),
    'expiredLeases', count(*) FILTER (
      WHERE j.status = 'PROCESSING'
        AND j.lease_expires_at IS NOT NULL
        AND j.lease_expires_at < now()
    ),
    'byChannel', coalesce((
      SELECT jsonb_object_agg(channel, cnt)
      FROM (
        SELECT j2.channel, count(*)::int AS cnt
        FROM public.notification_delivery_jobs j2
        WHERE j2.environment = v_env
          AND (v_tenant IS NULL OR j2.tenant_id = v_tenant)
          AND j2.status IN ('QUEUED','PROCESSING','RETRY_SCHEDULED','FAILED','DEAD_LETTERED')
        GROUP BY j2.channel
      ) c
    ), '{}'::jsonb),
    'byPriority', coalesce((
      SELECT jsonb_object_agg(priority::text, cnt)
      FROM (
        SELECT j2.priority, count(*)::int AS cnt
        FROM public.notification_delivery_jobs j2
        WHERE j2.environment = v_env
          AND (v_tenant IS NULL OR j2.tenant_id = v_tenant)
          AND j2.status IN ('QUEUED','PROCESSING','RETRY_SCHEDULED','FAILED','DEAD_LETTERED')
        GROUP BY j2.priority
      ) p
    ), '{}'::jsonb),
    'byEnvironment', jsonb_build_object(v_env, count(*)),
    'activeWorkers', (
      SELECT count(*)::int
      FROM public.notification_worker_runs r
      WHERE r.environment = v_env
        AND r.status IN ('STARTED', 'RUNNING')
        AND r.heartbeat_at >= now() - make_interval(secs => v_stale)
    ),
    'abandonedWorkerRuns', (
      SELECT count(*)::int
      FROM public.notification_worker_runs r
      WHERE r.environment = v_env
        AND r.status = 'ABANDONED'
    ),
    'generatedAt', now()
  )
  INTO v_result
  FROM public.notification_delivery_jobs j
  WHERE j.environment = v_env
    AND (v_tenant IS NULL OR j.tenant_id = v_tenant);

  RETURN coalesce(v_result, jsonb_build_object(
    'environment', v_env,
    'tenantId', v_tenant,
    'queued', 0,
    'processing', 0,
    'retryScheduled', 0,
    'failed', 0,
    'deadLettered', 0,
    'cancelled', 0,
    'sent', 0,
    'oldestQueuedAgeSeconds', 0,
    'oldestRetryAgeSeconds', 0,
    'expiredLeases', 0,
    'byChannel', '{}'::jsonb,
    'byPriority', '{}'::jsonb,
    'byEnvironment', jsonb_build_object(v_env, 0),
    'activeWorkers', 0,
    'abandonedWorkerRuns', 0,
    'generatedAt', now()
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.notification_queue_health(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_queue_health(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_queue_health(text, text) TO authenticated;

-- ─── Cancel job ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_cancel_job(
  p_job_id uuid,
  p_cancelled_by text,
  p_reason text,
  p_environment text DEFAULT NULL,
  p_force_leased boolean DEFAULT false
)
RETURNS public.notification_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.notification_delivery_jobs;
  v_env text;
  v_reason text;
  v_allow text;
BEGIN
  IF NOT public.notification_delivery_is_service_role()
     AND NOT public.notification_is_queue_admin() THEN
    RAISE EXCEPTION 'cancel_forbidden';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_cancel');
  IF coalesce(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'cancel_disabled';
  END IF;

  v_env := public.notification_assert_environment_allowed(p_environment, false);
  v_reason := public.notification_sanitize_reason(p_reason, 240);
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'cancellation_reason_required';
  END IF;

  SELECT * INTO v_job
  FROM public.notification_delivery_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_job.environment IS DISTINCT FROM v_env THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;
  IF v_job.status IN ('SENT', 'DEAD_LETTERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'cancel_rejected_terminal';
  END IF;

  IF v_job.status = 'PROCESSING' THEN
    IF v_job.lease_expires_at IS NOT NULL AND v_job.lease_expires_at > now()
       AND NOT coalesce(p_force_leased, false) THEN
      -- Soft cancel: keep lease; worker should observe cancel_requested
      UPDATE public.notification_delivery_jobs
      SET cancel_requested = true,
          cancellation_reason = v_reason,
          cancelled_by = NULLIF(trim(p_cancelled_by), ''),
          updated_at = now()
      WHERE id = p_job_id
      RETURNING * INTO v_job;
      RETURN v_job;
    END IF;
  END IF;

  PERFORM public.notification_delivery_assert_transition(v_job.status, 'CANCELLED', false);

  UPDATE public.notification_delivery_jobs
  SET status = 'CANCELLED',
      cancel_requested = false,
      cancelled_at = now(),
      cancelled_by = NULLIF(trim(p_cancelled_by), ''),
      cancellation_reason = v_reason,
      worker_id = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      claim_token = NULL,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_cancel_job(uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_cancel_job(uuid, text, text, text, boolean) TO service_role;

-- ─── Replay dead-letter / failed ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_replay_job(
  p_job_id uuid,
  p_replayed_by text,
  p_reason text,
  p_environment text DEFAULT NULL
)
RETURNS public.notification_delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.notification_delivery_jobs;
  v_new public.notification_delivery_jobs;
  v_env text;
  v_reason text;
  v_allow text;
  v_max integer;
  v_next_gen integer;
BEGIN
  IF NOT public.notification_delivery_is_service_role()
     AND NOT public.notification_is_queue_admin() THEN
    RAISE EXCEPTION 'replay_forbidden';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_replay');
  IF coalesce(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'replay_disabled';
  END IF;

  v_env := public.notification_assert_environment_allowed(p_environment, false);
  IF v_env = 'production' THEN
    RAISE EXCEPTION 'production_replay_blocked_phase16';
  END IF;

  v_reason := public.notification_sanitize_reason(p_reason, 240);
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'replay_reason_required';
  END IF;

  v_max := coalesce(
    nullif(public.notification_runtime_config_get('max_replay_count'), '')::integer,
    3
  );

  SELECT * INTO v_job
  FROM public.notification_delivery_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_job.environment IS DISTINCT FROM v_env THEN
    RAISE EXCEPTION 'environment_mismatch';
  END IF;
  IF v_job.status NOT IN ('DEAD_LETTERED', 'FAILED') THEN
    RAISE EXCEPTION 'replay_requires_failed_or_dead_lettered';
  END IF;

  v_next_gen := coalesce(v_job.replay_generation, 0) + 1;
  IF v_next_gen > v_max THEN
    RAISE EXCEPTION 'replay_count_exceeded';
  END IF;

  -- Keep original auditable; create new execution generation job
  INSERT INTO public.notification_delivery_jobs (
    notification_id,
    tenant_id,
    channel,
    status,
    attempts,
    max_attempts,
    priority,
    scheduled_at,
    next_attempt_at,
    environment,
    run_namespace,
    job_source,
    delivery_idempotency_key,
    delivery_mode,
    replayed_from_job_id,
    replay_requested_by,
    replay_reason,
    replay_generation
  ) VALUES (
    v_job.notification_id,
    v_job.tenant_id,
    v_job.channel,
    'QUEUED',
    0,
    v_job.max_attempts,
    v_job.priority,
    now(),
    now(),
    v_job.environment,
    v_job.run_namespace,
    coalesce(v_job.job_source, 'replay'),
    -- Preserve original idempotency relationship for in-app (no duplicate inbox rows)
    v_job.delivery_idempotency_key,
    coalesce(v_job.delivery_mode, 'sandbox'),
    v_job.id,
    NULLIF(trim(p_replayed_by), ''),
    v_reason,
    v_next_gen
  )
  RETURNING * INTO v_new;

  -- Annotate original (remains terminal)
  UPDATE public.notification_delivery_jobs
  SET replay_reason = coalesce(replay_reason, v_reason),
      updated_at = now()
  WHERE id = v_job.id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_replay_job(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_replay_job(uuid, text, text, text) TO service_role;

-- One in-flight job per notification+channel (FAILED/DEAD_LETTERED/SENT/CANCELLED excluded so replay can enqueue)
-- Replace legacy absolute unique if present (Phase 1.3).
ALTER TABLE public.notification_delivery_jobs
  DROP CONSTRAINT IF EXISTS notification_delivery_jobs_notification_channel_uq;
DROP INDEX IF EXISTS notification_delivery_jobs_notification_channel_uq;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_notification_channel_uq;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_jobs_active_channel
  ON public.notification_delivery_jobs (notification_id, channel)
  WHERE status IN ('CREATED', 'QUEUED', 'PROCESSING', 'RETRY_SCHEDULED');

-- ─── Stale lease recovery ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_delivery_recover_stale_leases(
  p_environment text DEFAULT NULL,
  p_tenant_id text DEFAULT NULL,
  p_run_namespace text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (job_id uuid, previous_worker_id text, recovery_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_allow text;
  v_stale integer;
  v_limit integer;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_stale_lease_recovery');
  IF coalesce(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'stale_lease_recovery_disabled';
  END IF;

  v_env := public.notification_assert_environment_allowed(p_environment, false);
  v_stale := coalesce(
    nullif(public.notification_runtime_config_get('worker_heartbeat_stale_seconds'), '')::integer,
    120
  );
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 50)));

  RETURN QUERY
  WITH eligible AS (
    SELECT j.id, j.worker_id AS prev_worker, j.cancel_requested AS was_cancel
    FROM public.notification_delivery_jobs j
    LEFT JOIN LATERAL (
      SELECT r.id
      FROM public.notification_worker_runs r
      WHERE r.worker_id = j.worker_id
        AND r.environment = j.environment
        AND r.status IN ('STARTED', 'RUNNING')
        AND r.heartbeat_at >= now() - make_interval(secs => v_stale)
      LIMIT 1
    ) active_run ON true
    WHERE j.environment = v_env
      AND j.status = 'PROCESSING'
      AND j.lease_expires_at IS NOT NULL
      AND j.lease_expires_at < now()
      AND active_run.id IS NULL
      AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id)
      AND (
        p_run_namespace IS NULL
        OR length(trim(p_run_namespace)) = 0
        OR j.run_namespace = trim(p_run_namespace)
      )
    ORDER BY j.lease_expires_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.notification_delivery_jobs j
    SET status = CASE
          WHEN coalesce(eligible.was_cancel, false) THEN 'CANCELLED'
          WHEN coalesce(j.attempts, 0) > 0 THEN 'RETRY_SCHEDULED'
          ELSE 'QUEUED'
        END,
        cancelled_at = CASE WHEN coalesce(eligible.was_cancel, false) THEN now() ELSE j.cancelled_at END,
        cancel_requested = false,
        worker_id = NULL,
        claimed_at = NULL,
        lease_expires_at = NULL,
        claim_token = NULL,
        recovery_count = coalesce(j.recovery_count, 0) + 1,
        next_attempt_at = CASE
          WHEN coalesce(eligible.was_cancel, false) THEN j.next_attempt_at
          ELSE now()
        END,
        processed_at = CASE WHEN coalesce(eligible.was_cancel, false) THEN now() ELSE j.processed_at END,
        updated_at = now()
    FROM eligible
    WHERE j.id = eligible.id
    RETURNING j.id, eligible.prev_worker, j.recovery_count
  )
  SELECT u.id, u.prev_worker, u.recovery_count FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_recover_stale_leases(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_recover_stale_leases(text, text, text, integer) TO service_role;

-- ─── QA cleanup (phase14s / phase15 / phase16 namespaces) ───────────
CREATE OR REPLACE FUNCTION public.notification_qa_cleanup_namespaced_inbox(
  p_tenant_id text,
  p_namespace_prefix text,
  p_ids uuid[],
  p_expected_project_ref text DEFAULT 'expuvcohlcjzvrrauvud'
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
  IF p_namespace_prefix IS NULL
     OR (
       p_namespace_prefix NOT LIKE 'phase14s:%'
       AND p_namespace_prefix NOT LIKE 'phase15:%'
       AND p_namespace_prefix NOT LIKE 'phase16:%'
     ) THEN
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

-- Server-side QA ops cleanup for exact run_namespace (jobs + attempts + worker runs + inbox)
CREATE OR REPLACE FUNCTION public.notification_qa_cleanup_run_namespace(
  p_environment text,
  p_run_namespace text,
  p_tenant_id text DEFAULT NULL,
  p_expected_project_ref text DEFAULT 'expuvcohlcjzvrrauvud',
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
  v_ref text;
  v_allow text;
  v_jobs integer := 0;
  v_attempts integer := 0;
  v_runs integer := 0;
  v_inbox integer := 0;
BEGIN
  IF NOT public.notification_delivery_is_service_role() THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  v_allow := public.notification_runtime_config_get('allow_qa_cleanup');
  v_ref := public.notification_runtime_config_get('project_ref');
  IF coalesce(v_allow, 'false') <> 'true' THEN
    RAISE EXCEPTION 'qa_cleanup_disabled';
  END IF;
  IF coalesce(v_ref, '') <> coalesce(p_expected_project_ref, '') THEN
    RAISE EXCEPTION 'project_ref_mismatch';
  END IF;

  v_env := public.notification_assert_environment_allowed(p_environment, false);
  IF v_env <> 'staging' THEN
    RAISE EXCEPTION 'qa_cleanup_staging_only';
  END IF;
  IF p_run_namespace IS NULL
     OR (
       p_run_namespace NOT LIKE 'phase14s:%'
       AND p_run_namespace NOT LIKE 'phase15:%'
       AND p_run_namespace NOT LIKE 'phase16:%'
     ) THEN
    RAISE EXCEPTION 'invalid_namespace';
  END IF;
  -- Exact namespace required — reject SQL wildcard characters
  IF position('%' in p_run_namespace) > 0 THEN
    RAISE EXCEPTION 'wildcard_namespace_forbidden';
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO v_jobs
    FROM public.notification_delivery_jobs j
    WHERE j.environment = v_env
      AND j.run_namespace = p_run_namespace
      AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id);

    SELECT count(*) INTO v_attempts
    FROM public.notification_delivery_attempts a
    JOIN public.notification_delivery_jobs j ON j.id = a.job_id
    WHERE j.environment = v_env
      AND j.run_namespace = p_run_namespace
      AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id);

    SELECT count(*) INTO v_runs
    FROM public.notification_worker_runs r
    WHERE r.environment = v_env
      AND r.run_namespace = p_run_namespace
      AND (p_tenant_id IS NULL OR r.tenant_id IS NULL OR r.tenant_id = p_tenant_id);

    SELECT count(*) INTO v_inbox
    FROM public.notification_inbox n
    WHERE n.idempotency_key LIKE (p_run_namespace || '%')
      AND (p_tenant_id IS NULL OR n.tenant_id = p_tenant_id);

    RETURN jsonb_build_object(
      'dryRun', true,
      'environment', v_env,
      'runNamespace', p_run_namespace,
      'jobs', v_jobs,
      'attempts', v_attempts,
      'workerRuns', v_runs,
      'inbox', v_inbox
    );
  END IF;

  DELETE FROM public.notification_delivery_attempts a
  USING public.notification_delivery_jobs j
  WHERE a.job_id = j.id
    AND j.environment = v_env
    AND j.run_namespace = p_run_namespace
    AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id);
  GET DIAGNOSTICS v_attempts = ROW_COUNT;

  DELETE FROM public.notification_delivery_jobs j
  WHERE j.environment = v_env
    AND j.run_namespace = p_run_namespace
    AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id);
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  DELETE FROM public.notification_worker_runs r
  WHERE r.environment = v_env
    AND r.run_namespace = p_run_namespace
    AND (p_tenant_id IS NULL OR r.tenant_id IS NULL OR r.tenant_id = p_tenant_id);
  GET DIAGNOSTICS v_runs = ROW_COUNT;

  DELETE FROM public.notification_inbox n
  WHERE n.idempotency_key LIKE (p_run_namespace || '%')
    AND (p_tenant_id IS NULL OR n.tenant_id = p_tenant_id);
  GET DIAGNOSTICS v_inbox = ROW_COUNT;

  RETURN jsonb_build_object(
    'dryRun', false,
    'environment', v_env,
    'runNamespace', p_run_namespace,
    'jobs', v_jobs,
    'attempts', v_attempts,
    'workerRuns', v_runs,
    'inbox', v_inbox
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notification_qa_cleanup_run_namespace(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_qa_cleanup_run_namespace(text, text, text, text, boolean) TO service_role;

-- List dead-letter jobs (sanitized fields only via SELECT grant path for service_role)
CREATE OR REPLACE FUNCTION public.notification_delivery_list_dead_letters(
  p_environment text DEFAULT NULL,
  p_tenant_id text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  tenant_id text,
  channel text,
  status text,
  environment text,
  run_namespace text,
  attempts integer,
  last_error text,
  replay_generation integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env text;
BEGIN
  IF NOT public.notification_delivery_is_service_role()
     AND NOT public.notification_is_queue_admin() THEN
    RAISE EXCEPTION 'dead_letter_inspect_forbidden';
  END IF;
  v_env := public.notification_assert_environment_allowed(p_environment, false);

  RETURN QUERY
  SELECT j.id, j.tenant_id, j.channel, j.status, j.environment, j.run_namespace,
         j.attempts, left(coalesce(j.last_error, ''), 200), j.replay_generation, j.updated_at
  FROM public.notification_delivery_jobs j
  WHERE j.environment = v_env
    AND j.status IN ('DEAD_LETTERED', 'FAILED')
    AND (p_tenant_id IS NULL OR j.tenant_id = p_tenant_id)
  ORDER BY j.updated_at DESC
  LIMIT LEAST(100, GREATEST(1, coalesce(p_limit, 20)));
END;
$$;

REVOKE ALL ON FUNCTION public.notification_delivery_list_dead_letters(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_delivery_list_dead_letters(text, text, integer) TO service_role;

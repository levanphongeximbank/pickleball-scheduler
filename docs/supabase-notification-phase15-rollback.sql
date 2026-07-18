-- Rollback for docs/supabase-notification-phase15.sql
-- Staging only. Do not run against Production without explicit approval.
-- Does NOT drop Phase 1.3 inbox/jobs tables.

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

-- Restore Phase 1.3-compatible status check (best-effort; may fail if new statuses exist)
-- Prefer restoring enqueue from phase13-rpc-hardening.sql after this rollback.

ALTER TABLE public.notification_delivery_jobs
  DROP CONSTRAINT IF EXISTS notification_delivery_jobs_status_check;

-- Narrow status check only if no Phase 1.5-only statuses remain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_delivery_jobs
    WHERE status IN ('PROCESSING', 'RETRY_SCHEDULED', 'DEAD_LETTERED', 'CANCELLED')
  ) THEN
    ALTER TABLE public.notification_delivery_jobs
      ADD CONSTRAINT notification_delivery_jobs_status_check
      CHECK (status IN ('CREATED', 'QUEUED', 'SENT', 'FAILED'));
  ELSE
    ALTER TABLE public.notification_delivery_jobs
      ADD CONSTRAINT notification_delivery_jobs_status_check
      CHECK (status IN (
        'CREATED', 'QUEUED', 'PROCESSING', 'SENT',
        'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED'
      ));
    RAISE NOTICE 'phase15 rollback: leaving expanded status check because advanced statuses still present';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_notification_delivery_jobs_claim;
DROP INDEX IF EXISTS idx_notification_delivery_jobs_lease;

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_queue
  ON public.notification_delivery_jobs (status, scheduled_at)
  WHERE status IN ('CREATED', 'QUEUED');

-- Columns added in Phase 1.5 are left in place (non-destructive). Drop manually if required:
-- ALTER TABLE public.notification_delivery_jobs
--   DROP COLUMN IF EXISTS priority,
--   DROP COLUMN IF EXISTS max_attempts,
--   DROP COLUMN IF EXISTS next_attempt_at,
--   DROP COLUMN IF EXISTS worker_id,
--   DROP COLUMN IF EXISTS claimed_at,
--   DROP COLUMN IF EXISTS lease_expires_at,
--   DROP COLUMN IF EXISTS claim_token,
--   DROP COLUMN IF EXISTS delivery_mode,
--   DROP COLUMN IF EXISTS delivery_idempotency_key;

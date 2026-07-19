-- PICK_VN Notification Phase 2B — Production runtime config (fail-closed)
-- PRODUCTION ONLY. Project ref: expuvcohlcjzvrrauvud
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql (config section)
-- Dependencies: notification_runtime_config table (from production-15)
-- Re-run: ON CONFLICT upsert safe
-- Transaction: single statement batch; stop on first error
--
-- Mandatory Production defaults — NEVER inherit Staging values.
-- Worker remains disabled until a FUTURE phase sets BOTH:
--   production_worker_enable=true AND production_rollout_approved=true
-- (Phase 2B does NOT enable the worker.)

BEGIN;

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

-- Guard: refuse if Staging namespace markers somehow appear as config values
DO $$
DECLARE
  v_env text;
  v_worker text;
  v_cleanup text;
  v_ref text;
BEGIN
  SELECT value INTO v_env FROM public.notification_runtime_config WHERE key = 'environment';
  SELECT value INTO v_worker FROM public.notification_runtime_config WHERE key = 'allow_worker';
  SELECT value INTO v_cleanup FROM public.notification_runtime_config WHERE key = 'allow_qa_cleanup';
  SELECT value INTO v_ref FROM public.notification_runtime_config WHERE key = 'project_ref';

  IF coalesce(v_env, '') <> 'production' THEN
    RAISE EXCEPTION 'phase2b_config_invalid_environment: %', v_env;
  END IF;
  IF coalesce(v_worker, 'true') <> 'false' THEN
    RAISE EXCEPTION 'phase2b_config_worker_must_be_false';
  END IF;
  IF coalesce(v_cleanup, 'true') <> 'false' THEN
    RAISE EXCEPTION 'phase2b_config_qa_cleanup_must_be_false';
  END IF;
  IF coalesce(v_ref, '') <> 'expuvcohlcjzvrrauvud' THEN
    RAISE EXCEPTION 'phase2b_config_invalid_project_ref: %', v_ref;
  END IF;
END $$;

COMMIT;

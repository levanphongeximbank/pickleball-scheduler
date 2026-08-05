-- RATING-V5-CUTOVER-02 — Staging-only writer freeze guard for pick_vn_sync_rating
-- AUTHOR ONLY — DO NOT APPLY in this workstream (SQL_EXECUTION=0).
--
-- Purpose:
--   Client/UI flags alone cannot stop direct RPC calls.
--   This migration wraps/guards pick_vn_sync_rating behind a Staging-only
--   freeze setting so ENFORCE can fail-closed at the database layer.
--
-- Safety:
--   - Project-ref guard (staging only)
--   - Environment label guard via app setting
--   - Idempotent
--   - Non-destructive (no DROP TABLE / no DELETE of rating rows)
--   - Down/rollback path included
--
-- Production:
--   MUST refuse to apply when project ref == expuvcohlcjzvrrauvud
--
-- Expected Staging ref: qyewbxjsiiyufanzcjcq
-- Production denylist:  expuvcohlcjzvrrauvud

BEGIN;

DO $$
DECLARE
  v_ref text := current_setting('request.jwt.claims', true);
  v_db_ref text := coalesce(
    current_setting('app.settings.supabase_project_ref', true),
    current_setting('app.supabase_project_ref', true),
    ''
  );
  v_env text := lower(coalesce(current_setting('app.settings.app_env', true), ''));
BEGIN
  -- Soft identity checks (operators must also verify project ref externally).
  IF v_db_ref = 'expuvcohlcjzvrrauvud' OR v_env IN ('production', 'prod') THEN
    RAISE EXCEPTION 'CUTOVER_02_REFUSE_PRODUCTION: writer freeze SQL must not apply on Production';
  END IF;

  IF v_db_ref <> '' AND v_db_ref <> 'qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION 'CUTOVER_02_REFUSE_UNKNOWN_REF: expected staging ref qyewbxjsiiyufanzcjcq, got %', v_db_ref;
  END IF;

  -- Silence unused JWT claim var in author template (claims checked by operator runbook).
  PERFORM v_ref;
END $$;

-- Freeze mode setting: off | observe | enforce (default off)
CREATE TABLE IF NOT EXISTS public.rating_v5_cutover_02_freeze_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  writer_freeze_mode text NOT NULL DEFAULT 'off'
    CHECK (writer_freeze_mode IN ('off', 'observe', 'enforce')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  notes text NULL
);

INSERT INTO public.rating_v5_cutover_02_freeze_settings (id, writer_freeze_mode, notes)
VALUES (1, 'off', 'CUTOVER-02 default OFF — Staging rehearsal only')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rating_v5_cutover_02_writer_attempt_audit (
  id bigserial PRIMARY KEY,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  writer_id text NOT NULL,
  mode text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  auth_user_id uuid NULL,
  player_id_hash text NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_get_freeze_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT writer_freeze_mode FROM public.rating_v5_cutover_02_freeze_settings WHERE id = 1),
    'off'
  );
$$;

-- Observe/enforce audit helper (no PII beyond auth uid + optional hash)
CREATE OR REPLACE FUNCTION public.rating_v5_cutover_02_record_sync_attempt(
  p_blocked boolean,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := public.rating_v5_cutover_02_get_freeze_mode();
BEGIN
  IF v_mode = 'off' THEN
    RETURN;
  END IF;
  INSERT INTO public.rating_v5_cutover_02_writer_attempt_audit (
    writer_id, mode, blocked, auth_user_id, detail
  ) VALUES (
    'PICK_VN_SYNC_RATING_RPC',
    v_mode,
    coalesce(p_blocked, false),
    auth.uid(),
    coalesce(p_detail, '{}'::jsonb)
  );
END;
$$;

-- NOTE TO OPERATORS:
-- Replace body of pick_vn_sync_rating to call:
--   PERFORM rating_v5_cutover_02_record_sync_attempt(false, ...);  -- observe
--   or RAISE using ERRCODE when mode=enforce before upsert.
-- Keep original upsert logic intact for mode=off/observe.
-- Exact CREATE OR REPLACE of pick_vn_sync_rating is environment-specific;
-- use Staging dump of current function as base before patching.
-- This file intentionally does NOT redefine pick_vn_sync_rating body to avoid
-- accidental overwrite of Phase 30/31 signatures without operator review.

COMMENT ON TABLE public.rating_v5_cutover_02_freeze_settings IS
  'CUTOVER-02 Staging writer freeze mode (off/observe/enforce). Default off. Never enable on Production.';

COMMIT;

-- ---------------------------------------------------------------------------
-- DOWN / ROLLBACK (run separately after Owner approval)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.rating_v5_cutover_02_freeze_settings SET writer_freeze_mode = 'off' WHERE id = 1;
-- -- Optional full teardown (non-rating-data):
-- -- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_record_sync_attempt(boolean, jsonb);
-- -- DROP FUNCTION IF EXISTS public.rating_v5_cutover_02_get_freeze_mode();
-- -- DROP TABLE IF EXISTS public.rating_v5_cutover_02_writer_attempt_audit;
-- -- DROP TABLE IF EXISTS public.rating_v5_cutover_02_freeze_settings;
-- -- Restore prior pick_vn_sync_rating from backup dump.
-- COMMIT;

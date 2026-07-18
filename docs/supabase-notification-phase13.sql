-- PICK_VN Notification Phase 1.3
-- Inbox Source of Truth + delivery queue foundation
-- Apply on staging first. Do NOT apply to Production from this phase alone.
-- Rollback: docs/supabase-notification-phase13-rollback.sql
--
-- Notes:
-- - Leaves legacy public.notifications (mobile sprint9) intact for compatibility.
-- - Canonical inbox SoT is public.notification_inbox.
-- - Delivery queue is public.notification_delivery_jobs (no live channel workers yet).

-- ─── notification_inbox ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'NORMAL',
  tenant_id text NOT NULL,
  venue_id text,
  club_id text,
  competition_id text,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'QUEUED', 'SENT', 'FAILED', 'READ')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  source_entity_type text,
  source_entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT notification_inbox_tenant_idempotency_uq UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_tenant_recipient_created
  ON public.notification_inbox (tenant_id, recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_tenant_status
  ON public.notification_inbox (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_event_type
  ON public.notification_inbox (tenant_id, event_type);

-- ─── notification_delivery_jobs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notification_inbox(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  channel text NOT NULL
    CHECK (channel IN ('in_app', 'email', 'sms', 'zalo', 'push')),
  status text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'QUEUED', 'SENT', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_jobs_notification_channel_uq
    UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_queue
  ON public.notification_delivery_jobs (status, scheduled_at)
  WHERE status IN ('CREATED', 'QUEUED');

CREATE INDEX IF NOT EXISTS idx_notification_delivery_jobs_tenant
  ON public.notification_delivery_jobs (tenant_id, created_at DESC);

-- ─── RLS: notification_inbox ────────────────────────────────────────
ALTER TABLE public.notification_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_inbox_select_own ON public.notification_inbox;
CREATE POLICY notification_inbox_select_own ON public.notification_inbox
  FOR SELECT
  USING (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS notification_inbox_update_own ON public.notification_inbox;
CREATE POLICY notification_inbox_update_own ON public.notification_inbox
  FOR UPDATE
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- Inserts go through SECURITY DEFINER RPC (domain emit), not direct client insert.

-- ─── RLS: notification_delivery_jobs ────────────────────────────────
ALTER TABLE public.notification_delivery_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_delivery_jobs_select_own ON public.notification_delivery_jobs;
CREATE POLICY notification_delivery_jobs_select_own ON public.notification_delivery_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.notification_inbox n
      WHERE n.id = notification_id
        AND n.recipient_user_id = auth.uid()
    )
  );

-- ─── RPC: upsert inbox row (idempotent) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.notification_inbox_create(
  p_event_id text,
  p_event_type text,
  p_category text,
  p_priority text,
  p_tenant_id text,
  p_venue_id text DEFAULT NULL,
  p_club_id text DEFAULT NULL,
  p_competition_id text DEFAULT NULL,
  p_recipient_user_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_title text DEFAULT '',
  p_message text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_source_entity_type text DEFAULT NULL,
  p_source_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.notification_inbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_inbox;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
    RAISE EXCEPTION 'tenant_id_required';
  END IF;
  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;
  IF p_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'recipient_user_id_required';
  END IF;

  SELECT * INTO v_row
  FROM public.notification_inbox
  WHERE tenant_id = p_tenant_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.notification_inbox (
    event_id,
    event_type,
    category,
    priority,
    tenant_id,
    venue_id,
    club_id,
    competition_id,
    recipient_user_id,
    actor_user_id,
    title,
    message,
    status,
    idempotency_key,
    source_entity_type,
    source_entity_id,
    metadata
  ) VALUES (
    COALESCE(NULLIF(trim(p_event_id), ''), gen_random_uuid()::text),
    p_event_type,
    COALESCE(NULLIF(trim(p_category), ''), 'SYSTEM'),
    COALESCE(NULLIF(trim(p_priority), ''), 'NORMAL'),
    p_tenant_id,
    NULLIF(trim(p_venue_id), ''),
    NULLIF(trim(p_club_id), ''),
    NULLIF(trim(p_competition_id), ''),
    p_recipient_user_id,
    p_actor_user_id,
    COALESCE(NULLIF(trim(p_title), ''), p_event_type),
    COALESCE(p_message, ''),
    'CREATED',
    p_idempotency_key,
    NULLIF(trim(p_source_entity_type), ''),
    NULLIF(trim(p_source_entity_id), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_inbox_create(
  text, text, text, text, text, text, text, text, uuid, uuid, text, text, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_inbox_create(
  text, text, text, text, text, text, text, text, uuid, uuid, text, text, text, text, text, jsonb
) TO authenticated;

-- ─── RPC: enqueue delivery job (foundation only — no live providers) ─
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_channel := COALESCE(NULLIF(trim(p_channel), ''), 'in_app');

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
    scheduled_at
  ) VALUES (
    p_notification_id,
    p_tenant_id,
    v_channel,
    'QUEUED',
    now()
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

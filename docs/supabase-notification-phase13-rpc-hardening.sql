-- PICK_VN Notification Phase 1.3 — RPC hardening (Staging)
-- Apply AFTER Phase 1.4. Staging only.
-- Fixes: authenticated users must not create notifications for arbitrary recipients.
--
-- Rules for notification_inbox_create:
-- 1. Caller must be authenticated.
-- 2. p_tenant_id required.
-- 3. Caller's profiles.venue_id must equal p_tenant_id (same-tenant actor).
-- 4. Recipient profiles.venue_id must equal p_tenant_id (same-tenant recipient).
-- 5. Delivery enqueue only for notifications in caller's tenant.

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
  v_caller_venue text;
  v_recipient_venue text;
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

  SELECT p.venue_id INTO v_caller_venue
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND coalesce(p.status, 'active') = 'active';

  IF v_caller_venue IS NULL OR v_caller_venue IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'tenant_scope_denied';
  END IF;

  SELECT p.venue_id INTO v_recipient_venue
  FROM public.profiles p
  WHERE p.id = p_recipient_user_id
    AND coalesce(p.status, 'active') = 'active';

  IF v_recipient_venue IS NULL OR v_recipient_venue IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'recipient_tenant_mismatch';
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
    COALESCE(p_actor_user_id, auth.uid()),
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
  v_caller_venue text;
  v_notif public.notification_inbox;
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

  SELECT * INTO v_notif
  FROM public.notification_inbox
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_not_found';
  END IF;

  IF v_notif.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'notification_tenant_mismatch';
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

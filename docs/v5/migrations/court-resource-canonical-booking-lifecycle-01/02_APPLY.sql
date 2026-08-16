-- Court Operations canonical booking lifecycle 01. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
-- BOOKING_LIFECYCLE_MIGRATION_VERSION=20260816160000
--
-- Ownership separation:
--   * Capacity SSOT stays public.court_resource_reservations (Phase 3B).
--   * Booking business aggregate lives in public.court_operations_bookings.
--   * Booking rows never define capacity. Every capacity effect goes through
--     public.court_resource_reserve_core (Phase 3B), unchanged.
--
-- Identity authority is physicalCourtId (uuid). Labels / legacy court ids are
-- never identity here; court_display_name is a projection snapshot only.
--
-- Does not create, alter or drop any Phase 3A / Phase 3B / D4 / Batch1 / Batch2
-- object. SECURITY DEFINER owner: migration/table owner. Authorization is
-- fail-closed in-function.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Booking business aggregate (Court Operations owned).
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_bookings (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  reservation_id uuid NULL
    REFERENCES public.court_resource_reservations(reservation_id)
    ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  lifecycle_status text NOT NULL
    CHECK (lifecycle_status IN (
      'pending', 'confirmed', 'checked_in', 'playing',
      'completed', 'cancelled', 'no_show'
    )),
  booking_code text NOT NULL CHECK (btrim(booking_code) <> ''),
  booking_type text NOT NULL DEFAULT 'single'
    CHECK (booking_type IN ('single', 'recurring', 'social_play', 'walk_in')),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  customer_type text NOT NULL DEFAULT 'walk_in',
  -- Customer boundary is deferred. This is a reference string only; it is not
  -- a foreign key and must not be treated as a canonical customer identity.
  customer_ref text NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  note text NOT NULL DEFAULT '',
  -- Projection / snapshot only. NOT identity. Never used for court resolution.
  court_display_name text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  CONSTRAINT court_operations_bookings_range_check CHECK (ends_at > starts_at),
  CONSTRAINT court_operations_bookings_cancel_audit_check CHECK (
    (lifecycle_status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (lifecycle_status <> 'cancelled' AND cancelled_at IS NULL)
  ),
  CONSTRAINT court_operations_bookings_request_uniq UNIQUE (tenant_id, request_id)
);

CREATE INDEX court_operations_bookings_club_window_idx
  ON public.court_operations_bookings (tenant_id, club_id, starts_at);
CREATE INDEX court_operations_bookings_court_window_idx
  ON public.court_operations_bookings (tenant_id, physical_court_id, starts_at);
CREATE INDEX court_operations_bookings_lifecycle_idx
  ON public.court_operations_bookings (tenant_id, lifecycle_status);
CREATE INDEX court_operations_bookings_reservation_idx
  ON public.court_operations_bookings (reservation_id);

-- ---------------------------------------------------------------------------
-- Idempotency ledger for booking operations. Separate from the Phase 3B
-- reservation command ledger; this package never writes to that table.
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_booking_commands (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  operation text NOT NULL
    CHECK (operation IN ('create', 'reschedule', 'transfer', 'cancel', 'lifecycle')),
  payload_fingerprint text NOT NULL CHECK (btrim(payload_fingerprint) <> ''),
  status text NOT NULL CHECK (status IN ('succeeded', 'conflict', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(result) = 'object'),
  booking_id uuid NULL,
  reservation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_operations_booking_commands_request_uniq
    UNIQUE (tenant_id, request_id)
);

CREATE INDEX court_operations_booking_commands_created_idx
  ON public.court_operations_booking_commands (tenant_id, created_at);
CREATE INDEX court_operations_booking_commands_booking_idx
  ON public.court_operations_booking_commands (tenant_id, booking_id);

-- ---------------------------------------------------------------------------
-- Security: RLS forced, read-only policy, zero client table grants.
-- All access is through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.court_operations_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_booking_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_booking_commands FORCE ROW LEVEL SECURITY;

CREATE POLICY court_operations_bookings_select
ON public.court_operations_bookings FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);
CREATE POLICY court_operations_booking_commands_select
ON public.court_operations_booking_commands FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);

REVOKE ALL ON public.court_operations_bookings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_operations_booking_commands FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.court_operations_booking_utc_text(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT to_char(p_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$cr$;

CREATE FUNCTION public.court_operations_booking_payload_text(
  p_payload jsonb,
  p_key text,
  p_default text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT coalesce(
    nullif(btrim(coalesce(p_payload ->> p_key, '')), ''),
    coalesce(p_default, '')
  );
$cr$;

CREATE FUNCTION public.court_operations_booking_payload_numeric(
  p_payload jsonb,
  p_key text,
  p_default numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE
    WHEN p_payload IS NULL THEN p_default
    WHEN jsonb_typeof(p_payload -> p_key) = 'number'
      THEN (p_payload ->> p_key)::numeric
    WHEN jsonb_typeof(p_payload -> p_key) = 'string'
      AND btrim(p_payload ->> p_key) ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (btrim(p_payload ->> p_key))::numeric
    ELSE p_default
  END;
$cr$;

CREATE FUNCTION public.court_operations_booking_fingerprint(
  p_operation text,
  p_payload jsonb
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT encode(
    public.court_resource_digest_sha256(convert_to(
      jsonb_build_object(
        'package', 'court_resource_canonical_booking_lifecycle_01',
        'operation', coalesce(p_operation, ''),
        'payload', coalesce(p_payload, '{}'::jsonb)
      )::text,
      'UTF8'
    )),
    'hex'
  );
$cr$;

CREATE FUNCTION public.court_operations_booking_lifecycle_allowed(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT coalesce(p_status, '') IN (
    'pending', 'confirmed', 'checked_in', 'playing', 'completed', 'no_show'
  );
$cr$;

CREATE FUNCTION public.court_operations_booking_transition_allowed(
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE
    WHEN p_from IS NULL OR p_to IS NULL THEN false
    WHEN NOT public.court_operations_booking_lifecycle_allowed(p_from) THEN false
    WHEN NOT public.court_operations_booking_lifecycle_allowed(p_to) THEN false
    WHEN p_from = p_to THEN true
    WHEN p_from = 'pending' THEN p_to IN ('confirmed', 'checked_in', 'no_show')
    WHEN p_from = 'confirmed' THEN p_to IN ('checked_in', 'playing', 'no_show')
    WHEN p_from = 'checked_in' THEN p_to IN ('playing', 'completed', 'no_show')
    WHEN p_from = 'playing' THEN p_to IN ('completed')
    ELSE false
  END;
$cr$;

CREATE FUNCTION public.court_operations_booking_serialize(
  p_row public.court_operations_bookings
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT jsonb_build_object(
    'bookingId', p_row.booking_id,
    'tenantId', p_row.tenant_id,
    'clubId', p_row.club_id,
    'physicalCourtId', p_row.physical_court_id,
    'reservationId', p_row.reservation_id,
    'startsAt', public.court_operations_booking_utc_text(p_row.starts_at),
    'endsAt', public.court_operations_booking_utc_text(p_row.ends_at),
    'lifecycleStatus', p_row.lifecycle_status,
    'bookingCode', p_row.booking_code,
    'bookingType', p_row.booking_type,
    'customerName', p_row.customer_name,
    'customerPhone', p_row.customer_phone,
    'customerType', p_row.customer_type,
    'customerRef', p_row.customer_ref,
    'totalAmount', p_row.total_amount,
    'depositAmount', p_row.deposit_amount,
    'paidAmount', p_row.paid_amount,
    'paymentStatus', p_row.payment_status,
    'note', p_row.note,
    'courtDisplayName', p_row.court_display_name,
    'version', p_row.version,
    'createdAt', public.court_operations_booking_utc_text(p_row.created_at),
    'updatedAt', public.court_operations_booking_utc_text(p_row.updated_at),
    'cancelledAt', public.court_operations_booking_utc_text(p_row.cancelled_at),
    'identityAuthority', 'physicalCourtId'
  );
$cr$;

-- Tenant-only guard. Used before idempotency replay so a replay can never leak
-- across tenants. No venueId fallback, no default club.
CREATE FUNCTION public.court_operations_booking_assert_tenant(p_tenant_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF nullif(btrim(coalesce(p_tenant_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_TENANT_ID');
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN');
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

-- Full scope guard: authenticated + explicit tenant + club owned by tenant.
-- No venueId fallback. No default club.
CREATE FUNCTION public.court_operations_booking_assert_scope(
  p_tenant_id text,
  p_club_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_tenant jsonb;
  v_club_tenant text;
BEGIN
  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;
  IF nullif(btrim(coalesce(p_club_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_CLUB_ID');
  END IF;
  SELECT c.tenant_id INTO v_club_tenant
  FROM public.clubs c
  WHERE c.id = btrim(p_club_id);
  IF v_club_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CLUB_NOT_FOUND');
  END IF;
  IF v_club_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CLUB_TENANT_MISMATCH');
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

-- Owner-safe capacity release. Only releases active reservations whose owner is
-- exactly this booking. Never touches foreign owners.
CREATE FUNCTION public.court_operations_booking_release_own_capacity(
  p_tenant_id text,
  p_booking_id uuid,
  p_reason text,
  p_actor uuid,
  p_keep_reservation_id uuid DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_released uuid[] := '{}'::uuid[];
BEGIN
  WITH released AS (
    UPDATE public.court_resource_reservations r
    SET status = 'released',
        released_by = p_actor,
        released_at = now(),
        release_reason = coalesce(nullif(btrim(p_reason), ''), 'booking_released'),
        updated_at = now()
    WHERE r.tenant_id = p_tenant_id
      AND r.owner_type = 'booking'
      AND r.owner_id = p_booking_id::text
      AND r.status = 'active'
      AND (p_keep_reservation_id IS NULL OR r.reservation_id <> p_keep_reservation_id)
    RETURNING r.reservation_id
  )
  SELECT coalesce(array_agg(reservation_id ORDER BY reservation_id), '{}'::uuid[])
  INTO v_released
  FROM released;
  RETURN v_released;
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 1: create
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_create(
  p_tenant_id text,
  p_club_id text,
  p_physical_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_id text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_actor uuid;
  v_request_id text;
  v_payload jsonb;
  v_scope jsonb;
  v_fingerprint text;
  v_existing public.court_operations_booking_commands%ROWTYPE;
  v_booking_id uuid;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_row public.court_operations_bookings%ROWTYPE;
  v_lifecycle text;
  v_booking_type text;
  v_booking_code text;
  v_owner_sub_type text;
  v_result jsonb;
BEGIN
  v_payload := CASE
    WHEN jsonb_typeof(p_payload) = 'object' THEN p_payload
    ELSE '{}'::jsonb
  END;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, p_club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;

  -- Identity authority is the canonical physical court uuid. Non-uuid identity
  -- (labels, legacy court ids, numbers) cannot reach here: it fails at the
  -- uuid parameter cast. A null uuid is rejected explicitly.
  IF p_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;

  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;

  v_lifecycle := public.court_operations_booking_payload_text(
    v_payload, 'lifecycleStatus', 'pending'
  );
  IF NOT public.court_operations_booking_lifecycle_allowed(v_lifecycle) THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_LIFECYCLE_STATUS', 'lifecycleStatus', v_lifecycle
    );
  END IF;

  v_booking_type := public.court_operations_booking_payload_text(
    v_payload, 'bookingType', 'single'
  );
  IF v_booking_type NOT IN ('single', 'recurring', 'social_play', 'walk_in') THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_BOOKING_TYPE', 'bookingType', v_booking_type
    );
  END IF;

  v_owner_sub_type := nullif(
    public.court_operations_booking_payload_text(v_payload, 'ownerSubType', ''),
    ''
  );

  v_fingerprint := public.court_operations_booking_fingerprint(
    'create',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'clubId', btrim(p_club_id),
      'physicalCourtId', p_physical_court_id,
      'startsAt', public.court_operations_booking_utc_text(p_starts_at),
      'endsAt', public.court_operations_booking_utc_text(p_ends_at),
      'lifecycleStatus', v_lifecycle,
      'bookingType', v_booking_type,
      'ownerSubType', coalesce(v_owner_sub_type, '')
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_booking_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'create'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  v_booking_id := gen_random_uuid();

  -- Capacity is acquired only through the Phase 3B reservation authority.
  -- reserve_core traps its own conflicts, so a failure leaves no orphan row.
  v_reserve := public.court_resource_reserve_core(
    p_tenant_id,
    btrim(p_club_id),
    ARRAY[p_physical_court_id],
    'booking',
    v_booking_id::text,
    v_owner_sub_type,
    p_starts_at,
    p_ends_at,
    v_request_id,
    v_actor
  );
  IF NOT coalesce((v_reserve->>'ok')::boolean, false) THEN
    RETURN v_reserve || jsonb_build_object(
      'ok', false,
      'stage', 'capacity',
      'physicalCourtId', p_physical_court_id,
      'replay', false
    );
  END IF;

  v_reservation_id := (v_reserve->'reservationIds'->>0)::uuid;
  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'COURT_OPERATIONS_BOOKING_RESERVATION_MISSING booking %', v_booking_id;
  END IF;

  v_booking_code := public.court_operations_booking_payload_text(
    v_payload,
    'bookingCode',
    'BK-' || upper(substr(replace(v_booking_id::text, '-', ''), 1, 10))
  );

  INSERT INTO public.court_operations_bookings (
    booking_id, tenant_id, club_id, physical_court_id, reservation_id,
    starts_at, ends_at, lifecycle_status, booking_code, booking_type,
    customer_name, customer_phone, customer_type, customer_ref,
    total_amount, deposit_amount, paid_amount, payment_status,
    note, court_display_name, version, request_id,
    created_by, updated_by, created_at, updated_at, cancelled_at
  ) VALUES (
    v_booking_id, p_tenant_id, btrim(p_club_id), p_physical_court_id, v_reservation_id,
    p_starts_at, p_ends_at, v_lifecycle, v_booking_code, v_booking_type,
    public.court_operations_booking_payload_text(v_payload, 'customerName', ''),
    public.court_operations_booking_payload_text(v_payload, 'customerPhone', ''),
    public.court_operations_booking_payload_text(v_payload, 'customerType', 'walk_in'),
    nullif(public.court_operations_booking_payload_text(v_payload, 'customerRef', ''), ''),
    public.court_operations_booking_payload_numeric(v_payload, 'totalAmount', 0),
    public.court_operations_booking_payload_numeric(v_payload, 'depositAmount', 0),
    public.court_operations_booking_payload_numeric(v_payload, 'paidAmount', 0),
    public.court_operations_booking_payload_text(v_payload, 'paymentStatus', 'unpaid'),
    public.court_operations_booking_payload_text(v_payload, 'note', ''),
    public.court_operations_booking_payload_text(v_payload, 'courtDisplayName', ''),
    1, v_request_id,
    v_actor, v_actor, now(), now(), NULL
  )
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'booking', public.court_operations_booking_serialize(v_row),
    'bookingId', v_row.booking_id,
    'reservationId', v_reservation_id,
    'physicalCourtId', v_row.physical_court_id,
    'replay', false
  );

  INSERT INTO public.court_operations_booking_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, booking_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'create', v_fingerprint, 'succeeded',
    v_result, v_booking_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_booking_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND
       AND v_existing.operation IS NOT DISTINCT FROM 'create'
       AND v_existing.payload_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FOREIGN_RESERVATION_CONFLICT');
  WHEN foreign_key_violation OR check_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 2: reschedule (time-only or combined time + court)
-- Atomic replace: release own capacity, reserve the new window, or roll back.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_reschedule(
  p_tenant_id text,
  p_booking_id uuid,
  p_physical_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_expected_version int,
  p_request_id text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_actor uuid;
  v_request_id text;
  v_payload jsonb;
  v_tenant jsonb;
  v_scope jsonb;
  v_fingerprint text;
  v_existing public.court_operations_booking_commands%ROWTYPE;
  v_row public.court_operations_bookings%ROWTYPE;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_released uuid[];
  v_owner_sub_type text;
  v_detail text;
  v_result jsonb;
BEGIN
  v_payload := CASE
    WHEN jsonb_typeof(p_payload) = 'object' THEN p_payload
    ELSE '{}'::jsonb
  END;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_BOOKING_ID');
  END IF;
  IF p_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;

  v_owner_sub_type := nullif(
    public.court_operations_booking_payload_text(v_payload, 'ownerSubType', ''),
    ''
  );

  v_fingerprint := public.court_operations_booking_fingerprint(
    'reschedule',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'bookingId', p_booking_id,
      'physicalCourtId', p_physical_court_id,
      'startsAt', public.court_operations_booking_utc_text(p_starts_at),
      'endsAt', public.court_operations_booking_utc_text(p_ends_at),
      'expectedVersion', p_expected_version,
      'ownerSubType', coalesce(v_owner_sub_type, '')
    )
  );

  -- Replay is resolved before the version check so a retried success never
  -- degrades into a spurious VERSION_CONFLICT.
  SELECT * INTO v_existing
  FROM public.court_operations_booking_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'reschedule'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  IF p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', v_row.version
    );
  END IF;

  IF v_row.lifecycle_status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_CANCELLED');
  END IF;
  IF v_row.lifecycle_status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_COMPLETED_IMMUTABLE');
  END IF;

  -- Mutation block. Any capacity failure raises so the release is undone and
  -- the previously held window is preserved exactly as it was.
  BEGIN
    v_released := public.court_operations_booking_release_own_capacity(
      p_tenant_id, p_booking_id, 'booking_reschedule', v_actor, NULL
    );

    v_reserve := public.court_resource_reserve_core(
      p_tenant_id,
      v_row.club_id,
      ARRAY[p_physical_court_id],
      'booking',
      p_booking_id::text,
      v_owner_sub_type,
      p_starts_at,
      p_ends_at,
      v_request_id,
      v_actor
    );
    IF NOT coalesce((v_reserve->>'ok')::boolean, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COURT_OPERATIONS_BOOKING_RESCHEDULE_CAPACITY_FAILED',
        DETAIL = v_reserve::text;
    END IF;

    v_reservation_id := (v_reserve->'reservationIds'->>0)::uuid;
    IF v_reservation_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COURT_OPERATIONS_BOOKING_RESCHEDULE_CAPACITY_FAILED',
        DETAIL = jsonb_build_object(
          'ok', false, 'code', 'RESERVATION_MISSING'
        )::text;
    END IF;

    UPDATE public.court_operations_bookings
    SET physical_court_id = p_physical_court_id,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        reservation_id = v_reservation_id,
        court_display_name = public.court_operations_booking_payload_text(
          v_payload, 'courtDisplayName', court_display_name
        ),
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RETURN coalesce(
        nullif(btrim(coalesce(v_detail, '')), '')::jsonb,
        jsonb_build_object('ok', false, 'code', 'FOREIGN_RESERVATION_CONFLICT')
      ) || jsonb_build_object(
        'ok', false,
        'stage', 'capacity',
        'bookingId', p_booking_id,
        'physicalCourtId', p_physical_court_id,
        'capacityPreserved', true,
        'replay', false
      );
    WHEN exclusion_violation OR unique_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'FOREIGN_RESERVATION_CONFLICT',
        'stage', 'capacity',
        'bookingId', p_booking_id,
        'capacityPreserved', true,
        'replay', false
      );
  END;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'booking', public.court_operations_booking_serialize(v_row),
    'bookingId', v_row.booking_id,
    'reservationId', v_reservation_id,
    'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
    'physicalCourtId', v_row.physical_court_id,
    'replay', false
  );

  INSERT INTO public.court_operations_booking_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, booking_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'reschedule', v_fingerprint, 'succeeded',
    v_result, p_booking_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_booking_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND
       AND v_existing.operation IS NOT DISTINCT FROM 'reschedule'
       AND v_existing.payload_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 3: transfer_court (same booking_id preserved)
-- Reserve the target first, then release the source. Distinct courts are
-- non-overlapping resources, so both can be held for the duration of the
-- transaction without self-conflict.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_transfer_court(
  p_tenant_id text,
  p_booking_id uuid,
  p_new_physical_court_id uuid,
  p_expected_version int,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_actor uuid;
  v_request_id text;
  v_tenant jsonb;
  v_scope jsonb;
  v_access jsonb;
  v_fingerprint text;
  v_existing public.court_operations_booking_commands%ROWTYPE;
  v_row public.court_operations_bookings%ROWTYPE;
  v_old_court uuid;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_released uuid[];
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_BOOKING_ID');
  END IF;
  IF p_new_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;

  v_fingerprint := public.court_operations_booking_fingerprint(
    'transfer',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'bookingId', p_booking_id,
      'newPhysicalCourtId', p_new_physical_court_id,
      'expectedVersion', p_expected_version
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_booking_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'transfer'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  IF p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', v_row.version
    );
  END IF;

  IF v_row.lifecycle_status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_CANCELLED');
  END IF;
  IF v_row.lifecycle_status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_COMPLETED_IMMUTABLE');
  END IF;

  v_old_court := v_row.physical_court_id;

  IF v_old_court = p_new_physical_court_id THEN
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'noop', true,
      'booking', public.court_operations_booking_serialize(v_row),
      'bookingId', v_row.booking_id,
      'reservationId', v_row.reservation_id,
      'physicalCourtId', v_row.physical_court_id,
      'replay', false
    );
    INSERT INTO public.court_operations_booking_commands (
      tenant_id, request_id, operation, payload_fingerprint, status,
      result, booking_id, reservation_ids
    ) VALUES (
      p_tenant_id, v_request_id, 'transfer', v_fingerprint, 'succeeded',
      v_result, p_booking_id,
      CASE
        WHEN v_row.reservation_id IS NULL THEN '{}'::uuid[]
        ELSE ARRAY[v_row.reservation_id]
      END
    );
    RETURN v_result;
  END IF;

  -- Target scope is validated up front so an out-of-scope court returns a
  -- precise code without ever touching the currently held reservation.
  v_access := public.court_resource_reservation_assert_access(
    p_tenant_id, v_row.club_id, ARRAY[p_new_physical_court_id]
  );
  IF NOT coalesce((v_access->>'ok')::boolean, false) THEN
    RETURN v_access || jsonb_build_object(
      'ok', false,
      'stage', 'capacity',
      'bookingId', p_booking_id,
      'capacityPreserved', true,
      'replay', false
    );
  END IF;

  -- Acquire the target BEFORE releasing the source. On failure the source
  -- reservation is still held and the booking is unchanged.
  v_reserve := public.court_resource_reserve_core(
    p_tenant_id,
    v_row.club_id,
    ARRAY[p_new_physical_court_id],
    'booking',
    p_booking_id::text,
    NULL,
    v_row.starts_at,
    v_row.ends_at,
    v_request_id,
    v_actor
  );
  IF NOT coalesce((v_reserve->>'ok')::boolean, false) THEN
    RETURN v_reserve || jsonb_build_object(
      'ok', false,
      'stage', 'capacity',
      'bookingId', p_booking_id,
      'physicalCourtId', v_old_court,
      'capacityPreserved', true,
      'replay', false
    );
  END IF;

  v_reservation_id := (v_reserve->'reservationIds'->>0)::uuid;
  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'COURT_OPERATIONS_BOOKING_TRANSFER_RESERVATION_MISSING booking %',
      p_booking_id;
  END IF;

  v_released := public.court_operations_booking_release_own_capacity(
    p_tenant_id, p_booking_id, 'booking_transfer_court', v_actor, v_reservation_id
  );

  UPDATE public.court_operations_bookings
  SET physical_court_id = p_new_physical_court_id,
      reservation_id = v_reservation_id,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
  WHERE booking_id = p_booking_id
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'noop', false,
    'booking', public.court_operations_booking_serialize(v_row),
    'bookingId', v_row.booking_id,
    'reservationId', v_reservation_id,
    'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
    'physicalCourtId', v_row.physical_court_id,
    'previousPhysicalCourtId', v_old_court,
    'replay', false
  );

  INSERT INTO public.court_operations_booking_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, booking_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'transfer', v_fingerprint, 'succeeded',
    v_result, p_booking_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_booking_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND
       AND v_existing.operation IS NOT DISTINCT FROM 'transfer'
       AND v_existing.payload_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FOREIGN_RESERVATION_CONFLICT');
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 4: cancel
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_cancel(
  p_tenant_id text,
  p_booking_id uuid,
  p_request_id text,
  p_release_reason text DEFAULT 'booking_cancelled'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_actor uuid;
  v_request_id text;
  v_reason text;
  v_tenant jsonb;
  v_scope jsonb;
  v_fingerprint text;
  v_existing public.court_operations_booking_commands%ROWTYPE;
  v_row public.court_operations_bookings%ROWTYPE;
  v_released uuid[];
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_BOOKING_ID');
  END IF;

  v_reason := coalesce(nullif(btrim(coalesce(p_release_reason, '')), ''), 'booking_cancelled');

  v_fingerprint := public.court_operations_booking_fingerprint(
    'cancel',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'bookingId', p_booking_id,
      'releaseReason', v_reason
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_booking_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'cancel'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  -- Owner-safe: only reservations whose owner_type = 'booking' and
  -- owner_id = this booking are ever released.
  v_released := public.court_operations_booking_release_own_capacity(
    p_tenant_id, p_booking_id, v_reason, v_actor, NULL
  );

  IF v_row.lifecycle_status = 'cancelled' THEN
    -- Already cancelled: idempotent OK. The release above closes any drift
    -- where the booking was cancelled but capacity was still held.
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'alreadyCancelled', true,
      'booking', public.court_operations_booking_serialize(v_row),
      'bookingId', v_row.booking_id,
      'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
      'replay', false
    );
  ELSE
    UPDATE public.court_operations_bookings
    SET lifecycle_status = 'cancelled',
        cancelled_at = now(),
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_row;

    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'alreadyCancelled', false,
      'booking', public.court_operations_booking_serialize(v_row),
      'bookingId', v_row.booking_id,
      'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
      'replay', false
    );
  END IF;

  INSERT INTO public.court_operations_booking_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, booking_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'cancel', v_fingerprint, 'succeeded',
    v_result, p_booking_id, coalesce(v_released, '{}'::uuid[])
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_booking_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND
       AND v_existing.operation IS NOT DISTINCT FROM 'cancel'
       AND v_existing.payload_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 5: update_lifecycle
-- Business lifecycle only. Never mutates capacity and never rewrites
-- reservation history.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_update_lifecycle(
  p_tenant_id text,
  p_booking_id uuid,
  p_lifecycle_status text,
  p_expected_version int,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_actor uuid;
  v_request_id text;
  v_target text;
  v_tenant jsonb;
  v_scope jsonb;
  v_fingerprint text;
  v_existing public.court_operations_booking_commands%ROWTYPE;
  v_row public.court_operations_bookings%ROWTYPE;
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_BOOKING_ID');
  END IF;

  v_target := lower(btrim(coalesce(p_lifecycle_status, '')));
  IF NOT public.court_operations_booking_lifecycle_allowed(v_target) THEN
    -- 'cancelled' is deliberately not reachable here: cancellation must
    -- release capacity, which only court_operations_booking_cancel does.
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_LIFECYCLE_STATUS',
      'lifecycleStatus', v_target
    );
  END IF;

  v_fingerprint := public.court_operations_booking_fingerprint(
    'lifecycle',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'bookingId', p_booking_id,
      'lifecycleStatus', v_target,
      'expectedVersion', p_expected_version
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_booking_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'lifecycle'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  IF v_row.lifecycle_status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_CANCELLED');
  END IF;

  IF p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', v_row.version
    );
  END IF;

  IF NOT public.court_operations_booking_transition_allowed(
    v_row.lifecycle_status, v_target
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_LIFECYCLE_TRANSITION',
      'fromLifecycleStatus', v_row.lifecycle_status,
      'toLifecycleStatus', v_target
    );
  END IF;

  IF v_row.lifecycle_status IS DISTINCT FROM v_target THEN
    UPDATE public.court_operations_bookings
    SET lifecycle_status = v_target,
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_row;
  END IF;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'booking', public.court_operations_booking_serialize(v_row),
    'bookingId', v_row.booking_id,
    'lifecycleStatus', v_row.lifecycle_status,
    'capacityMutated', false,
    'replay', false
  );

  INSERT INTO public.court_operations_booking_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, booking_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'lifecycle', v_fingerprint, 'succeeded',
    v_result, p_booking_id, '{}'::uuid[]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_booking_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND
       AND v_existing.operation IS NOT DISTINCT FROM 'lifecycle'
       AND v_existing.payload_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 6: get
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_get(
  p_tenant_id text,
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_tenant jsonb;
  v_scope jsonb;
  v_row public.court_operations_bookings%ROWTYPE;
BEGIN
  v_tenant := public.court_operations_booking_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant || jsonb_build_object('booking', NULL);
  END IF;
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_BOOKING_ID', 'booking', NULL);
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_bookings
  WHERE booking_id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND', 'booking', NULL);
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH', 'booking', NULL);
  END IF;

  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope || jsonb_build_object('booking', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'booking', public.court_operations_booking_serialize(v_row)
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 7: list
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_booking_list(
  p_tenant_id text,
  p_club_id text,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_lifecycle_statuses text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_scope jsonb;
  v_statuses text[];
  v_rows jsonb := '[]'::jsonb;
BEGIN
  v_scope := public.court_operations_booking_assert_scope(p_tenant_id, p_club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope || jsonb_build_object('bookings', '[]'::jsonb);
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to <= p_from THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_TIME_RANGE', 'bookings', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
    array_agg(DISTINCT lower(btrim(s))) FILTER (WHERE nullif(btrim(s), '') IS NOT NULL),
    NULL
  )
  INTO v_statuses
  FROM unnest(coalesce(p_lifecycle_statuses, '{}'::text[])) AS s;

  IF v_statuses IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(v_statuses) AS s
    WHERE s NOT IN (
      'pending', 'confirmed', 'checked_in', 'playing',
      'completed', 'cancelled', 'no_show'
    )
  ) THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_LIFECYCLE_STATUS', 'bookings', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(jsonb_agg(payload ORDER BY starts_at, physical_court_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT public.court_operations_booking_serialize(b) AS payload,
           b.starts_at AS starts_at,
           b.physical_court_id AS physical_court_id
    FROM public.court_operations_bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.club_id = btrim(p_club_id)
      AND (p_from IS NULL OR b.ends_at > p_from)
      AND (p_to IS NULL OR b.starts_at < p_to)
      AND (v_statuses IS NULL OR b.lifecycle_status = ANY (v_statuses))
  ) listed;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'bookings', v_rows,
    'identityAuthority', 'physicalCourtId'
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- Grants. Internal helpers stay owner-only. Public RPCs are authenticated-only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.court_operations_booking_utc_text(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_payload_text(jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_payload_numeric(jsonb, text, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_fingerprint(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_lifecycle_allowed(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_transition_allowed(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_serialize(public.court_operations_bookings)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_assert_tenant(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_assert_scope(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_booking_release_own_capacity(text, uuid, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.court_operations_booking_create(text, text, uuid, timestamptz, timestamptz, text, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_reschedule(text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_transfer_court(text, uuid, uuid, int, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_cancel(text, uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_update_lifecycle(text, uuid, text, int, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_get(text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_booking_list(text, text, timestamptz, timestamptz, text[])
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.court_operations_booking_create(text, text, uuid, timestamptz, timestamptz, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_reschedule(text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_transfer_court(text, uuid, uuid, int, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_cancel(text, uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_update_lifecycle(text, uuid, text, int, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_get(text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_booking_list(text, text, timestamptz, timestamptz, text[])
  TO authenticated;

COMMIT;

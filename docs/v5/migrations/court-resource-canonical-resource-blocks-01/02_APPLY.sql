-- Court Operations canonical resource blocks 01. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
-- RESOURCE_BLOCKS_MIGRATION_VERSION=20260816180000
--
-- Ownership separation:
--   * Capacity SSOT stays public.court_resource_reservations (Phase 3B).
--   * Resource block business aggregate lives in
--     public.court_operations_resource_blocks.
--   * Resource block rows never define capacity. Every capacity effect goes
--     through public.court_resource_reserve_core (Phase 3B), unchanged.
--
-- Owner mapping (Phase 3B vocabulary — do NOT invent court_resource_block):
--   MAINTENANCE       → owner_type=maintenance, owner_sub_type=resource_block
--   OPERATIONAL_BLOCK → owner_type=operations,  owner_sub_type=resource_block
--   owner_id          = resource_block_id::text
--
-- Identity authority is physicalCourtId (uuid). Labels / legacy court ids are
-- never identity here; court_display_name is a projection snapshot only.
--
-- Does not create, alter or drop any Phase 3A / Phase 3B / D4 / Batch1 / Batch2
-- / Batch3 object. SECURITY DEFINER owner: migration/table owner. Authorization
-- is fail-closed in-function.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Resource block business aggregate (Court Operations owned).
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_resource_blocks (
  resource_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  reservation_id uuid NULL
    REFERENCES public.court_resource_reservations(reservation_id)
    ON DELETE RESTRICT,
  block_type text NOT NULL
    CHECK (block_type IN ('MAINTENANCE', 'OPERATIONAL_BLOCK')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  lifecycle_status text NOT NULL
    CHECK (lifecycle_status IN ('active', 'cancelled')),
  reason text NOT NULL DEFAULT '',
  operator_notes text NOT NULL DEFAULT '',
  -- Projection / snapshot only. NOT identity. Never used for court resolution.
  court_display_name text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  CONSTRAINT court_operations_resource_blocks_range_check CHECK (ends_at > starts_at),
  CONSTRAINT court_operations_resource_blocks_cancel_audit_check CHECK (
    (lifecycle_status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (lifecycle_status <> 'cancelled' AND cancelled_at IS NULL)
  ),
  CONSTRAINT court_operations_resource_blocks_request_uniq UNIQUE (tenant_id, request_id)
);

CREATE INDEX court_operations_resource_blocks_club_window_idx
  ON public.court_operations_resource_blocks (tenant_id, club_id, starts_at);
CREATE INDEX court_operations_resource_blocks_court_window_idx
  ON public.court_operations_resource_blocks (tenant_id, physical_court_id, starts_at);
CREATE INDEX court_operations_resource_blocks_lifecycle_idx
  ON public.court_operations_resource_blocks (tenant_id, lifecycle_status);
CREATE INDEX court_operations_resource_blocks_type_idx
  ON public.court_operations_resource_blocks (tenant_id, block_type);
CREATE INDEX court_operations_resource_blocks_reservation_idx
  ON public.court_operations_resource_blocks (reservation_id);

-- ---------------------------------------------------------------------------
-- Idempotency ledger for resource block operations. Separate from the Phase 3B
-- reservation command ledger; this package never writes to that table.
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_resource_block_commands (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  operation text NOT NULL
    CHECK (operation IN ('create', 'reschedule', 'transfer', 'cancel')),
  payload_fingerprint text NOT NULL CHECK (btrim(payload_fingerprint) <> ''),
  status text NOT NULL CHECK (status IN ('succeeded', 'conflict', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(result) = 'object'),
  resource_block_id uuid NULL,
  reservation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_operations_resource_block_commands_request_uniq
    UNIQUE (tenant_id, request_id)
);

CREATE INDEX court_operations_resource_block_commands_created_idx
  ON public.court_operations_resource_block_commands (tenant_id, created_at);
CREATE INDEX court_operations_resource_block_commands_block_idx
  ON public.court_operations_resource_block_commands (tenant_id, resource_block_id);

-- ---------------------------------------------------------------------------
-- Security: RLS forced, read-only policy, zero client table grants.
-- All access is through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.court_operations_resource_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_resource_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_resource_block_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_resource_block_commands FORCE ROW LEVEL SECURITY;

CREATE POLICY court_operations_resource_blocks_select
ON public.court_operations_resource_blocks FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);
CREATE POLICY court_operations_resource_block_commands_select
ON public.court_operations_resource_block_commands FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);

REVOKE ALL ON public.court_operations_resource_blocks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_operations_resource_block_commands FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.court_operations_resource_block_utc_text(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT to_char(p_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$cr$;

CREATE FUNCTION public.court_operations_resource_block_payload_text(
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

CREATE FUNCTION public.court_operations_resource_block_fingerprint(
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
        'package', 'court_resource_canonical_resource_blocks_01',
        'operation', coalesce(p_operation, ''),
        'payload', coalesce(p_payload, '{}'::jsonb)
      )::text,
      'UTF8'
    )),
    'hex'
  );
$cr$;

-- Maps business block_type → Phase 3B capacity owner_type.
-- Never invents court_resource_block.
CREATE FUNCTION public.court_operations_resource_block_owner_type(p_block_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE upper(btrim(coalesce(p_block_type, '')))
    WHEN 'MAINTENANCE' THEN 'maintenance'
    WHEN 'OPERATIONAL_BLOCK' THEN 'operations'
    ELSE NULL
  END;
$cr$;

CREATE FUNCTION public.court_operations_resource_block_serialize(
  p_row public.court_operations_resource_blocks
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT jsonb_build_object(
    'resourceBlockId', p_row.resource_block_id,
    'tenantId', p_row.tenant_id,
    'clubId', p_row.club_id,
    'physicalCourtId', p_row.physical_court_id,
    'reservationId', p_row.reservation_id,
    'blockType', p_row.block_type,
    'startsAt', public.court_operations_resource_block_utc_text(p_row.starts_at),
    'endsAt', public.court_operations_resource_block_utc_text(p_row.ends_at),
    'lifecycleStatus', p_row.lifecycle_status,
    'reason', p_row.reason,
    'operatorNotes', p_row.operator_notes,
    'courtDisplayName', p_row.court_display_name,
    'version', p_row.version,
    'createdAt', public.court_operations_resource_block_utc_text(p_row.created_at),
    'updatedAt', public.court_operations_resource_block_utc_text(p_row.updated_at),
    'cancelledAt', public.court_operations_resource_block_utc_text(p_row.cancelled_at),
    'identityAuthority', 'physicalCourtId',
    'capacityOwnerType', public.court_operations_resource_block_owner_type(p_row.block_type),
    'capacityOwnerSubType', 'resource_block'
  );
$cr$;

-- Tenant-only guard. Used before idempotency replay so a replay can never leak
-- across tenants. No venueId fallback, no default club.
CREATE FUNCTION public.court_operations_resource_block_assert_tenant(p_tenant_id text)
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
CREATE FUNCTION public.court_operations_resource_block_assert_scope(
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
  v_tenant := public.court_operations_resource_block_assert_tenant(p_tenant_id);
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
-- exactly this resource block (maintenance|operations + resource_block_id).
-- Never touches foreign owners (booking, competition, daily_play, other blocks).
CREATE FUNCTION public.court_operations_resource_block_release_own_capacity(
  p_tenant_id text,
  p_resource_block_id uuid,
  p_owner_type text,
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
  IF p_owner_type IS NULL OR p_owner_type NOT IN ('maintenance', 'operations') THEN
    RETURN '{}'::uuid[];
  END IF;
  WITH released AS (
    UPDATE public.court_resource_reservations r
    SET status = 'released',
        released_by = p_actor,
        released_at = now(),
        release_reason = coalesce(nullif(btrim(p_reason), ''), 'resource_block_released'),
        updated_at = now()
    WHERE r.tenant_id = p_tenant_id
      AND r.owner_type = p_owner_type
      AND r.owner_id = p_resource_block_id::text
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
CREATE FUNCTION public.court_operations_resource_block_create(
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
  v_existing public.court_operations_resource_block_commands%ROWTYPE;
  v_resource_block_id uuid;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_row public.court_operations_resource_blocks%ROWTYPE;
  v_block_type text;
  v_owner_type text;
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

  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, p_club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;

  IF p_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;

  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;

  v_block_type := upper(btrim(public.court_operations_resource_block_payload_text(
    v_payload, 'blockType', ''
  )));
  v_owner_type := public.court_operations_resource_block_owner_type(v_block_type);
  IF v_owner_type IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_BLOCK_TYPE', 'blockType', v_block_type
    );
  END IF;

  v_fingerprint := public.court_operations_resource_block_fingerprint(
    'create',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'clubId', btrim(p_club_id),
      'physicalCourtId', p_physical_court_id,
      'startsAt', public.court_operations_resource_block_utc_text(p_starts_at),
      'endsAt', public.court_operations_resource_block_utc_text(p_ends_at),
      'blockType', v_block_type
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_resource_block_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'create'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  v_resource_block_id := gen_random_uuid();

  -- Capacity is acquired only through the Phase 3B reservation authority.
  v_reserve := public.court_resource_reserve_core(
    p_tenant_id,
    btrim(p_club_id),
    ARRAY[p_physical_court_id],
    v_owner_type,
    v_resource_block_id::text,
    'resource_block',
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
    RAISE EXCEPTION 'COURT_OPERATIONS_RESOURCE_BLOCK_RESERVATION_MISSING block %',
      v_resource_block_id;
  END IF;

  INSERT INTO public.court_operations_resource_blocks (
    resource_block_id, tenant_id, club_id, physical_court_id, reservation_id,
    block_type, starts_at, ends_at, lifecycle_status,
    reason, operator_notes, court_display_name, version, request_id,
    created_by, updated_by, created_at, updated_at, cancelled_at
  ) VALUES (
    v_resource_block_id, p_tenant_id, btrim(p_club_id), p_physical_court_id, v_reservation_id,
    v_block_type, p_starts_at, p_ends_at, 'active',
    public.court_operations_resource_block_payload_text(v_payload, 'reason', ''),
    public.court_operations_resource_block_payload_text(v_payload, 'operatorNotes', ''),
    public.court_operations_resource_block_payload_text(v_payload, 'courtDisplayName', ''),
    1, v_request_id,
    v_actor, v_actor, now(), now(), NULL
  )
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'resourceBlock', public.court_operations_resource_block_serialize(v_row),
    'resourceBlockId', v_row.resource_block_id,
    'reservationId', v_reservation_id,
    'physicalCourtId', v_row.physical_court_id,
    'replay', false
  );

  INSERT INTO public.court_operations_resource_block_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, resource_block_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'create', v_fingerprint, 'succeeded',
    v_result, v_resource_block_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_resource_block_commands
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
CREATE FUNCTION public.court_operations_resource_block_reschedule(
  p_tenant_id text,
  p_resource_block_id uuid,
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
  v_existing public.court_operations_resource_block_commands%ROWTYPE;
  v_row public.court_operations_resource_blocks%ROWTYPE;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_released uuid[];
  v_owner_type text;
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

  v_tenant := public.court_operations_resource_block_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_resource_block_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_RESOURCE_BLOCK_ID');
  END IF;
  IF p_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;

  v_fingerprint := public.court_operations_resource_block_fingerprint(
    'reschedule',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'resourceBlockId', p_resource_block_id,
      'physicalCourtId', p_physical_court_id,
      'startsAt', public.court_operations_resource_block_utc_text(p_starts_at),
      'endsAt', public.court_operations_resource_block_utc_text(p_ends_at),
      'expectedVersion', p_expected_version
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_resource_block_commands
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
  FROM public.court_operations_resource_blocks
  WHERE resource_block_id = p_resource_block_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RESOURCE_BLOCK_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, v_row.club_id);
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
    RETURN jsonb_build_object('ok', false, 'code', 'RESOURCE_BLOCK_CANCELLED');
  END IF;

  v_owner_type := public.court_operations_resource_block_owner_type(v_row.block_type);

  BEGIN
    v_released := public.court_operations_resource_block_release_own_capacity(
      p_tenant_id, p_resource_block_id, v_owner_type,
      'resource_block_reschedule', v_actor, NULL
    );

    v_reserve := public.court_resource_reserve_core(
      p_tenant_id,
      v_row.club_id,
      ARRAY[p_physical_court_id],
      v_owner_type,
      p_resource_block_id::text,
      'resource_block',
      p_starts_at,
      p_ends_at,
      v_request_id,
      v_actor
    );
    IF NOT coalesce((v_reserve->>'ok')::boolean, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COURT_OPERATIONS_RESOURCE_BLOCK_RESCHEDULE_CAPACITY_FAILED',
        DETAIL = v_reserve::text;
    END IF;

    v_reservation_id := (v_reserve->'reservationIds'->>0)::uuid;
    IF v_reservation_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COURT_OPERATIONS_RESOURCE_BLOCK_RESCHEDULE_CAPACITY_FAILED',
        DETAIL = jsonb_build_object(
          'ok', false, 'code', 'RESERVATION_MISSING'
        )::text;
    END IF;

    UPDATE public.court_operations_resource_blocks
    SET physical_court_id = p_physical_court_id,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        reservation_id = v_reservation_id,
        court_display_name = public.court_operations_resource_block_payload_text(
          v_payload, 'courtDisplayName', court_display_name
        ),
        reason = public.court_operations_resource_block_payload_text(
          v_payload, 'reason', reason
        ),
        operator_notes = public.court_operations_resource_block_payload_text(
          v_payload, 'operatorNotes', operator_notes
        ),
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE resource_block_id = p_resource_block_id
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
        'resourceBlockId', p_resource_block_id,
        'physicalCourtId', p_physical_court_id,
        'capacityPreserved', true,
        'replay', false
      );
    WHEN exclusion_violation OR unique_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'FOREIGN_RESERVATION_CONFLICT',
        'stage', 'capacity',
        'resourceBlockId', p_resource_block_id,
        'capacityPreserved', true,
        'replay', false
      );
  END;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'resourceBlock', public.court_operations_resource_block_serialize(v_row),
    'resourceBlockId', v_row.resource_block_id,
    'reservationId', v_reservation_id,
    'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
    'physicalCourtId', v_row.physical_court_id,
    'replay', false
  );

  INSERT INTO public.court_operations_resource_block_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, resource_block_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'reschedule', v_fingerprint, 'succeeded',
    v_result, p_resource_block_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_resource_block_commands
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
-- RPC 3: transfer_court (same resource_block_id preserved)
-- Reserve the target first, then release the source.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_resource_block_transfer_court(
  p_tenant_id text,
  p_resource_block_id uuid,
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
  v_existing public.court_operations_resource_block_commands%ROWTYPE;
  v_row public.court_operations_resource_blocks%ROWTYPE;
  v_old_court uuid;
  v_reserve jsonb;
  v_reservation_id uuid;
  v_released uuid[];
  v_owner_type text;
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_resource_block_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_resource_block_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_RESOURCE_BLOCK_ID');
  END IF;
  IF p_new_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;

  v_fingerprint := public.court_operations_resource_block_fingerprint(
    'transfer',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'resourceBlockId', p_resource_block_id,
      'newPhysicalCourtId', p_new_physical_court_id,
      'expectedVersion', p_expected_version
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_resource_block_commands
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
  FROM public.court_operations_resource_blocks
  WHERE resource_block_id = p_resource_block_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RESOURCE_BLOCK_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, v_row.club_id);
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
    RETURN jsonb_build_object('ok', false, 'code', 'RESOURCE_BLOCK_CANCELLED');
  END IF;

  v_old_court := v_row.physical_court_id;
  v_owner_type := public.court_operations_resource_block_owner_type(v_row.block_type);

  IF v_old_court = p_new_physical_court_id THEN
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'noop', true,
      'resourceBlock', public.court_operations_resource_block_serialize(v_row),
      'resourceBlockId', v_row.resource_block_id,
      'reservationId', v_row.reservation_id,
      'physicalCourtId', v_row.physical_court_id,
      'replay', false
    );
    INSERT INTO public.court_operations_resource_block_commands (
      tenant_id, request_id, operation, payload_fingerprint, status,
      result, resource_block_id, reservation_ids
    ) VALUES (
      p_tenant_id, v_request_id, 'transfer', v_fingerprint, 'succeeded',
      v_result, p_resource_block_id,
      CASE
        WHEN v_row.reservation_id IS NULL THEN '{}'::uuid[]
        ELSE ARRAY[v_row.reservation_id]
      END
    );
    RETURN v_result;
  END IF;

  v_access := public.court_resource_reservation_assert_access(
    p_tenant_id, v_row.club_id, ARRAY[p_new_physical_court_id]
  );
  IF NOT coalesce((v_access->>'ok')::boolean, false) THEN
    RETURN v_access || jsonb_build_object(
      'ok', false,
      'stage', 'capacity',
      'resourceBlockId', p_resource_block_id,
      'capacityPreserved', true,
      'replay', false
    );
  END IF;

  v_reserve := public.court_resource_reserve_core(
    p_tenant_id,
    v_row.club_id,
    ARRAY[p_new_physical_court_id],
    v_owner_type,
    p_resource_block_id::text,
    'resource_block',
    v_row.starts_at,
    v_row.ends_at,
    v_request_id,
    v_actor
  );
  IF NOT coalesce((v_reserve->>'ok')::boolean, false) THEN
    RETURN v_reserve || jsonb_build_object(
      'ok', false,
      'stage', 'capacity',
      'resourceBlockId', p_resource_block_id,
      'physicalCourtId', v_old_court,
      'capacityPreserved', true,
      'replay', false
    );
  END IF;

  v_reservation_id := (v_reserve->'reservationIds'->>0)::uuid;
  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'COURT_OPERATIONS_RESOURCE_BLOCK_TRANSFER_RESERVATION_MISSING block %',
      p_resource_block_id;
  END IF;

  v_released := public.court_operations_resource_block_release_own_capacity(
    p_tenant_id, p_resource_block_id, v_owner_type,
    'resource_block_transfer_court', v_actor, v_reservation_id
  );

  UPDATE public.court_operations_resource_blocks
  SET physical_court_id = p_new_physical_court_id,
      reservation_id = v_reservation_id,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
  WHERE resource_block_id = p_resource_block_id
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'noop', false,
    'resourceBlock', public.court_operations_resource_block_serialize(v_row),
    'resourceBlockId', v_row.resource_block_id,
    'reservationId', v_reservation_id,
    'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
    'physicalCourtId', v_row.physical_court_id,
    'previousPhysicalCourtId', v_old_court,
    'replay', false
  );

  INSERT INTO public.court_operations_resource_block_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, resource_block_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'transfer', v_fingerprint, 'succeeded',
    v_result, p_resource_block_id, ARRAY[v_reservation_id]
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_resource_block_commands
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
CREATE FUNCTION public.court_operations_resource_block_cancel(
  p_tenant_id text,
  p_resource_block_id uuid,
  p_request_id text,
  p_release_reason text DEFAULT 'resource_block_cancelled'
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
  v_existing public.court_operations_resource_block_commands%ROWTYPE;
  v_row public.court_operations_resource_blocks%ROWTYPE;
  v_released uuid[];
  v_owner_type text;
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  v_tenant := public.court_operations_resource_block_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant;
  END IF;

  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_REQUEST_ID');
  END IF;
  IF p_resource_block_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_RESOURCE_BLOCK_ID');
  END IF;

  v_reason := coalesce(
    nullif(btrim(coalesce(p_release_reason, '')), ''),
    'resource_block_cancelled'
  );

  v_fingerprint := public.court_operations_resource_block_fingerprint(
    'cancel',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'resourceBlockId', p_resource_block_id,
      'releaseReason', v_reason
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_resource_block_commands
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
  FROM public.court_operations_resource_blocks
  WHERE resource_block_id = p_resource_block_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RESOURCE_BLOCK_NOT_FOUND');
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;

  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope;
  END IF;

  v_owner_type := public.court_operations_resource_block_owner_type(v_row.block_type);
  v_released := public.court_operations_resource_block_release_own_capacity(
    p_tenant_id, p_resource_block_id, v_owner_type, v_reason, v_actor, NULL
  );

  IF v_row.lifecycle_status = 'cancelled' THEN
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'alreadyCancelled', true,
      'resourceBlock', public.court_operations_resource_block_serialize(v_row),
      'resourceBlockId', v_row.resource_block_id,
      'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
      'replay', false
    );
  ELSE
    UPDATE public.court_operations_resource_blocks
    SET lifecycle_status = 'cancelled',
        cancelled_at = now(),
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    WHERE resource_block_id = p_resource_block_id
    RETURNING * INTO v_row;

    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'alreadyCancelled', false,
      'resourceBlock', public.court_operations_resource_block_serialize(v_row),
      'resourceBlockId', v_row.resource_block_id,
      'releasedReservationIds', to_jsonb(coalesce(v_released, '{}'::uuid[])),
      'replay', false
    );
  END IF;

  INSERT INTO public.court_operations_resource_block_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, resource_block_id, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'cancel', v_fingerprint, 'succeeded',
    v_result, p_resource_block_id, coalesce(v_released, '{}'::uuid[])
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_operations_resource_block_commands
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
-- RPC 5: get
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_resource_block_get(
  p_tenant_id text,
  p_resource_block_id uuid
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
  v_row public.court_operations_resource_blocks%ROWTYPE;
BEGIN
  v_tenant := public.court_operations_resource_block_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_tenant->>'ok')::boolean, false) THEN
    RETURN v_tenant || jsonb_build_object('resourceBlock', NULL);
  END IF;
  IF p_resource_block_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'MISSING_RESOURCE_BLOCK_ID', 'resourceBlock', NULL
    );
  END IF;

  SELECT * INTO v_row
  FROM public.court_operations_resource_blocks
  WHERE resource_block_id = p_resource_block_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'RESOURCE_BLOCK_NOT_FOUND', 'resourceBlock', NULL
    );
  END IF;
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'TENANT_MISMATCH', 'resourceBlock', NULL
    );
  END IF;

  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, v_row.club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope || jsonb_build_object('resourceBlock', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'resourceBlock', public.court_operations_resource_block_serialize(v_row)
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 6: list
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_resource_block_list(
  p_tenant_id text,
  p_club_id text,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_physical_court_ids uuid[] DEFAULT NULL,
  p_block_types text[] DEFAULT NULL,
  p_include_cancelled boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_scope jsonb;
  v_types text[];
  v_court_ids uuid[];
  v_rows jsonb := '[]'::jsonb;
BEGIN
  v_scope := public.court_operations_resource_block_assert_scope(p_tenant_id, p_club_id);
  IF NOT coalesce((v_scope->>'ok')::boolean, false) THEN
    RETURN v_scope || jsonb_build_object('resourceBlocks', '[]'::jsonb);
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to <= p_from THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_TIME_RANGE', 'resourceBlocks', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
    array_agg(DISTINCT upper(btrim(s))) FILTER (WHERE nullif(btrim(s), '') IS NOT NULL),
    NULL
  )
  INTO v_types
  FROM unnest(coalesce(p_block_types, '{}'::text[])) AS s;

  IF v_types IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(v_types) AS s
    WHERE s NOT IN ('MAINTENANCE', 'OPERATIONAL_BLOCK')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'INVALID_BLOCK_TYPE', 'resourceBlocks', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
    array_agg(DISTINCT c) FILTER (WHERE c IS NOT NULL),
    NULL
  )
  INTO v_court_ids
  FROM unnest(coalesce(p_physical_court_ids, '{}'::uuid[])) AS c;

  SELECT coalesce(jsonb_agg(payload ORDER BY starts_at, physical_court_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT public.court_operations_resource_block_serialize(b) AS payload,
           b.starts_at AS starts_at,
           b.physical_court_id AS physical_court_id
    FROM public.court_operations_resource_blocks b
    WHERE b.tenant_id = p_tenant_id
      AND b.club_id = btrim(p_club_id)
      AND (p_from IS NULL OR b.ends_at > p_from)
      AND (p_to IS NULL OR b.starts_at < p_to)
      AND (v_court_ids IS NULL OR b.physical_court_id = ANY (v_court_ids))
      AND (v_types IS NULL OR b.block_type = ANY (v_types))
      AND (
        coalesce(p_include_cancelled, false)
        OR b.lifecycle_status <> 'cancelled'
      )
  ) listed;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'resourceBlocks', v_rows,
    'identityAuthority', 'physicalCourtId'
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- Grants. Internal helpers stay owner-only. Public RPCs are authenticated-only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.court_operations_resource_block_utc_text(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_payload_text(jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_fingerprint(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_owner_type(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_serialize(
  public.court_operations_resource_blocks
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_assert_tenant(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_assert_scope(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_release_own_capacity(
  text, uuid, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.court_operations_resource_block_create(
  text, text, uuid, timestamptz, timestamptz, text, jsonb
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_reschedule(
  text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_transfer_court(
  text, uuid, uuid, int, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_cancel(
  text, uuid, text, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_get(text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_resource_block_list(
  text, text, timestamptz, timestamptz, uuid[], text[], boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_create(
  text, text, uuid, timestamptz, timestamptz, text, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_reschedule(
  text, uuid, uuid, timestamptz, timestamptz, int, text, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_transfer_court(
  text, uuid, uuid, int, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_cancel(
  text, uuid, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_get(text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_resource_block_list(
  text, text, timestamptz, timestamptz, uuid[], text[], boolean
) TO authenticated;

COMMIT;

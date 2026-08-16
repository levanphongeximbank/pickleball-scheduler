-- Court Operations live resource runtime 01. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
-- LIVE_RESOURCE_RUNTIME_MIGRATION_VERSION=20260816200000
--
-- Three-authority separation:
--   * Capacity SSOT stays public.court_resource_reservations (Phase 3B).
--   * Durable ops blocks stay public.court_operations_resource_blocks (Batch 4).
--   * Live NOW (occupancy + operational NOW + resource sessions) lives here.
--
-- INVARIANT: no live RPC may INSERT/UPDATE/DELETE court_resource_reservations.
-- Ending a session never releases capacity. Setting operational state never
-- creates resource blocks or reservations.
--
-- Identity authority is physicalCourtId (uuid).
-- Does not create, alter or drop any Phase 3A / 3B / D4 / Batch1–6 object.
-- SECURITY DEFINER owner: migration/table owner. Authorization is fail-closed.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Resource sessions (physical use). Created before live_states so the active
-- session FK can reference this table.
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_resource_sessions (
  resource_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  source_type text NOT NULL
    CHECK (source_type IN ('booking', 'daily_play', 'competition', 'operations')),
  source_id text NOT NULL CHECK (btrim(source_id) <> ''),
  -- Opaque capacity reference only. NOT a required FK to reservations.
  reservation_ref text NULL,
  status text NOT NULL CHECK (status IN ('active', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  CONSTRAINT court_operations_resource_sessions_ended_audit_check CHECK (
    (status = 'ended' AND ended_at IS NOT NULL)
    OR (status = 'active' AND ended_at IS NULL)
  ),
  CONSTRAINT court_operations_resource_sessions_request_uniq
    UNIQUE (tenant_id, request_id)
);

-- One active session per physical court within a tenant.
CREATE UNIQUE INDEX court_operations_resource_sessions_one_active_per_court_idx
  ON public.court_operations_resource_sessions (tenant_id, physical_court_id)
  WHERE status = 'active';

CREATE INDEX court_operations_resource_sessions_tenant_court_idx
  ON public.court_operations_resource_sessions (tenant_id, physical_court_id, started_at);
CREATE INDEX court_operations_resource_sessions_status_idx
  ON public.court_operations_resource_sessions (tenant_id, status);
CREATE INDEX court_operations_resource_sessions_source_idx
  ON public.court_operations_resource_sessions (tenant_id, source_type, source_id);

-- ---------------------------------------------------------------------------
-- Live court state (NOW). PK = (tenant_id, physical_court_id).
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_court_live_states (
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  occupancy_state text NOT NULL DEFAULT 'free'
    CHECK (occupancy_state IN ('free', 'occupied')),
  operational_state text NOT NULL DEFAULT 'AVAILABLE'
    CHECK (operational_state IN (
      'AVAILABLE', 'UNAVAILABLE_NOW', 'OUT_OF_SERVICE_NOW'
    )),
  active_resource_session_id uuid NULL
    REFERENCES public.court_operations_resource_sessions(resource_session_id)
    ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, physical_court_id)
);

CREATE INDEX court_operations_court_live_states_occupancy_idx
  ON public.court_operations_court_live_states (tenant_id, occupancy_state);
CREATE INDEX court_operations_court_live_states_operational_idx
  ON public.court_operations_court_live_states (tenant_id, operational_state);

-- ---------------------------------------------------------------------------
-- Idempotency ledger. Separate from Phase 3B / Batch 4 ledgers.
-- ---------------------------------------------------------------------------
CREATE TABLE public.court_operations_live_runtime_commands (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  operation text NOT NULL
    CHECK (operation IN ('begin', 'end', 'set_operational_state')),
  payload_fingerprint text NOT NULL CHECK (btrim(payload_fingerprint) <> ''),
  status text NOT NULL CHECK (status IN ('succeeded', 'conflict', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(result) = 'object'),
  resource_session_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_operations_live_runtime_commands_request_uniq
    UNIQUE (tenant_id, request_id)
);

CREATE INDEX court_operations_live_runtime_commands_created_idx
  ON public.court_operations_live_runtime_commands (tenant_id, created_at);

-- ---------------------------------------------------------------------------
-- Security: RLS forced, read-only policy, zero client table grants.
-- All access is through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.court_operations_resource_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_resource_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_court_live_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_court_live_states FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_live_runtime_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_operations_live_runtime_commands FORCE ROW LEVEL SECURITY;

CREATE POLICY court_operations_resource_sessions_select
ON public.court_operations_resource_sessions FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);
CREATE POLICY court_operations_court_live_states_select
ON public.court_operations_court_live_states FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);
CREATE POLICY court_operations_live_runtime_commands_select
ON public.court_operations_live_runtime_commands FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);

REVOKE ALL ON public.court_operations_resource_sessions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_operations_court_live_states
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_operations_live_runtime_commands
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.court_operations_live_utc_text(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE
    WHEN p_ts IS NULL THEN NULL
    ELSE to_char(p_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  END;
$cr$;

CREATE FUNCTION public.court_operations_live_fingerprint(
  p_operation text,
  p_payload jsonb
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT encode(
    digest(
      convert_to(
        jsonb_build_object(
          'package', 'court_operations_live_resource_runtime_01',
          'operation', coalesce(p_operation, ''),
          'payload', coalesce(p_payload, '{}'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$cr$;

CREATE FUNCTION public.court_operations_live_normalize_source_type(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE lower(btrim(coalesce(p_value, '')))
    WHEN 'booking' THEN 'booking'
    WHEN 'daily_play' THEN 'daily_play'
    WHEN 'daily-play' THEN 'daily_play'
    WHEN 'competition' THEN 'competition'
    WHEN 'operations' THEN 'operations'
    ELSE NULL
  END;
$cr$;

CREATE FUNCTION public.court_operations_live_normalize_operational_state(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE upper(btrim(coalesce(p_value, '')))
    WHEN 'AVAILABLE' THEN 'AVAILABLE'
    WHEN 'UNAVAILABLE_NOW' THEN 'UNAVAILABLE_NOW'
    WHEN 'LOCKED' THEN 'UNAVAILABLE_NOW'
    WHEN 'UNAVAILABLE' THEN 'UNAVAILABLE_NOW'
    WHEN 'OUT_OF_SERVICE_NOW' THEN 'OUT_OF_SERVICE_NOW'
    WHEN 'MAINTENANCE' THEN 'OUT_OF_SERVICE_NOW'
    WHEN 'OUT_OF_SERVICE' THEN 'OUT_OF_SERVICE_NOW'
    ELSE NULL
  END;
$cr$;

CREATE FUNCTION public.court_operations_live_serialize_session(
  p_row public.court_operations_resource_sessions
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE
    WHEN p_row.resource_session_id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'resourceSessionId', p_row.resource_session_id,
      'tenantId', p_row.tenant_id,
      'physicalCourtId', p_row.physical_court_id,
      'sourceType', p_row.source_type,
      'sourceId', p_row.source_id,
      'reservationRef', p_row.reservation_ref,
      'status', p_row.status,
      'startedAt', public.court_operations_live_utc_text(p_row.started_at),
      'endedAt', public.court_operations_live_utc_text(p_row.ended_at),
      'createdBy', p_row.created_by,
      'identityAuthority', 'physicalCourtId'
    )
  END;
$cr$;

CREATE FUNCTION public.court_operations_live_serialize_state(
  p_state public.court_operations_court_live_states,
  p_session public.court_operations_resource_sessions DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_session public.court_operations_resource_sessions%ROWTYPE;
  v_active jsonb;
BEGIN
  IF p_session.resource_session_id IS NOT NULL THEN
    v_session := p_session;
  ELSIF p_state.active_resource_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.court_operations_resource_sessions s
    WHERE s.resource_session_id = p_state.active_resource_session_id;
  END IF;

  IF v_session.resource_session_id IS NOT NULL THEN
    v_active := public.court_operations_live_serialize_session(v_session);
  ELSE
    v_active := NULL;
  END IF;

  RETURN jsonb_build_object(
    'tenantId', p_state.tenant_id,
    'physicalCourtId', p_state.physical_court_id,
    'occupancyState', p_state.occupancy_state,
    'operationalState', p_state.operational_state,
    'activeResourceSessionId', p_state.active_resource_session_id,
    'activeSession', v_active,
    'activeResourceBlock', NULL,
    'version', p_state.version,
    'updatedAt', public.court_operations_live_utc_text(p_state.updated_at),
    'reason', coalesce(p_state.reason, ''),
    'identityAuthority', 'physicalCourtId'
  );
END
$cr$;

-- Tenant-only guard. Fail-closed. No venueId fallback.
CREATE FUNCTION public.court_operations_live_assert_tenant(p_tenant_id text)
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
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
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

CREATE FUNCTION public.court_operations_live_assert_court(
  p_tenant_id text,
  p_physical_court_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_court_tenant text;
BEGIN
  IF p_physical_court_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNKNOWN_COURT');
  END IF;
  SELECT c.tenant_id INTO v_court_tenant
  FROM public.court_resource_physical_courts c
  WHERE c.physical_court_id = p_physical_court_id;
  IF v_court_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'UNKNOWN_COURT', 'physicalCourtId', p_physical_court_id
    );
  END IF;
  IF v_court_tenant IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'CROSS_TENANT_COURT', 'physicalCourtId', p_physical_court_id
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

CREATE FUNCTION public.court_operations_live_ensure_state(
  p_tenant_id text,
  p_physical_court_id uuid
)
RETURNS public.court_operations_court_live_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_row public.court_operations_court_live_states%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.court_operations_court_live_states
  WHERE tenant_id = p_tenant_id AND physical_court_id = p_physical_court_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.court_operations_court_live_states (
    tenant_id, physical_court_id, occupancy_state, operational_state,
    active_resource_session_id, reason, version, updated_at, updated_by
  ) VALUES (
    p_tenant_id, p_physical_court_id, 'free', 'AVAILABLE',
    NULL, '', 1, now(), NULL
  )
  ON CONFLICT (tenant_id, physical_court_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.court_operations_court_live_states
  WHERE tenant_id = p_tenant_id AND physical_court_id = p_physical_court_id
  FOR UPDATE;
  RETURN v_row;
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 1: begin resource session
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_live_begin_resource_session(
  p_tenant_id text,
  p_physical_court_id uuid,
  p_source_type text,
  p_source_id text,
  p_reservation_ref text,
  p_request_id text,
  p_actor_id uuid,
  p_operations_authorized boolean,
  p_capacity_claim_valid boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_auth jsonb;
  v_court jsonb;
  v_actor uuid;
  v_request_id text;
  v_source_type text;
  v_source_id text;
  v_reservation_ref text;
  v_fingerprint text;
  v_existing public.court_operations_live_runtime_commands%ROWTYPE;
  v_state public.court_operations_court_live_states%ROWTYPE;
  v_active public.court_operations_resource_sessions%ROWTYPE;
  v_session public.court_operations_resource_sessions%ROWTYPE;
  v_result jsonb;
BEGIN
  v_auth := public.court_operations_live_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_auth->>'ok')::boolean, false) THEN
    RETURN v_auth;
  END IF;

  v_actor := auth.uid();
  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_ID_REQUIRED');
  END IF;

  v_source_type := public.court_operations_live_normalize_source_type(p_source_type);
  v_source_id := nullif(btrim(coalesce(p_source_id, '')), '');
  IF v_source_type IS NULL OR v_source_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'sourceType and sourceId are required.'
    );
  END IF;

  v_reservation_ref := nullif(btrim(coalesce(p_reservation_ref, '')), '');

  v_fingerprint := public.court_operations_live_fingerprint(
    'begin',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'physicalCourtId', p_physical_court_id,
      'sourceType', v_source_type,
      'sourceId', v_source_id,
      'reservationRef', v_reservation_ref,
      'operationsAuthorized', coalesce(p_operations_authorized, false)
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_live_runtime_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'begin'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  v_court := public.court_operations_live_assert_court(p_tenant_id, p_physical_court_id);
  IF NOT coalesce((v_court->>'ok')::boolean, false) THEN
    RETURN v_court;
  END IF;

  v_state := public.court_operations_live_ensure_state(p_tenant_id, p_physical_court_id);

  IF v_state.operational_state IS DISTINCT FROM 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'OPERATIONAL_STATE_DENIES_USE',
      'message', 'Current operational state does not allow starting a live session.',
      'operationalState', v_state.operational_state
    );
  END IF;

  IF v_source_type = 'operations' THEN
    IF coalesce(p_operations_authorized, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'OPERATIONS_POLICY_REQUIRED',
        'message',
          'Operations live use requires explicit Court Operations authorization.'
      );
    END IF;
  ELSE
    -- Prefer explicit capacity-claim flag. Do not invent owner-mapping reads
    -- against court_resource_reservations (avoids coupling / mapping bugs).
    IF coalesce(p_capacity_claim_valid, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'CAPACITY_CLAIM_REQUIRED',
        'message',
          'beginResourceSession requires a valid capacity claim for this source.'
      );
    END IF;
  END IF;

  IF v_state.active_resource_session_id IS NOT NULL THEN
    SELECT * INTO v_active
    FROM public.court_operations_resource_sessions s
    WHERE s.resource_session_id = v_state.active_resource_session_id;

    IF v_active.status = 'active'
       AND v_active.source_type = v_source_type
       AND v_active.source_id = v_source_id THEN
      v_result := jsonb_build_object(
        'ok', true,
        'code', 'OK',
        'replay', true,
        'liveState', public.court_operations_live_serialize_state(v_state, v_active),
        'resourceSession', public.court_operations_live_serialize_session(v_active),
        'reservationWriteCount', 0
      );
      INSERT INTO public.court_operations_live_runtime_commands (
        tenant_id, request_id, operation, payload_fingerprint, status, result,
        resource_session_id
      ) VALUES (
        p_tenant_id, v_request_id, 'begin', v_fingerprint, 'succeeded', v_result,
        v_active.resource_session_id
      );
      RETURN v_result;
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SESSION_ACTIVE_CONFLICT',
      'message', 'Physical court already has an active resource session.',
      'activeResourceSessionId', v_state.active_resource_session_id
    );
  END IF;

  -- Audit actor is always auth.uid() (FK-safe). p_actor_id is accepted for
  -- API compatibility with the JS contract but is not trusted for writes.
  INSERT INTO public.court_operations_resource_sessions (
    tenant_id, physical_court_id, source_type, source_id, reservation_ref,
    status, started_at, ended_at, created_by, request_id
  ) VALUES (
    p_tenant_id, p_physical_court_id, v_source_type, v_source_id, v_reservation_ref,
    'active', now(), NULL, v_actor, v_request_id
  )
  RETURNING * INTO v_session;

  UPDATE public.court_operations_court_live_states
  SET occupancy_state = 'occupied',
      active_resource_session_id = v_session.resource_session_id,
      version = version + 1,
      updated_at = now(),
      updated_by = v_actor
  WHERE tenant_id = p_tenant_id AND physical_court_id = p_physical_court_id
  RETURNING * INTO v_state;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'liveState', public.court_operations_live_serialize_state(v_state, v_session),
    'resourceSession', public.court_operations_live_serialize_session(v_session),
    'reservationWriteCount', 0
  );

  INSERT INTO public.court_operations_live_runtime_commands (
    tenant_id, request_id, operation, payload_fingerprint, status, result,
    resource_session_id
  ) VALUES (
    p_tenant_id, v_request_id, 'begin', v_fingerprint, 'succeeded', v_result,
    v_session.resource_session_id
  );

  RETURN v_result;
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 2: end resource session (idempotent; never releases reservations)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_live_end_resource_session(
  p_tenant_id text,
  p_physical_court_id uuid,
  p_resource_session_id uuid,
  p_source_type text,
  p_source_id text,
  p_request_id text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_auth jsonb;
  v_actor uuid;
  v_request_id text;
  v_source_type text;
  v_source_id text;
  v_fingerprint text;
  v_existing public.court_operations_live_runtime_commands%ROWTYPE;
  v_session public.court_operations_resource_sessions%ROWTYPE;
  v_state public.court_operations_court_live_states%ROWTYPE;
  v_result jsonb;
BEGIN
  v_auth := public.court_operations_live_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_auth->>'ok')::boolean, false) THEN
    RETURN v_auth;
  END IF;

  v_actor := auth.uid();
  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_ID_REQUIRED');
  END IF;

  v_source_type := public.court_operations_live_normalize_source_type(p_source_type);
  v_source_id := nullif(btrim(coalesce(p_source_id, '')), '');

  v_fingerprint := public.court_operations_live_fingerprint(
    'end',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'physicalCourtId', p_physical_court_id,
      'resourceSessionId', p_resource_session_id,
      'sourceType', v_source_type,
      'sourceId', v_source_id
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_live_runtime_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'end'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  IF p_resource_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.court_operations_resource_sessions s
    WHERE s.resource_session_id = p_resource_session_id
    FOR UPDATE;
  ELSIF p_physical_court_id IS NOT NULL THEN
    v_state := public.court_operations_live_ensure_state(p_tenant_id, p_physical_court_id);
    IF v_state.active_resource_session_id IS NOT NULL THEN
      SELECT * INTO v_session
      FROM public.court_operations_resource_sessions s
      WHERE s.resource_session_id = v_state.active_resource_session_id
      FOR UPDATE;
    END IF;
    IF v_session.resource_session_id IS NULL
       AND v_source_type IS NOT NULL AND v_source_id IS NOT NULL THEN
      SELECT * INTO v_session
      FROM public.court_operations_resource_sessions s
      WHERE s.tenant_id = p_tenant_id
        AND s.physical_court_id = p_physical_court_id
        AND s.source_type = v_source_type
        AND s.source_id = v_source_id
        AND s.status = 'active'
      FOR UPDATE;
    END IF;
  END IF;

  IF v_session.resource_session_id IS NULL OR v_session.tenant_id IS DISTINCT FROM p_tenant_id THEN
    IF p_physical_court_id IS NOT NULL THEN
      v_state := public.court_operations_live_ensure_state(p_tenant_id, p_physical_court_id);
    END IF;
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'replay', true,
      'liveState', CASE
        WHEN v_state.physical_court_id IS NOT NULL
          THEN public.court_operations_live_serialize_state(v_state)
        ELSE NULL
      END,
      'resourceSession', NULL,
      'reservationWriteCount', 0,
      'reservationReleased', false
    );
    INSERT INTO public.court_operations_live_runtime_commands (
      tenant_id, request_id, operation, payload_fingerprint, status, result
    ) VALUES (
      p_tenant_id, v_request_id, 'end', v_fingerprint, 'succeeded', v_result
    );
    RETURN v_result;
  END IF;

  IF v_source_type IS NOT NULL AND v_source_id IS NOT NULL THEN
    IF v_session.source_type IS DISTINCT FROM v_source_type
       OR v_session.source_id IS DISTINCT FROM v_source_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'SESSION_SOURCE_MISMATCH',
        'message', 'End session source does not own the active session.'
      );
    END IF;
  END IF;

  IF v_session.status = 'ended' THEN
    v_state := public.court_operations_live_ensure_state(
      p_tenant_id, v_session.physical_court_id
    );
    v_result := jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'replay', true,
      'liveState', public.court_operations_live_serialize_state(v_state),
      'resourceSession', public.court_operations_live_serialize_session(v_session),
      'reservationWriteCount', 0,
      'reservationReleased', false
    );
    INSERT INTO public.court_operations_live_runtime_commands (
      tenant_id, request_id, operation, payload_fingerprint, status, result,
      resource_session_id
    ) VALUES (
      p_tenant_id, v_request_id, 'end', v_fingerprint, 'succeeded', v_result,
      v_session.resource_session_id
    );
    RETURN v_result;
  END IF;

  UPDATE public.court_operations_resource_sessions
  SET status = 'ended', ended_at = now()
  WHERE resource_session_id = v_session.resource_session_id
  RETURNING * INTO v_session;

  UPDATE public.court_operations_court_live_states
  SET active_resource_session_id = NULL,
      occupancy_state = 'free',
      version = version + 1,
      updated_at = now(),
      updated_by = v_actor
  WHERE tenant_id = p_tenant_id
    AND physical_court_id = v_session.physical_court_id
    AND active_resource_session_id = v_session.resource_session_id
  RETURNING * INTO v_state;

  IF v_state.physical_court_id IS NULL THEN
    v_state := public.court_operations_live_ensure_state(
      p_tenant_id, v_session.physical_court_id
    );
  END IF;

  -- MUST NOT release reservations. Capacity remains owned by capacity SSOT.
  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'liveState', public.court_operations_live_serialize_state(v_state),
    'resourceSession', public.court_operations_live_serialize_session(v_session),
    'reservationWriteCount', 0,
    'reservationReleased', false
  );

  INSERT INTO public.court_operations_live_runtime_commands (
    tenant_id, request_id, operation, payload_fingerprint, status, result,
    resource_session_id
  ) VALUES (
    p_tenant_id, v_request_id, 'end', v_fingerprint, 'succeeded', v_result,
    v_session.resource_session_id
  );

  RETURN v_result;
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 3: set operational state (NOW only; no blocks / reservations)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_live_set_operational_state(
  p_tenant_id text,
  p_physical_court_id uuid,
  p_operational_state text,
  p_reason text,
  p_request_id text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_auth jsonb;
  v_court jsonb;
  v_actor uuid;
  v_request_id text;
  v_operational_state text;
  v_reason text;
  v_fingerprint text;
  v_existing public.court_operations_live_runtime_commands%ROWTYPE;
  v_state public.court_operations_court_live_states%ROWTYPE;
  v_result jsonb;
BEGIN
  v_auth := public.court_operations_live_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_auth->>'ok')::boolean, false) THEN
    RETURN v_auth;
  END IF;

  v_actor := auth.uid();
  v_request_id := nullif(btrim(coalesce(p_request_id, '')), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_ID_REQUIRED');
  END IF;

  v_operational_state :=
    public.court_operations_live_normalize_operational_state(p_operational_state);
  IF v_operational_state IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPERATIONAL_STATE');
  END IF;

  v_reason := coalesce(p_reason, '');

  v_fingerprint := public.court_operations_live_fingerprint(
    'set_operational_state',
    jsonb_build_object(
      'tenantId', p_tenant_id,
      'physicalCourtId', p_physical_court_id,
      'operationalState', v_operational_state,
      'reason', v_reason
    )
  );

  SELECT * INTO v_existing
  FROM public.court_operations_live_runtime_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.operation IS DISTINCT FROM 'set_operational_state'
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  v_court := public.court_operations_live_assert_court(p_tenant_id, p_physical_court_id);
  IF NOT coalesce((v_court->>'ok')::boolean, false) THEN
    RETURN v_court;
  END IF;

  v_state := public.court_operations_live_ensure_state(p_tenant_id, p_physical_court_id);

  UPDATE public.court_operations_court_live_states
  SET operational_state = v_operational_state,
      reason = v_reason,
      version = version + 1,
      updated_at = now(),
      updated_by = v_actor
  WHERE tenant_id = p_tenant_id AND physical_court_id = p_physical_court_id
  RETURNING * INTO v_state;

  -- MUST NOT create resource blocks or reservations.
  v_result := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'liveState', public.court_operations_live_serialize_state(v_state),
    'resourceBlockCreated', false,
    'reservationCreated', false,
    'reservationWriteCount', 0
  );

  INSERT INTO public.court_operations_live_runtime_commands (
    tenant_id, request_id, operation, payload_fingerprint, status, result
  ) VALUES (
    p_tenant_id, v_request_id, 'set_operational_state', v_fingerprint,
    'succeeded', v_result
  );

  RETURN v_result;
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 4: get court live state
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_live_get_court_state(
  p_tenant_id text,
  p_physical_court_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_auth jsonb;
  v_court jsonb;
  v_state public.court_operations_court_live_states%ROWTYPE;
BEGIN
  v_auth := public.court_operations_live_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_auth->>'ok')::boolean, false) THEN
    RETURN v_auth;
  END IF;

  v_court := public.court_operations_live_assert_court(p_tenant_id, p_physical_court_id);
  IF NOT coalesce((v_court->>'ok')::boolean, false) THEN
    RETURN v_court;
  END IF;

  SELECT * INTO v_state
  FROM public.court_operations_court_live_states
  WHERE tenant_id = p_tenant_id AND physical_court_id = p_physical_court_id;

  -- Read path is non-mutating: synthesize free/AVAILABLE when no row yet.
  IF NOT FOUND THEN
    v_state.tenant_id := p_tenant_id;
    v_state.physical_court_id := p_physical_court_id;
    v_state.occupancy_state := 'free';
    v_state.operational_state := 'AVAILABLE';
    v_state.active_resource_session_id := NULL;
    v_state.reason := '';
    v_state.version := 1;
    v_state.updated_at := now();
    v_state.updated_by := NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'liveState', public.court_operations_live_serialize_state(v_state)
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- RPC 5: list resource sessions
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.court_operations_live_list_resource_sessions(
  p_tenant_id text,
  p_physical_court_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_auth jsonb;
  v_status text;
  v_sessions jsonb;
BEGIN
  v_auth := public.court_operations_live_assert_tenant(p_tenant_id);
  IF NOT coalesce((v_auth->>'ok')::boolean, false) THEN
    RETURN v_auth || jsonb_build_object('sessions', '[]'::jsonb);
  END IF;

  v_status := nullif(lower(btrim(coalesce(p_status, ''))), '');
  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'ended') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'sessions', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      public.court_operations_live_serialize_session(s)
      ORDER BY s.started_at DESC, s.resource_session_id
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.court_operations_resource_sessions s
  WHERE s.tenant_id = p_tenant_id
    AND (p_physical_court_id IS NULL OR s.physical_court_id = p_physical_court_id)
    AND (v_status IS NULL OR s.status = v_status);

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'sessions', v_sessions
  );
END
$cr$;

-- ---------------------------------------------------------------------------
-- Grants. Internal helpers stay owner-only. Public RPCs are authenticated-only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.court_operations_live_utc_text(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_fingerprint(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_normalize_source_type(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_normalize_operational_state(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_serialize_session(
  public.court_operations_resource_sessions
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_serialize_state(
  public.court_operations_court_live_states,
  public.court_operations_resource_sessions
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_assert_tenant(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_assert_court(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_operations_live_ensure_state(text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.court_operations_live_begin_resource_session(
  text, uuid, text, text, text, text, uuid, boolean, boolean
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_live_end_resource_session(
  text, uuid, uuid, text, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_live_set_operational_state(
  text, uuid, text, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_live_get_court_state(text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_operations_live_list_resource_sessions(
  text, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.court_operations_live_begin_resource_session(
  text, uuid, text, text, text, text, uuid, boolean, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_live_end_resource_session(
  text, uuid, uuid, text, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_live_set_operational_state(
  text, uuid, text, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_live_get_court_state(text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_operations_live_list_resource_sessions(
  text, uuid, text
) TO authenticated;

COMMIT;

SELECT 'APPLY_OK' AS check_item,
  'court_operations_live_resource_runtime_01' AS value, true AS ok;
SELECT 'STAGING_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'PRODUCTION_APPLY' AS check_item, 'NO' AS value, true AS ok;
SELECT 'RESERVATION_WRITE_COUNT' AS check_item, 0 AS value, true AS ok;

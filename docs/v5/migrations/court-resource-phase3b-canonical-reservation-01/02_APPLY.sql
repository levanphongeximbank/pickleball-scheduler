-- Court Resource Phase 3B canonical reservation. ADDITIVE. LOCAL AUTHORING ONLY.
-- NOT APPLIED TO STAGING OR PRODUCTION.
-- Does not mutate public.court_reservations or official_tournament_reserve_courts data.
-- SECURITY DEFINER owner: migration/table owner. Authorization is fail-closed in-function.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.court_resource_reservation_cutover (
  cutover_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_reservation_cutover_id_check
    CHECK (cutover_id = 'canonical-reservation-phase3b')
);
INSERT INTO public.court_resource_reservation_cutover (cutover_id, enabled)
VALUES ('canonical-reservation-phase3b', false);

CREATE TABLE public.court_resource_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  club_id text NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  owner_type text NOT NULL
    CHECK (owner_type IN (
      'booking', 'competition', 'daily_play', 'maintenance', 'operations'
    )),
  owner_id text NOT NULL CHECK (btrim(owner_id) <> ''),
  owner_sub_type text NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL
    CHECK (status IN ('active', 'released', 'cancelled', 'expired')),
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  released_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  release_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  expired_at timestamptz NULL,
  CONSTRAINT court_resource_reservations_range_check CHECK (ends_at > starts_at),
  CONSTRAINT court_resource_reservations_release_audit_check CHECK (
    (status = 'active'
      AND released_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL)
    OR (status = 'released' AND released_at IS NOT NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status = 'expired' AND expired_at IS NOT NULL)
  )
);
CREATE INDEX court_resource_reservations_owner_idx
  ON public.court_resource_reservations (tenant_id, owner_type, owner_id, status);
CREATE INDEX court_resource_reservations_court_window_idx
  ON public.court_resource_reservations (tenant_id, physical_court_id, starts_at, ends_at);
CREATE INDEX court_resource_reservations_request_idx
  ON public.court_resource_reservations (tenant_id, request_id);

ALTER TABLE public.court_resource_reservations
  ADD CONSTRAINT court_resource_reservations_active_excl
  EXCLUDE USING gist (
    tenant_id WITH =,
    physical_court_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'active');

CREATE TABLE public.court_resource_reservation_commands (
  command_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  request_id text NOT NULL CHECK (btrim(request_id) <> ''),
  operation text NOT NULL CHECK (operation IN ('reserve', 'release')),
  payload_fingerprint text NOT NULL CHECK (btrim(payload_fingerprint) <> ''),
  status text NOT NULL CHECK (status IN ('succeeded', 'conflict', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(result) = 'object'),
  reservation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_reservation_commands_request_uniq
    UNIQUE (tenant_id, request_id)
);
CREATE INDEX court_resource_reservation_commands_created_idx
  ON public.court_resource_reservation_commands (tenant_id, created_at);

ALTER TABLE public.court_resource_reservation_cutover ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_reservation_cutover FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_reservation_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_reservation_commands FORCE ROW LEVEL SECURITY;

CREATE POLICY court_resource_reservation_cutover_select
ON public.court_resource_reservation_cutover FOR SELECT TO authenticated USING (
  public.is_super_admin() OR true
);
CREATE POLICY court_resource_reservations_select
ON public.court_resource_reservations FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);
CREATE POLICY court_resource_reservation_commands_select
ON public.court_resource_reservation_commands FOR SELECT TO authenticated USING (
  public.is_super_admin() OR tenant_id = public.user_venue_id()
);

REVOKE ALL ON public.court_resource_reservation_cutover FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_resource_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_resource_reservation_commands FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.court_resource_canonical_reservation_cutover_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
  SELECT coalesce((
    SELECT enabled FROM public.court_resource_reservation_cutover
    WHERE cutover_id = 'canonical-reservation-phase3b'
  ), false);
$cr$;

CREATE FUNCTION public.court_resource_set_canonical_reservation_cutover(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  UPDATE public.court_resource_reservation_cutover
  SET enabled = coalesce(p_enabled, false),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE cutover_id = 'canonical-reservation-phase3b';
  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'enabled', public.court_resource_canonical_reservation_cutover_enabled()
  );
END
$cr$;

CREATE FUNCTION public.court_resource_reservation_normalize_court_ids(p_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT coalesce((
    SELECT array_agg(x ORDER BY x)
    FROM (SELECT DISTINCT unnest(p_ids) AS x) s
    WHERE x IS NOT NULL
  ), '{}'::uuid[]);
$cr$;

CREATE FUNCTION public.court_resource_digest_sha256(p_payload bytea)
RETURNS bytea
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_pgcrypto_schema text;
  v_digest_reg text;
  v_result bytea;
BEGIN
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'PGCRYPTO_DIGEST_INPUT_MISSING payload is null';
  END IF;

  SELECT n.nspname
    INTO v_pgcrypto_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n
    ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';
  IF v_pgcrypto_schema IS NULL OR btrim(v_pgcrypto_schema) = '' THEN
    RAISE EXCEPTION 'PGCRYPTO_EXTENSION_MISSING pgcrypto is not installed';
  END IF;

  v_digest_reg := format('%I.digest(bytea,text)', v_pgcrypto_schema);
  IF to_regprocedure(v_digest_reg) IS NULL THEN
    RAISE EXCEPTION
      'PGCRYPTO_DIGEST_MISSING digest bytea,text absent in schema %',
      v_pgcrypto_schema;
  END IF;

  EXECUTE format(
    'SELECT %I.digest($1, %L)',
    v_pgcrypto_schema,
    'sha256'
  )
  INTO STRICT v_result
  USING p_payload;

  RETURN v_result;
END
$cr$;

CREATE FUNCTION public.court_resource_reservation_payload_fingerprint(
  p_club_id text,
  p_physical_court_ids uuid[],
  p_owner_type text,
  p_owner_id text,
  p_owner_sub_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT encode(
    public.court_resource_digest_sha256(convert_to(
      jsonb_build_object(
        'clubId', coalesce(p_club_id, ''),
        'physicalCourtIds', to_jsonb(p_physical_court_ids),
        'ownerType', p_owner_type,
        'ownerId', p_owner_id,
        'ownerSubType', coalesce(p_owner_sub_type, ''),
        'startsAt', p_starts_at,
        'endsAt', p_ends_at
      )::text,
      'UTF8'
    )),
    'hex'
  );
$cr$;

CREATE FUNCTION public.court_resource_map_gateway_owner_type(p_owner_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $cr$
  SELECT CASE lower(btrim(coalesce(p_owner_type, '')))
    WHEN 'tournament' THEN 'competition'
    WHEN 'competition' THEN 'competition'
    WHEN 'customer' THEN 'booking'
    WHEN 'booking' THEN 'booking'
    WHEN 'daily_play' THEN 'daily_play'
    WHEN 'dailyplay' THEN 'daily_play'
    WHEN 'social_play' THEN 'daily_play'
    WHEN 'maintenance' THEN 'maintenance'
    WHEN 'operations' THEN 'operations'
    ELSE NULL
  END;
$cr$;

CREATE FUNCTION public.court_resource_reservation_assert_access(
  p_tenant_id text,
  p_club_id text,
  p_physical_court_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_id uuid;
  v_court_tenant text;
BEGIN
  IF p_physical_court_ids IS NULL OR cardinality(p_physical_court_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;
  FOREACH v_id IN ARRAY p_physical_court_ids LOOP
    SELECT tenant_id INTO v_court_tenant
    FROM public.court_resource_physical_courts
    WHERE physical_court_id = v_id;
    IF v_court_tenant IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false, 'code', 'UNKNOWN_COURT', 'physicalCourtId', v_id
      );
    END IF;
    IF v_court_tenant IS DISTINCT FROM p_tenant_id THEN
      RETURN jsonb_build_object(
        'ok', false, 'code', 'CROSS_TENANT_COURT', 'physicalCourtId', v_id
      );
    END IF;
    IF p_club_id IS NULL OR btrim(p_club_id) = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'MISSING_CLUB_ID');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.court_resource_club_operational_access a
      WHERE a.tenant_id = p_tenant_id
        AND a.club_id = p_club_id
        AND a.physical_court_id = v_id
        AND a.status = 'enabled'
    ) THEN
      RETURN jsonb_build_object(
        'ok', false, 'code', 'OUT_OF_SCOPE', 'physicalCourtId', v_id
      );
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

CREATE FUNCTION public.court_resource_resolve_physical_court_for_legacy(
  p_tenant_id text,
  p_club_id text,
  p_legacy_court_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_ids uuid[];
BEGIN
  IF nullif(btrim(p_legacy_court_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNRESOLVED_MAPPING');
  END IF;
  SELECT array_agg(DISTINCT physical_court_id)
  INTO v_ids
  FROM public.court_resource_legacy_court_identity_mappings
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND legacy_court_id = p_legacy_court_id
    AND classification = 'deterministic'
    AND physical_court_id IS NOT NULL;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNRESOLVED_MAPPING');
  END IF;
  IF cardinality(v_ids) > 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AMBIGUOUS_MAPPING');
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'code', 'OK', 'physicalCourtId', v_ids[1]
  );
END
$cr$;

CREATE FUNCTION public.court_resource_reserve_core(
  p_tenant_id text,
  p_club_id text,
  p_physical_court_ids uuid[],
  p_owner_type text,
  p_owner_id text,
  p_owner_sub_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_id text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_access jsonb;
  v_reservation_ids uuid[] := '{}'::uuid[];
  v_rows jsonb := '[]'::jsonb;
  v_rid uuid;
BEGIN
  v_ids := public.court_resource_reservation_normalize_court_ids(p_physical_court_ids);
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;
  v_access := public.court_resource_reservation_assert_access(
    p_tenant_id, p_club_id, v_ids
  );
  IF NOT coalesce((v_access->>'ok')::boolean, false) THEN
    RETURN v_access;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id), hashtext(v_id::text));
  END LOOP;

  FOREACH v_id IN ARRAY v_ids LOOP
    INSERT INTO public.court_resource_reservations (
      tenant_id, physical_court_id, club_id, owner_type, owner_id, owner_sub_type,
      starts_at, ends_at, status, request_id, created_by
    ) VALUES (
      p_tenant_id, v_id, p_club_id, p_owner_type, p_owner_id, p_owner_sub_type,
      p_starts_at, p_ends_at, 'active', p_request_id, p_actor
    ) RETURNING reservation_id INTO v_rid;
    v_reservation_ids := array_append(v_reservation_ids, v_rid);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'reservationId', v_rid,
      'physicalCourtId', v_id,
      'status', 'active'
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'reservationIds', to_jsonb(v_reservation_ids),
    'reservations', v_rows,
    'replay', false
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FOREIGN_RESERVATION_CONFLICT');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FOREIGN_RESERVATION_CONFLICT');
  WHEN foreign_key_violation OR check_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
END
$cr$;

CREATE FUNCTION public.court_resource_reserve(
  p_tenant_id text,
  p_club_id text,
  p_physical_court_ids uuid[],
  p_owner_type text,
  p_owner_id text,
  p_owner_sub_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_owner_type text;
  v_ids uuid[];
  v_request_id text;
  v_fingerprint text;
  v_existing public.court_resource_reservation_commands%ROWTYPE;
  v_result jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN');
  END IF;
  v_owner_type := public.court_resource_map_gateway_owner_type(p_owner_type);
  IF v_owner_type IS NULL OR nullif(btrim(p_owner_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_OWNER');
  END IF;
  v_request_id := nullif(btrim(p_request_id), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;
  v_ids := public.court_resource_reservation_normalize_court_ids(p_physical_court_ids);
  v_fingerprint := public.court_resource_reservation_payload_fingerprint(
    p_club_id, v_ids, v_owner_type, btrim(p_owner_id),
    nullif(btrim(p_owner_sub_type), ''), p_starts_at, p_ends_at
  );

  SELECT * INTO v_existing
  FROM public.court_resource_reservation_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing.operation IS DISTINCT FROM 'reserve' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  v_result := public.court_resource_reserve_core(
    p_tenant_id, p_club_id, v_ids, v_owner_type, btrim(p_owner_id),
    nullif(btrim(p_owner_sub_type), ''), p_starts_at, p_ends_at,
    v_request_id, v_actor
  );
  IF coalesce((v_result->>'ok')::boolean, false) THEN
    INSERT INTO public.court_resource_reservation_commands (
      tenant_id, request_id, operation, payload_fingerprint, status,
      result, reservation_ids
    ) VALUES (
      p_tenant_id, v_request_id, 'reserve', v_fingerprint, 'succeeded',
      v_result,
      ARRAY(SELECT jsonb_array_elements_text(v_result->'reservationIds')::uuid)
    );
  END IF;
  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.court_resource_reservation_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF FOUND THEN
      IF v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
      END IF;
      RETURN v_existing.result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
END
$cr$;

CREATE FUNCTION public.court_resource_release(
  p_tenant_id text,
  p_reservation_ids uuid[],
  p_owner_type text,
  p_owner_id text,
  p_physical_court_ids uuid[],
  p_request_id text,
  p_release_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_owner_type text;
  v_request_id text;
  v_fingerprint text;
  v_existing public.court_resource_reservation_commands%ROWTYPE;
  v_actor uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_rid uuid;
  v_row public.court_resource_reservations%ROWTYPE;
  v_released uuid[] := '{}'::uuid[];
  v_already uuid[] := '{}'::uuid[];
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN');
  END IF;
  v_owner_type := public.court_resource_map_gateway_owner_type(p_owner_type);
  IF v_owner_type IS NULL OR nullif(btrim(p_owner_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_OWNER');
  END IF;
  v_request_id := nullif(btrim(p_request_id), '');
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  v_fingerprint := encode(
    public.court_resource_digest_sha256(convert_to(jsonb_build_object(
      'operation', 'release',
      'ownerType', v_owner_type,
      'ownerId', btrim(p_owner_id),
      'reservationIds', to_jsonb(coalesce(p_reservation_ids, '{}'::uuid[])),
      'physicalCourtIds', to_jsonb(
        public.court_resource_reservation_normalize_court_ids(p_physical_court_ids)
      ),
      'reason', coalesce(p_release_reason, '')
    )::text, 'UTF8')),
    'hex'
  );

  SELECT * INTO v_existing
  FROM public.court_resource_reservation_commands
  WHERE tenant_id = p_tenant_id AND request_id = v_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing.operation IS DISTINCT FROM 'release' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN v_existing.result || jsonb_build_object('replay', true);
  END IF;

  IF p_reservation_ids IS NOT NULL AND cardinality(p_reservation_ids) > 0 THEN
    v_ids := public.court_resource_reservation_normalize_court_ids(p_reservation_ids);
  ELSE
    SELECT coalesce(array_agg(reservation_id ORDER BY reservation_id), '{}'::uuid[])
    INTO v_ids
    FROM public.court_resource_reservations
    WHERE tenant_id = p_tenant_id
      AND owner_type = v_owner_type
      AND owner_id = btrim(p_owner_id)
      AND (
        p_physical_court_ids IS NULL
        OR cardinality(p_physical_court_ids) = 0
        OR physical_court_id = ANY (
          public.court_resource_reservation_normalize_court_ids(p_physical_court_ids)
        )
      );
  END IF;

  FOREACH v_rid IN ARRAY v_ids LOOP
    SELECT * INTO v_row
    FROM public.court_resource_reservations
    WHERE reservation_id = v_rid AND tenant_id = p_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    IF v_row.owner_type IS DISTINCT FROM v_owner_type
       OR v_row.owner_id IS DISTINCT FROM btrim(p_owner_id) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'FOREIGN_OWNER_RELEASE_DENIED',
        'reservationId', v_rid
      );
    END IF;
    IF v_row.status IS DISTINCT FROM 'active' THEN
      v_already := array_append(v_already, v_rid);
      CONTINUE;
    END IF;
    UPDATE public.court_resource_reservations
    SET status = 'released',
        released_by = v_actor,
        released_at = now(),
        release_reason = coalesce(nullif(btrim(p_release_reason), ''), 'released'),
        updated_at = now()
    WHERE reservation_id = v_rid;
    v_released := array_append(v_released, v_rid);
  END LOOP;

  INSERT INTO public.court_resource_reservation_commands (
    tenant_id, request_id, operation, payload_fingerprint, status,
    result, reservation_ids
  ) VALUES (
    p_tenant_id, v_request_id, 'release', v_fingerprint, 'succeeded',
    jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'releasedReservationIds', to_jsonb(v_released),
      'alreadyReleasedReservationIds', to_jsonb(v_already)
    ),
    v_released
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'releasedReservationIds', to_jsonb(v_released),
    'alreadyReleasedReservationIds', to_jsonb(v_already),
    'replay', false
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT result INTO v_result
    FROM public.court_resource_reservation_commands
    WHERE tenant_id = p_tenant_id AND request_id = v_request_id;
    IF v_result IS NOT NULL THEN
      RETURN v_result || jsonb_build_object('replay', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
END
$cr$;

CREATE FUNCTION public.court_resource_get_availability(
  p_tenant_id text,
  p_club_id text,
  p_physical_court_ids uuid[],
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_owner_type text,
  p_owner_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_owner_type text;
  v_ids uuid[];
  v_id uuid;
  v_courts jsonb := '[]'::jsonb;
  v_court_tenant text;
  v_lifecycle text;
  v_status text;
  v_derived text[];
  v_res public.court_resource_reservations%ROWTYPE;
  v_has_access boolean;
  v_live boolean;
  v_has_res boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  END IF;
  IF NOT (
    public.is_super_admin()
    OR p_tenant_id = public.user_venue_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TENANT_FORBIDDEN');
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TIME_RANGE');
  END IF;
  v_owner_type := public.court_resource_map_gateway_owner_type(p_owner_type);
  v_ids := public.court_resource_reservation_normalize_court_ids(p_physical_court_ids);
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_COURT_ID');
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_derived := ARRAY[]::text[];
    SELECT tenant_id, lifecycle_status
    INTO v_court_tenant, v_lifecycle
    FROM public.court_resource_physical_courts
    WHERE physical_court_id = v_id;
    IF v_court_tenant IS NULL THEN
      v_courts := v_courts || jsonb_build_array(jsonb_build_object(
        'physicalCourtId', v_id,
        'status', 'UNKNOWN_COURT',
        'derived', '[]'::jsonb
      ));
      CONTINUE;
    END IF;
    IF v_court_tenant IS DISTINCT FROM p_tenant_id THEN
      v_courts := v_courts || jsonb_build_array(jsonb_build_object(
        'physicalCourtId', v_id,
        'status', 'OUT_OF_SCOPE',
        'derived', to_jsonb(ARRAY['CROSS_TENANT']::text[])
      ));
      CONTINUE;
    END IF;
    v_has_access := EXISTS (
      SELECT 1 FROM public.court_resource_club_operational_access a
      WHERE a.tenant_id = p_tenant_id
        AND a.club_id = p_club_id
        AND a.physical_court_id = v_id
        AND a.status = 'enabled'
    );
    IF NOT v_has_access THEN
      v_courts := v_courts || jsonb_build_array(jsonb_build_object(
        'physicalCourtId', v_id,
        'status', 'OUT_OF_SCOPE',
        'derived', '[]'::jsonb
      ));
      CONTINUE;
    END IF;

    IF v_lifecycle = 'maintenance' THEN
      v_derived := array_append(v_derived, 'OPERATIONAL_BLOCK');
    ELSIF v_lifecycle IS DISTINCT FROM 'active' THEN
      v_derived := array_append(v_derived, 'OPERATIONAL_BLOCK');
    END IF;

    SELECT * INTO v_res
    FROM public.court_resource_reservations r
    WHERE r.tenant_id = p_tenant_id
      AND r.physical_court_id = v_id
      AND r.status = 'active'
      AND tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ORDER BY
      CASE r.owner_type
        WHEN 'maintenance' THEN 0
        WHEN 'operations' THEN 1
        ELSE 2
      END,
      r.created_at
    LIMIT 1;
    v_has_res := FOUND;

    v_live := false;
    IF to_regclass('public.daily_play_court_leases') IS NOT NULL THEN
      v_live := EXISTS (
        SELECT 1
        FROM public.daily_play_court_leases l
        JOIN public.court_resource_legacy_court_identity_mappings m
          ON m.tenant_id = l.tenant_id
         AND m.club_id = l.club_id
         AND m.legacy_court_id = l.court_id
         AND m.classification = 'deterministic'
         AND m.physical_court_id = v_id
        WHERE l.tenant_id = p_tenant_id
          AND l.status = 'active'
      );
    END IF;
    IF v_live THEN
      v_derived := array_append(v_derived, 'LIVE_OCCUPANCY');
    END IF;

    IF v_lifecycle = 'maintenance' THEN
      v_status := 'MAINTENANCE';
    ELSIF v_has_res AND v_res.owner_type = 'maintenance' THEN
      v_status := 'MAINTENANCE';
    ELSIF v_has_res AND v_res.owner_type = 'operations' THEN
      v_status := 'FOREIGN_RESERVATION';
      v_derived := array_append(v_derived, 'OPERATIONAL_BLOCK');
    ELSIF v_has_res AND v_owner_type IS NOT NULL
      AND v_res.owner_type = v_owner_type
      AND v_res.owner_id = nullif(btrim(p_owner_id), '') THEN
      v_status := 'OWN_RESERVATION';
    ELSIF v_has_res THEN
      v_status := 'FOREIGN_RESERVATION';
    ELSIF v_lifecycle IS DISTINCT FROM 'active' THEN
      v_status := 'OUT_OF_SCOPE';
    ELSE
      v_status := 'AVAILABLE';
    END IF;

    v_courts := v_courts || jsonb_build_array(jsonb_build_object(
      'physicalCourtId', v_id,
      'status', v_status,
      'derived', to_jsonb(v_derived),
      'reservationId', v_res.reservation_id,
      'ownerType', v_res.owner_type,
      'ownerId', v_res.owner_id
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'courts', v_courts);
END
$cr$;

CREATE FUNCTION public.court_resource_daily_play_acquire(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_legacy_court_id text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_resolved jsonb;
  v_physical uuid;
  v_result jsonb;
BEGIN
  IF NOT public.court_resource_canonical_reservation_cutover_enabled() THEN
    RETURN jsonb_build_object('ok', true, 'code', 'CUTOVER_OFF');
  END IF;
  v_resolved := public.court_resource_resolve_physical_court_for_legacy(
    p_tenant_id, p_club_id, p_legacy_court_id
  );
  IF NOT coalesce((v_resolved->>'ok')::boolean, false) THEN
    RETURN v_resolved;
  END IF;
  v_physical := (v_resolved->>'physicalCourtId')::uuid;
  v_result := public.court_resource_reserve_core(
    p_tenant_id,
    p_club_id,
    ARRAY[v_physical],
    'daily_play',
    p_tournament_id::text,
    p_match_id,
    now(),
    now() + interval '12 hours',
    coalesce(nullif(btrim(p_request_id), ''), 'daily-play-' || p_tournament_id::text || '-' || p_match_id),
    auth.uid()
  );
  IF coalesce((v_result->>'ok')::boolean, false) THEN
    v_result := v_result || jsonb_build_object('physicalCourtId', v_physical);
  END IF;
  RETURN v_result;
END
$cr$;

CREATE FUNCTION public.court_resource_daily_play_release_match(
  p_tenant_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
BEGIN
  IF NOT public.court_resource_canonical_reservation_cutover_enabled() THEN
    RETURN jsonb_build_object('ok', true, 'code', 'CUTOVER_OFF');
  END IF;
  UPDATE public.court_resource_reservations
  SET status = 'released',
      released_by = auth.uid(),
      released_at = now(),
      release_reason = coalesce(nullif(btrim(p_reason), ''), 'daily_play_released'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND owner_type = 'daily_play'
    AND owner_id = p_tournament_id::text
    AND owner_sub_type IS NOT DISTINCT FROM p_match_id
    AND status = 'active';
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

CREATE FUNCTION public.court_resource_daily_play_release_court(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_legacy_court_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_resolved jsonb;
  v_physical uuid;
BEGIN
  IF NOT public.court_resource_canonical_reservation_cutover_enabled() THEN
    RETURN jsonb_build_object('ok', true, 'code', 'CUTOVER_OFF');
  END IF;
  v_resolved := public.court_resource_resolve_physical_court_for_legacy(
    p_tenant_id, p_club_id, p_legacy_court_id
  );
  IF NOT coalesce((v_resolved->>'ok')::boolean, false) THEN
    RETURN v_resolved;
  END IF;
  v_physical := (v_resolved->>'physicalCourtId')::uuid;
  UPDATE public.court_resource_reservations
  SET status = 'released',
      released_by = auth.uid(),
      released_at = now(),
      release_reason = coalesce(nullif(btrim(p_reason), ''), 'daily_play_change_court'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND owner_type = 'daily_play'
    AND owner_id = p_tournament_id::text
    AND owner_sub_type IS NOT DISTINCT FROM p_match_id
    AND physical_court_id = v_physical
    AND status = 'active';
  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'physicalCourtId', v_physical);
END
$cr$;

CREATE FUNCTION public.court_resource_daily_play_release_tournament(
  p_tenant_id text,
  p_tournament_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
BEGIN
  IF NOT public.court_resource_canonical_reservation_cutover_enabled() THEN
    RETURN jsonb_build_object('ok', true, 'code', 'CUTOVER_OFF');
  END IF;
  UPDATE public.court_resource_reservations
  SET status = 'released',
      released_by = auth.uid(),
      released_at = now(),
      release_reason = coalesce(nullif(btrim(p_reason), ''), 'daily_play_session_closed'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND owner_type = 'daily_play'
    AND owner_id = p_tournament_id::text
    AND status = 'active';
  RETURN jsonb_build_object('ok', true, 'code', 'OK');
END
$cr$;

CREATE OR REPLACE FUNCTION public.daily_play_assign_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cr$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_cid text:=nullif(trim(coalesce(p_court_id,'')),''); v_candidate text; v_courts jsonb; v_denied jsonb;
  v_avail jsonb; v_cap jsonb; v_cutover boolean;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'assign_court',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status' IS DISTINCT FROM 'waiting' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_WAITING');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.daily_play_match_player_ids(v_m)) p
    WHERE NOT (CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
      THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END) @> jsonb_build_array(p)
  ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_CHECKED_IN','matchId',v_mid); END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.daily_play_match_player_ids(v_m)) p
    WHERE NOT public.daily_play_athlete_eligible_for_club(
      p_tenant_id,p_club_id,p #>> '{}'
    )
  ) THEN RETURN jsonb_build_object('ok',false,'code','PLAYER_NOT_ELIGIBLE','matchId',v_mid); END IF;
  v_courts:=public.daily_play_read_courts(
    p_club_id,CASE WHEN v_s?'enabledCourtIds' THEN v_s->'enabledCourtIds' ELSE NULL END);
  IF jsonb_array_length(v_courts)=0 THEN
    RETURN jsonb_build_object('ok',false,'code','NO_COURT_CAPABILITY');
  END IF;
  v_cutover := public.court_resource_canonical_reservation_cutover_enabled();
  IF v_cutover THEN
    -- CUTOVER ON: canonical reservation is the only capacity authority.
    -- Fail closed. Do not call legacy availability. Do not treat CUTOVER_OFF as success.
    IF v_cid IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_courts) c WHERE coalesce(c->>'id',c->>'courtId')=v_cid)
        THEN RETURN jsonb_build_object('ok',false,'code','COURT_NOT_AVAILABLE'); END IF;
      BEGIN
        v_cap := public.court_resource_daily_play_acquire(
          p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid,p_idempotency_key
        );
        IF coalesce(v_cap->>'code','') = 'CUTOVER_OFF'
           OR NOT coalesce((v_cap->>'ok')::boolean,false) THEN
          IF coalesce(v_cap->>'code','') = 'CUTOVER_OFF' THEN
            RETURN jsonb_build_object('ok',false,'code','CANONICAL_PATH_UNAVAILABLE');
          END IF;
          RETURN v_cap;
        END IF;
        INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
        VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
      END;
    ELSE
      FOR v_candidate IN
        SELECT coalesce(c->>'id',c->>'courtId') FROM jsonb_array_elements(v_courts) c
      LOOP
        BEGIN
          v_cap := public.court_resource_daily_play_acquire(
            p_tenant_id,p_club_id,p_tournament_id,v_mid,v_candidate,p_idempotency_key
          );
          IF coalesce(v_cap->>'code','') = 'CUTOVER_OFF' THEN
            RETURN jsonb_build_object('ok',false,'code','CANONICAL_PATH_UNAVAILABLE');
          END IF;
          IF NOT coalesce((v_cap->>'ok')::boolean,false) THEN
            v_cid:=NULL;
            CONTINUE;
          END IF;
          INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
          VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_candidate);
          v_cid:=v_candidate;
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          v_cid:=NULL;
        END;
      END LOOP;
      IF v_cid IS NULL THEN
        RETURN jsonb_build_object('ok',false,'code','NO_COURT_AVAILABLE');
      END IF;
    END IF;
  ELSE
    -- CUTOVER OFF: exact pre-Phase3B Daily Play path, including court_assert_available.
    IF v_cid IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_courts) c WHERE coalesce(c->>'id',c->>'courtId')=v_cid)
        THEN RETURN jsonb_build_object('ok',false,'code','COURT_NOT_AVAILABLE'); END IF;
      v_avail := public.court_assert_available(p_tenant_id, p_club_id, v_cid, now(), now(), NULL, true, NULL);
      IF NOT coalesce((v_avail->>'ok')::boolean, false) THEN RETURN v_avail; END IF;
      BEGIN
        INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
        VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
      END;
    ELSE
      FOR v_candidate IN
        SELECT coalesce(c->>'id',c->>'courtId') FROM jsonb_array_elements(v_courts) c
      LOOP
        v_avail := public.court_assert_available(p_tenant_id, p_club_id, v_candidate, now(), now(), NULL, true, NULL);
        IF NOT coalesce((v_avail->>'ok')::boolean, false) THEN
          CONTINUE;
        END IF;
        BEGIN
          INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
          VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_candidate);
          v_cid:=v_candidate;
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          v_cid:=NULL;
        END;
      END LOOP;
      IF v_cid IS NULL THEN
        RETURN jsonb_build_object('ok',false,'code','NO_COURT_AVAILABLE');
      END IF;
    END IF;
  END IF;
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_m:=jsonb_set(v_m,'{status}','"assigned"',true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'assign_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$cr$;

CREATE OR REPLACE FUNCTION public.daily_play_change_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cr$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_courts jsonb;
  v_mid text:=nullif(trim(coalesce(p_match_id,'')),''); v_cid text:=nullif(trim(coalesce(p_court_id,'')),'');
  v_denied jsonb; v_avail jsonb; v_cap jsonb; v_old text; v_cutover boolean;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  IF v_cid IS NULL THEN RETURN jsonb_build_object('ok',false,'code','COURT_ID_REQUIRED'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'change_court',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF coalesce(v_m->>'status','waiting') NOT IN ('assigned','playing') THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_ACTIVE');
  END IF;
  v_courts:=public.daily_play_read_courts(p_club_id,CASE WHEN v_s?'enabledCourtIds' THEN v_s->'enabledCourtIds' ELSE NULL END);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_courts)c WHERE coalesce(c->>'id',c->>'courtId')=v_cid)
    THEN RETURN jsonb_build_object('ok',false,'code','COURT_NOT_AVAILABLE'); END IF;
  v_old := nullif(trim(coalesce(v_m->>'courtId','')),'');
  v_cutover := public.court_resource_canonical_reservation_cutover_enabled();
  IF v_cutover THEN
    -- CUTOVER ON: acquire target first, then lease, then release old. All-or-rollback.
    -- Do not release old before target is acquired. Do not call legacy availability.
    IF coalesce(v_old,'')<>v_cid THEN
      BEGIN
        v_cap := public.court_resource_daily_play_acquire(
          p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid,p_idempotency_key
        );
        IF coalesce(v_cap->>'code','') = 'CUTOVER_OFF'
           OR NOT coalesce((v_cap->>'ok')::boolean,false) THEN
          IF coalesce(v_cap->>'code','') = 'CUTOVER_OFF' THEN
            RETURN jsonb_build_object('ok',false,'code','CANONICAL_PATH_UNAVAILABLE');
          END IF;
          RETURN v_cap;
        END IF;
        INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
        VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
      END;
      UPDATE public.daily_play_court_leases SET status='released',released_at=now()
      WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
        AND match_id=v_mid AND status='active' AND court_id<>v_cid;
      IF v_old IS NOT NULL THEN
        PERFORM public.court_resource_daily_play_release_court(
          p_tenant_id, p_club_id, p_tournament_id, v_mid, v_old, 'daily_play_change_court'
        );
      END IF;
    END IF;
  ELSE
    -- CUTOVER OFF: exact pre-Phase3B change path, including court_assert_available.
    IF coalesce(v_m->>'courtId','')<>v_cid THEN
      v_avail := public.court_assert_available(p_tenant_id, p_club_id, v_cid, now(), now(), NULL, true, NULL);
      IF NOT coalesce((v_avail->>'ok')::boolean, false) THEN RETURN v_avail; END IF;
      BEGIN
        INSERT INTO public.daily_play_court_leases(tenant_id,club_id,tournament_id,match_id,court_id)
        VALUES(p_tenant_id,p_club_id,p_tournament_id,v_mid,v_cid);
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok',false,'code','COURT_ALREADY_LEASED','courtId',v_cid);
      END;
      UPDATE public.daily_play_court_leases SET status='released',released_at=now()
      WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
        AND match_id=v_mid AND status='active' AND court_id<>v_cid;
    END IF;
  END IF;
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'change_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$cr$;

CREATE OR REPLACE FUNCTION public.daily_play_submit_score(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_score_a integer, p_score_b integer, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cr$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a<0 OR p_score_b<0 OR p_score_a=p_score_b
    THEN RETURN jsonb_build_object('ok',false,'code','INVALID_SCORE'); END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status'='completed' THEN
    IF v_m->>'scoreA'=p_score_a::text AND v_m->>'scoreB'=p_score_b::text THEN
      v_result:=jsonb_build_object('ok',true,'revision',v_actual,'match',v_m,'replay',true);
      PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key,v_result);
      RETURN v_result;
    END IF;
    RETURN jsonb_build_object('ok',false,'code','SCORE_CONFLICT');
  END IF;
  IF v_m->>'status' IS DISTINCT FROM 'playing' THEN
    RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_PLAYING');
  END IF;
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_m:=jsonb_set(v_m,'{scoreA}',to_jsonb(p_score_a),true);
  v_m:=jsonb_set(v_m,'{scoreB}',to_jsonb(p_score_b),true);
  v_m:=jsonb_set(v_m,'{winner}',to_jsonb(CASE WHEN p_score_a>p_score_b THEN 'A' ELSE 'B' END),true);
  v_m:=jsonb_set(v_m,'{status}','"completed"',true);
  v_m:=jsonb_set(v_m,'{completedAt}',to_jsonb(now()),true);
  UPDATE public.daily_play_court_leases SET status='released',released_at=now()
  WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
    AND match_id=v_mid AND status='active';
  IF public.court_resource_canonical_reservation_cutover_enabled() THEN
    PERFORM public.court_resource_daily_play_release_match(
      p_tenant_id, p_tournament_id, v_mid, 'daily_play_submit_score'
    );
  END IF;
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key,v_result);
  RETURN v_result;
END
$cr$;

CREATE OR REPLACE FUNCTION public.daily_play_cancel_match(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cr$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id=p_tournament_id
    AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;
  v_cmd:=public.daily_play_begin_command(p_tenant_id,p_tournament_id,'cancel_match',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_s:=coalesce(v_t.payload#>'{settings,dailyPlay}','{}'); v_actual:=coalesce(
    CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  v_matches:=CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]' END;
  SELECT value INTO v_m FROM jsonb_array_elements(v_matches) WHERE coalesce(value->>'id',value->>'matchId')=v_mid;
  IF v_m IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); END IF;
  IF v_m->>'status'='completed' THEN RETURN jsonb_build_object('ok',false,'code','MATCH_COMPLETED_IMMUTABLE'); END IF;
  IF p_expected_version IS DISTINCT FROM v_actual THEN RETURN public.daily_play_version_conflict(p_expected_version,v_actual); END IF;
  v_m:=jsonb_set(v_m,'{status}','"cancelled"',true); v_m:=jsonb_set(v_m,'{cancelledAt}',to_jsonb(now()),true);
  UPDATE public.daily_play_court_leases SET status='released',released_at=now()
  WHERE tenant_id=p_tenant_id AND club_id=p_club_id AND tournament_id=p_tournament_id
    AND match_id=v_mid AND status='active';
  IF public.court_resource_canonical_reservation_cutover_enabled() THEN
    PERFORM public.court_resource_daily_play_release_match(
      p_tenant_id, p_tournament_id, v_mid, 'daily_play_cancel_match'
    );
  END IF;
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'cancel_match',p_idempotency_key,v_result);
  RETURN v_result;
END
$cr$;

CREATE OR REPLACE FUNCTION public.daily_play_close_session(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_expected_version integer,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cr$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_s jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_actual int;
  v_matches jsonb;
  v_assigned int := 0;
  v_playing int := 0;
  v_waiting int := 0;
  v_completed int := 0;
  v_unknown int := 0;
  v_checked int := 0;
  v_cancelled_waiting int := 0;
  v_actor text;
  v_status text;
  v_now timestamptz := now();
  v_next jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id=p_tournament_id AND tenant_id=p_tenant_id AND club_id=p_club_id AND mode='daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_FOUND'); END IF;

  v_cmd := public.daily_play_begin_command(p_tenant_id,p_tournament_id,'close_session',p_idempotency_key);
  IF NOT coalesce((v_cmd->>'ok')::boolean,false) THEN RETURN v_cmd; END IF;
  IF (v_cmd->>'replay')::boolean THEN RETURN v_cmd->'result'; END IF;

  v_status := lower(trim(coalesce(v_t.status,'')));
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('ok',false,'code','SESSION_ALREADY_COMPLETED');
  END IF;
  IF v_status NOT IN ('draft','registration','ready','active') THEN
    RETURN jsonb_build_object('ok',false,'code','SESSION_NOT_ACTIVE');
  END IF;

  v_actor := nullif(auth.uid()::text, '');
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','NOT_AUTHENTICATED');
  END IF;

  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}','{}'::jsonb);
  v_actual := coalesce(CASE WHEN (v_s->>'revision')~'^[0-9]+$' THEN (v_s->>'revision')::int END,0);
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END IF;

  v_matches := CASE WHEN jsonb_typeof(v_s->'matches')='array' THEN v_s->'matches' ELSE '[]'::jsonb END;
  SELECT
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='assigned'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='playing'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))='waiting'),
    count(*) FILTER (WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting')) IN ('completed','forfeit')),
    count(*) FILTER (
      WHERE lower(coalesce(nullif(trim(m->>'status'),''),'waiting'))
        NOT IN ('waiting','completed','cancelled','forfeit','assigned','playing')
    )
  INTO v_assigned, v_playing, v_waiting, v_completed, v_unknown
  FROM jsonb_array_elements(v_matches) m;

  IF v_assigned > 0 OR v_playing > 0 OR v_unknown > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SESSION_CLOSE_BLOCKED',
      'assignedCount', v_assigned,
      'playingCount', v_playing,
      'unknownCount', v_unknown
    );
  END IF;

  SELECT coalesce(jsonb_array_length(
    CASE WHEN jsonb_typeof(v_s->'checkedInPlayerIds')='array'
      THEN v_s->'checkedInPlayerIds' ELSE '[]'::jsonb END
  ), 0) INTO v_checked;

  SELECT coalesce(jsonb_agg(
    CASE WHEN lower(coalesce(nullif(trim(m.match->>'status'),''),'waiting')) = 'waiting' THEN
      jsonb_set(
        jsonb_set(
          jsonb_set(m.match, '{status}', '"cancelled"'),
          '{reason}', '"session_closed"'
        ),
        '{cancelledAt}', to_jsonb(v_now)
      )
    ELSE m.match END
    ORDER BY m.ord
  ), '[]'::jsonb)
  INTO v_next
  FROM jsonb_array_elements(v_matches) WITH ORDINALITY AS m(match, ord);

  v_cancelled_waiting := v_waiting;

  v_s := jsonb_set(v_s, '{matches}', v_next, true);
  v_s := jsonb_set(v_s, '{checkedInPlayerIds}', '[]'::jsonb, true);
  v_s := jsonb_set(v_s, '{closedAt}', to_jsonb(v_now), true);
  v_s := jsonb_set(v_s, '{closedBy}', to_jsonb(v_actor), true);
  v_s := jsonb_set(v_s, '{closeSummary}', jsonb_build_object(
    'completedMatchCount', v_completed,
    'cancelledWaitingCount', v_cancelled_waiting,
    'checkedInCountAtClose', v_checked
  ), true);
  v_s := jsonb_set(v_s, '{revision}', to_jsonb(v_actual + 1), true);

  BEGIN
    IF NOT public.daily_play_write_state(p_tournament_id, v_actual, v_s) THEN
      RAISE EXCEPTION 'DAILY_PLAY_CLOSE_CAS' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.daily_play_court_leases
    SET status = 'released', released_at = v_now
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND tournament_id = p_tournament_id
      AND status = 'active';

    IF public.court_resource_canonical_reservation_cutover_enabled() THEN
      PERFORM public.court_resource_daily_play_release_tournament(
        p_tenant_id, p_tournament_id, 'daily_play_close_session'
      );
    END IF;

    UPDATE public.canonical_tournaments
    SET status = 'completed', updated_at = v_now
    WHERE id = p_tournament_id
      AND tenant_id = p_tenant_id
      AND club_id = p_club_id;

    v_result := jsonb_build_object(
      'ok', true,
      'revision', v_actual + 1,
      'tournamentStatus', 'completed',
      'closeSummary', v_s->'closeSummary',
      'state', v_s
    );
    PERFORM public.daily_play_finish_command(
      p_tenant_id, p_tournament_id, 'close_session', p_idempotency_key, v_result
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END;

  RETURN v_result;
END
$cr$;

REVOKE ALL ON FUNCTION public.court_resource_canonical_reservation_cutover_enabled()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_set_canonical_reservation_cutover(boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_resource_reservation_normalize_court_ids(uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_digest_sha256(bytea)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_reservation_payload_fingerprint(text,uuid[],text,text,text,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_map_gateway_owner_type(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_reservation_assert_access(text,text,uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_resolve_physical_court_for_legacy(text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_reserve_core(text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_release_match(text,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_release_court(text,text,uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_release_tournament(text,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_resource_release(text,uuid[],text,text,uuid[],text,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_resource_get_availability(text,text,uuid[],timestamptz,timestamptz,text,text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.court_resource_set_canonical_reservation_cutover(boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_resource_release(text,uuid[],text,text,uuid[],text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_resource_get_availability(text,text,uuid[],timestamptz,timestamptz,text,text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.daily_play_assign_court(text,text,uuid,text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_change_court(text,text,uuid,text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_cancel_match(text,text,uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.daily_play_close_session(text,text,uuid,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_play_assign_court(text,text,uuid,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_change_court(text,text,uuid,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_cancel_match(text,text,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_close_session(text,text,uuid,integer,text) TO authenticated;

COMMIT;

-- Court Resource Phase 3B/4D Daily Play interval authority.
-- ONE TRANSACTION. LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING/PRODUCTION HERE.
-- Layers on Phase 3B. Does not enable cutover. Does not mutate Phase 3B package files.

BEGIN;

-- Venue timezone is domain input for civil-day capacity end (Option B).
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS timezone text;

CREATE TABLE public.daily_play_court_capacity_windows (
  tenant_id text NOT NULL CHECK (length(trim(tenant_id)) > 0),
  club_id text NOT NULL CHECK (length(trim(club_id)) > 0),
  tournament_id uuid NOT NULL,
  match_id text NOT NULL CHECK (length(trim(match_id)) > 0),
  court_id text NOT NULL CHECK (length(trim(court_id)) > 0),
  physical_court_id uuid NOT NULL,
  capacity_starts_at timestamptz NOT NULL,
  capacity_ends_at timestamptz NOT NULL,
  request_id text NOT NULL CHECK (length(trim(request_id)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_play_court_capacity_windows_range_check
    CHECK (capacity_ends_at > capacity_starts_at),
  CONSTRAINT daily_play_court_capacity_windows_pkey
    PRIMARY KEY (tenant_id, tournament_id, match_id, court_id)
);

CREATE INDEX daily_play_court_capacity_windows_physical_idx
  ON public.daily_play_court_capacity_windows (
    tenant_id, physical_court_id, capacity_starts_at, capacity_ends_at
  );

ALTER TABLE public.daily_play_court_capacity_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_play_court_capacity_windows FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_play_court_capacity_windows FROM PUBLIC, anon, authenticated;

CREATE POLICY daily_play_court_capacity_windows_select
  ON public.daily_play_court_capacity_windows
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

-- Venue-local exclusive civil-day end after p_starts_at.
-- If < 1 hour remains until that midnight, use the following midnight.
CREATE OR REPLACE FUNCTION public.court_resource_daily_play_venue_capacity_end(
  p_tenant_id text,
  p_starts_at timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_tz text;
  v_ends timestamptz;
BEGIN
  IF p_starts_at IS NULL THEN
    RAISE EXCEPTION 'INVALID_CAPACITY_START';
  END IF;
  SELECT nullif(btrim(timezone), '') INTO v_tz
  FROM public.venues
  WHERE id = p_tenant_id;
  v_tz := coalesce(v_tz, 'UTC');
  v_ends := ((p_starts_at AT TIME ZONE v_tz)::date + 1)::timestamp AT TIME ZONE v_tz;
  IF v_ends <= p_starts_at + interval '1 hour' THEN
    v_ends := v_ends + interval '1 day';
  END IF;
  IF v_ends <= p_starts_at THEN
    RAISE EXCEPTION 'INVALID_CAPACITY_END';
  END IF;
  RETURN v_ends;
END
$cr$;

-- Extend persisted window + matching active reservation by one venue day near expiry.
CREATE OR REPLACE FUNCTION public.court_resource_daily_play_extend_capacity_if_needed(
  p_tenant_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_legacy_court_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $cr$
DECLARE
  v_win public.daily_play_court_capacity_windows%ROWTYPE;
  v_new_end timestamptz;
  v_tz text;
BEGIN
  SELECT * INTO v_win
  FROM public.daily_play_court_capacity_windows
  WHERE tenant_id = p_tenant_id
    AND tournament_id = p_tournament_id
    AND match_id = p_match_id
    AND court_id = p_legacy_court_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'code', 'NO_WINDOW', 'extended', false);
  END IF;

  IF now() < (v_win.capacity_ends_at - interval '30 minutes') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'extended', false,
      'capacityStartsAt', v_win.capacity_starts_at,
      'capacityEndsAt', v_win.capacity_ends_at
    );
  END IF;

  SELECT nullif(btrim(timezone), '') INTO v_tz
  FROM public.venues WHERE id = p_tenant_id;
  v_tz := coalesce(v_tz, 'UTC');
  v_new_end := ((v_win.capacity_ends_at AT TIME ZONE v_tz)::date + 1)::timestamp
    AT TIME ZONE v_tz;
  IF v_new_end <= v_win.capacity_ends_at THEN
    v_new_end := v_win.capacity_ends_at + interval '1 day';
  END IF;

  UPDATE public.daily_play_court_capacity_windows
  SET capacity_ends_at = v_new_end,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND tournament_id = p_tournament_id
    AND match_id = p_match_id
    AND court_id = p_legacy_court_id;

  UPDATE public.court_resource_reservations
  SET ends_at = v_new_end,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND owner_type = 'daily_play'
    AND owner_id = p_tournament_id::text
    AND owner_sub_type IS NOT DISTINCT FROM p_match_id
    AND physical_court_id = v_win.physical_court_id
    AND status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'EXTENDED',
    'extended', true,
    'capacityStartsAt', v_win.capacity_starts_at,
    'capacityEndsAt', v_new_end
  );
END
$cr$;

CREATE OR REPLACE FUNCTION public.court_resource_daily_play_acquire(
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
  v_request_id text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_win public.daily_play_court_capacity_windows%ROWTYPE;
  v_existing public.court_resource_reservations%ROWTYPE;
  v_ext jsonb;
BEGIN
  IF NOT public.court_resource_canonical_reservation_cutover_enabled() THEN
    RETURN jsonb_build_object('ok', true, 'code', 'CUTOVER_OFF');
  END IF;

  IF nullif(btrim(p_match_id), '') IS NULL
     OR nullif(btrim(p_legacy_court_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  v_request_id := coalesce(
    nullif(btrim(p_request_id), ''),
    'daily-play-' || p_tournament_id::text || '-' || btrim(p_match_id)
  );

  v_resolved := public.court_resource_resolve_physical_court_for_legacy(
    p_tenant_id, p_club_id, p_legacy_court_id
  );
  IF NOT coalesce((v_resolved->>'ok')::boolean, false) THEN
    RETURN v_resolved;
  END IF;
  v_physical := (v_resolved->>'physicalCourtId')::uuid;

  -- Serialize first-acquire / retry for this match-court hold.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_tenant_id || ':dp-cap:' || p_tournament_id::text),
    hashtext(btrim(p_match_id) || ':' || btrim(p_legacy_court_id))
  );

  -- Post-commit retry: reuse exact active reservation interval.
  SELECT * INTO v_existing
  FROM public.court_resource_reservations
  WHERE tenant_id = p_tenant_id
    AND owner_type = 'daily_play'
    AND owner_id = p_tournament_id::text
    AND owner_sub_type IS NOT DISTINCT FROM btrim(p_match_id)
    AND physical_court_id = v_physical
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    INSERT INTO public.daily_play_court_capacity_windows (
      tenant_id, club_id, tournament_id, match_id, court_id,
      physical_court_id, capacity_starts_at, capacity_ends_at, request_id
    ) VALUES (
      p_tenant_id, p_club_id, p_tournament_id, btrim(p_match_id),
      btrim(p_legacy_court_id), v_physical,
      v_existing.starts_at, v_existing.ends_at, v_request_id
    )
    ON CONFLICT (tenant_id, tournament_id, match_id, court_id) DO NOTHING;

    v_ext := public.court_resource_daily_play_extend_capacity_if_needed(
      p_tenant_id, p_tournament_id, btrim(p_match_id), btrim(p_legacy_court_id)
    );

    SELECT * INTO v_existing
    FROM public.court_resource_reservations
    WHERE reservation_id = v_existing.reservation_id;

    RETURN jsonb_build_object(
      'ok', true,
      'code', 'OK',
      'replay', true,
      'physicalCourtId', v_physical,
      'capacityStartsAt', v_existing.starts_at,
      'capacityEndsAt', v_existing.ends_at,
      'reservationIds', jsonb_build_array(v_existing.reservation_id),
      'extended', coalesce((v_ext->>'extended')::boolean, false)
    );
  END IF;

  SELECT * INTO v_win
  FROM public.daily_play_court_capacity_windows
  WHERE tenant_id = p_tenant_id
    AND tournament_id = p_tournament_id
    AND match_id = btrim(p_match_id)
    AND court_id = btrim(p_legacy_court_id)
  FOR UPDATE;

  IF FOUND THEN
    v_starts := v_win.capacity_starts_at;
    v_ends := v_win.capacity_ends_at;
    IF v_win.physical_court_id IS DISTINCT FROM v_physical THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CAPACITY_WINDOW_COURT_MISMATCH');
    END IF;
    v_ext := public.court_resource_daily_play_extend_capacity_if_needed(
      p_tenant_id, p_tournament_id, btrim(p_match_id), btrim(p_legacy_court_id)
    );
    IF coalesce((v_ext->>'extended')::boolean, false) THEN
      v_starts := (v_ext->>'capacityStartsAt')::timestamptz;
      v_ends := (v_ext->>'capacityEndsAt')::timestamptz;
    END IF;
  ELSE
    -- Capture once for this hold. Transaction-stable now(); never recompute on retry.
    v_starts := now();
    v_ends := public.court_resource_daily_play_venue_capacity_end(p_tenant_id, v_starts);
    INSERT INTO public.daily_play_court_capacity_windows (
      tenant_id, club_id, tournament_id, match_id, court_id,
      physical_court_id, capacity_starts_at, capacity_ends_at, request_id
    ) VALUES (
      p_tenant_id, p_club_id, p_tournament_id, btrim(p_match_id),
      btrim(p_legacy_court_id), v_physical, v_starts, v_ends, v_request_id
    );
  END IF;

  v_result := public.court_resource_reserve_core(
    p_tenant_id,
    p_club_id,
    ARRAY[v_physical],
    'daily_play',
    p_tournament_id::text,
    btrim(p_match_id),
    v_starts,
    v_ends,
    v_request_id,
    auth.uid()
  );

  IF coalesce((v_result->>'ok')::boolean, false) THEN
    v_result := v_result || jsonb_build_object(
      'physicalCourtId', v_physical,
      'capacityStartsAt', v_starts,
      'capacityEndsAt', v_ends,
      'replay', false
    );
  END IF;
  RETURN v_result;
END
$cr$;

-- Touch capacity on start_match so long-running assigned/playing holds extend.
CREATE OR REPLACE FUNCTION public.daily_play_start_match(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_expected_version integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cr$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_s jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_actual int;
  v_matches jsonb;
  v_m jsonb;
  v_cid text;
  v_mid text := nullif(trim(coalesce(p_match_id, '')), '');
  v_denied jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id = p_tournament_id
    AND tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND mode = 'daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;
  v_cmd := public.daily_play_begin_command(
    p_tenant_id, p_tournament_id, 'start_match', p_idempotency_key
  );
  IF NOT coalesce((v_cmd->>'ok')::boolean, false) THEN
    RETURN v_cmd;
  END IF;
  IF (v_cmd->>'replay')::boolean THEN
    RETURN v_cmd->'result';
  END IF;
  v_denied := public.daily_play_session_write_denied(v_t.status);
  IF v_denied IS NOT NULL THEN
    RETURN v_denied;
  END IF;
  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}', '{}');
  v_actual := coalesce(
    CASE WHEN (v_s->>'revision') ~ '^[0-9]+$' THEN (v_s->>'revision')::int END,
    0
  );
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END IF;
  v_matches := CASE
    WHEN jsonb_typeof(v_s->'matches') = 'array' THEN v_s->'matches'
    ELSE '[]'
  END;
  SELECT value INTO v_m
  FROM jsonb_array_elements(v_matches)
  WHERE coalesce(value->>'id', value->>'matchId') = v_mid;
  IF v_m IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  END IF;
  IF v_m->>'status' IS DISTINCT FROM 'assigned' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MATCH_NOT_ASSIGNED');
  END IF;
  v_cid := nullif(trim(coalesce(v_m->>'courtId', '')), '');
  IF v_cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COURT_ID_REQUIRED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_play_court_leases
    WHERE tenant_id = p_tenant_id
      AND club_id = p_club_id
      AND tournament_id = p_tournament_id
      AND match_id = v_mid
      AND court_id = v_cid
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COURT_LEASE_NOT_ACTIVE');
  END IF;

  IF public.court_resource_canonical_reservation_cutover_enabled() THEN
    PERFORM public.court_resource_daily_play_extend_capacity_if_needed(
      p_tenant_id, p_tournament_id, v_mid, v_cid
    );
  END IF;

  v_m := jsonb_set(v_m, '{status}', '"playing"', true);
  v_m := jsonb_set(v_m, '{startedAt}', to_jsonb(now()), true);
  v_s := jsonb_set(
    v_s, '{matches}', public.daily_play_replace_match(v_matches, v_mid, v_m), true
  );
  v_s := jsonb_set(v_s, '{revision}', to_jsonb(v_actual + 1), true);
  PERFORM public.daily_play_write_state(p_tournament_id, v_actual, v_s);
  v_result := jsonb_build_object('ok', true, 'revision', v_actual + 1, 'match', v_m);
  PERFORM public.daily_play_finish_command(
    p_tenant_id, p_tournament_id, 'start_match', p_idempotency_key, v_result
  );
  RETURN v_result;
END
$cr$;

REVOKE ALL ON FUNCTION public.court_resource_daily_play_venue_capacity_end(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_extend_capacity_if_needed(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_daily_play_acquire(text, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_start_match(text, text, uuid, text, integer, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.daily_play_start_match(text, text, uuid, text, integer, text)
  TO authenticated;

-- Cutover must remain false after this package.
UPDATE public.court_resource_reservation_cutover
SET enabled = false,
    updated_at = now()
WHERE cutover_id = 'canonical-reservation-phase3b'
  AND enabled IS DISTINCT FROM false;

COMMIT;

SELECT 'PHASE4D_APPLY' AS check_item, true AS ok;
SELECT 'SQL_CUTOVER_FALSE' AS check_item,
  EXISTS (
    SELECT 1 FROM public.court_resource_reservation_cutover
    WHERE cutover_id = 'canonical-reservation-phase3b' AND enabled = false
  ) AS ok;

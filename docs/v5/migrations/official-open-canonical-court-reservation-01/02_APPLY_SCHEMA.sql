-- Official/Open canonical court reservation 01 APPLY SCHEMA.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Does NOT recreate daily_play_court_leases. Does NOT replay Daily #424.
-- Does NOT CREATE EXTENSION btree_gist — that is a separate prerequisite package.
-- Does NOT backfill business rows — see 05_BACKFILL.sql.

BEGIN;

ALTER TABLE public.canonical_tournaments
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

-- Global monotonic version for every existing-row mutation.
-- 5th argument is optional so current 4-arg callers keep working.
DROP FUNCTION IF EXISTS public.canonical_tournament_update(text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.canonical_tournament_update(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_patch jsonb,
  p_expected_version bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.canonical_tournaments%ROWTYPE;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO row_data
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version IS DISTINCT FROM row_data.version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', row_data.version
    );
  END IF;

  UPDATE public.canonical_tournaments t
  SET
    name = COALESCE(nullif(trim(p_patch->>'name'), ''), t.name),
    status = COALESCE(nullif(trim(p_patch->>'status'), ''), t.status),
    season_id = CASE WHEN p_patch ? 'season_id' THEN nullif(trim(p_patch->>'season_id'), '') ELSE t.season_id END,
    league_id = CASE WHEN p_patch ? 'league_id' THEN nullif(trim(p_patch->>'league_id'), '') ELSE t.league_id END,
    payload = CASE WHEN p_patch ? 'payload' THEN p_patch->'payload' ELSE t.payload END,
    engine_v4 = CASE WHEN p_patch ? 'engine_v4' THEN p_patch->'engine_v4' ELSE t.engine_v4 END,
    version = t.version + 1,
    updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO row_data;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data), 'version', row_data.version);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb, bigint) TO authenticated;

CREATE TABLE IF NOT EXISTS public.court_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL CHECK (length(trim(tenant_id)) > 0),
  club_id text NOT NULL CHECK (length(trim(club_id)) > 0),
  court_id text NOT NULL CHECK (length(trim(court_id)) > 0),
  source text NOT NULL CHECK (source IN (
    'official_tournament', 'internal_tournament', 'team_tournament',
    'maintenance', 'normal', 'unknown'
  )),
  owner_id text,
  tournament_id uuid REFERENCES public.canonical_tournaments(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  idempotency_key text,
  origin text NOT NULL DEFAULT 'runtime' CHECK (origin IN ('runtime', 'package_backfill')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (starts_at < ends_at),
  CHECK (
    (status = 'active' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
);

ALTER TABLE public.court_reservations
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'runtime';

CREATE INDEX IF NOT EXISTS court_reservations_lookup_idx
  ON public.court_reservations (tenant_id, club_id, court_id, status);

CREATE INDEX IF NOT EXISTS court_reservations_tournament_idx
  ON public.court_reservations (tournament_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS court_reservations_idempotency_uidx
  ON public.court_reservations (tenant_id, club_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'court_reservations_no_active_overlap'
      AND conrelid = 'public.court_reservations'::regclass
  ) THEN
    ALTER TABLE public.court_reservations
      ADD CONSTRAINT court_reservations_no_active_overlap
      EXCLUDE USING gist (
        tenant_id WITH =,
        club_id WITH =,
        court_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      ) WHERE (status = 'active');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.court_reservation_command_ledger (
  tenant_id text NOT NULL CHECK (length(trim(tenant_id)) > 0),
  tournament_id uuid NOT NULL
    REFERENCES public.canonical_tournaments(id) ON DELETE CASCADE,
  command text NOT NULL CHECK (length(trim(command)) > 0),
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_fingerprint text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tournament_id, command, idempotency_key)
);

ALTER TABLE public.court_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_reservation_command_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.court_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_reservation_command_ledger FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.court_reservation_begin_command(
  p_tenant_id text, p_tournament_id uuid, p_command text,
  p_idempotency_key text, p_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.court_reservation_command_ledger%ROWTYPE;
BEGIN
  IF nullif(trim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REQUIRED');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant_id || ':' || p_tournament_id::text || ':' || p_command || ':' || p_idempotency_key, 0
  ));
  SELECT * INTO v_row
  FROM public.court_reservation_command_ledger
  WHERE tenant_id = p_tenant_id AND tournament_id = p_tournament_id
    AND command = p_command AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_row.request_fingerprint IS DISTINCT FROM p_fingerprint THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'replay', true, 'result', v_row.result);
  END IF;
  RETURN jsonb_build_object('ok', true, 'replay', false);
END
$$;

CREATE OR REPLACE FUNCTION public.court_reservation_finish_command(
  p_tenant_id text, p_tournament_id uuid, p_command text,
  p_idempotency_key text, p_fingerprint text, p_result jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.court_reservation_command_ledger (
    tenant_id, tournament_id, command, idempotency_key, request_fingerprint, result
  ) VALUES (
    p_tenant_id, p_tournament_id, p_command, p_idempotency_key, p_fingerprint, p_result
  )
  ON CONFLICT (tenant_id, tournament_id, command, idempotency_key) DO UPDATE
    SET result = EXCLUDED.result, request_fingerprint = EXCLUDED.request_fingerprint;
END
$$;

-- Shared occupancy authority. Half-open [starts_at, ends_at).
-- p_live_unbounded=true: Daily lease — any calendar reservation/bridged booking on the court blocks.
CREATE OR REPLACE FUNCTION public.court_assert_available(
  p_tenant_id text,
  p_club_id text,
  p_court_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_ignore_tournament_id uuid,
  p_live_unbounded boolean,
  p_timezone text DEFAULT 'UTC'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cid text := nullif(trim(coalesce(p_court_id, '')), '');
  v_booking jsonb;
  v_b_start timestamptz;
  v_b_end timestamptz;
  v_tz text := nullif(trim(coalesce(p_timezone, '')), '');
BEGIN
  IF v_cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_WINDOW');
  END IF;
  IF NOT coalesce(p_live_unbounded, false) THEN
    IF p_starts_at IS NULL OR p_ends_at IS NULL OR NOT (p_starts_at < p_ends_at) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_WINDOW');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.daily_play_court_leases
    WHERE tenant_id = p_tenant_id AND club_id = p_club_id AND court_id = v_cid
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'daily_play_court_leases');
  END IF;

  IF coalesce(p_live_unbounded, false) THEN
    IF EXISTS (
      SELECT 1 FROM public.court_reservations
      WHERE tenant_id = p_tenant_id AND club_id = p_club_id AND court_id = v_cid
        AND status = 'active'
        AND (p_ignore_tournament_id IS NULL OR tournament_id IS DISTINCT FROM p_ignore_tournament_id)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'court_reservations');
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.court_reservations
      WHERE tenant_id = p_tenant_id AND club_id = p_club_id AND court_id = v_cid
        AND status = 'active'
        AND (p_ignore_tournament_id IS NULL OR tournament_id IS DISTINCT FROM p_ignore_tournament_id)
        AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'court_reservations');
    END IF;
  END IF;

  FOR v_booking IN
    SELECT b.booking
    FROM public.club_data_v3 d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.data->'bookings') = 'array'
        THEN d.data->'bookings' ELSE '[]'::jsonb END
    ) AS b(booking)
    WHERE d.club_id = p_club_id
      AND coalesce(b.booking->>'courtId', b.booking->>'court_id', '') = v_cid
      AND lower(coalesce(b.booking->>'status', b.booking->>'bookingStatus', 'confirmed'))
        NOT IN ('cancelled', 'completed', 'no_show')
      AND (
        p_ignore_tournament_id IS NULL
        OR nullif(trim(coalesce(b.booking->>'tournamentId', b.booking->>'tournament_id', '')), '')
          IS DISTINCT FROM p_ignore_tournament_id::text
      )
  LOOP
    IF coalesce(p_live_unbounded, false) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'club_data_v3.bookings');
    END IF;
    IF v_tz IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'club_data_v3.bookings', 'reason', 'unparseable_active_booking');
    END IF;
    BEGIN
      v_b_start := (
        (v_booking->>'date') || ' ' || left(coalesce(v_booking->>'startTime', v_booking->>'start_time', ''), 5)
      )::timestamp AT TIME ZONE v_tz;
      v_b_end := (
        (v_booking->>'date') || ' ' || left(coalesce(v_booking->>'endTime', v_booking->>'end_time', ''), 5)
      )::timestamp AT TIME ZONE v_tz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'club_data_v3.bookings', 'reason', 'unparseable_active_booking');
    END;
    IF v_b_start IS NULL OR v_b_end IS NULL OR NOT (v_b_start < v_b_end) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'club_data_v3.bookings', 'reason', 'unparseable_active_booking');
    END IF;
    IF v_b_start IS NOT NULL AND v_b_end IS NOT NULL
       AND tstzrange(v_b_start, v_b_end, '[)') && tstzrange(p_starts_at, p_ends_at, '[)') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED', 'conflictSource', 'club_data_v3.bookings');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END
$$;

CREATE OR REPLACE FUNCTION public.official_tournament_inventory_courts(p_club_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Club-id inventory only. Do NOT filter venue_id = tenant_id (Phase 2N).
  SELECT coalesce(jsonb_agg(c.court ORDER BY d.club_id, c.ord), '[]'::jsonb)
  FROM public.club_data_v3 d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.data->'courts') = 'array'
      THEN d.data->'courts' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS c(court, ord)
  WHERE d.club_id = p_club_id
    AND nullif(trim(coalesce(c.court->>'id', c.court->>'courtId', '')), '') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.official_tournament_reserve_courts(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_court_ids jsonb,
  p_date text,
  p_start_time text,
  p_end_time text,
  p_timezone text,
  p_expected_version bigint,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_cmd jsonb;
  v_fp text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_ids text[];
  v_cid text;
  v_courts jsonb;
  v_avail jsonb;
  v_payload jsonb;
  v_uid uuid;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;
  v_uid := auth.uid();
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  v_ids := ARRAY(
    SELECT DISTINCT trim(value)
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_court_ids) = 'array' THEN p_court_ids ELSE '[]'::jsonb END) AS value
    WHERE nullif(trim(value), '') IS NOT NULL
    ORDER BY 1
  );
  v_fp := jsonb_build_object(
    'courtIds', to_jsonb(v_ids),
    'date', left(trim(coalesce(p_date, '')), 10),
    'startTime', left(trim(coalesce(p_start_time, '')), 5),
    'endTime', left(trim(coalesce(p_end_time, '')), 5)
  )::text;

  v_cmd := public.court_reservation_begin_command(
    p_tenant_id, p_tournament_id, 'reserve_courts', p_idempotency_key, v_fp
  );
  IF NOT coalesce((v_cmd->>'ok')::boolean, false) THEN RETURN v_cmd; END IF;
  IF coalesce((v_cmd->>'replay')::boolean, false) THEN RETURN v_cmd->'result'; END IF;

  SELECT * INTO v_t FROM public.canonical_tournaments
    WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MODE_INVALID');
  END IF;
  IF p_expected_version IS DISTINCT FROM v_t.version THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version, 'actualVersion', v_t.version
    );
  END IF;

  IF cardinality(v_ids) IS NULL OR cardinality(v_ids) = 0
     OR nullif(trim(coalesce(p_date, '')), '') IS NULL
     OR nullif(trim(coalesce(p_start_time, '')), '') IS NULL
     OR nullif(trim(coalesce(p_end_time, '')), '') IS NULL
     OR nullif(trim(coalesce(p_timezone, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_WINDOW');
  END IF;

  BEGIN
    v_starts := (trim(p_date) || ' ' || left(trim(p_start_time), 5))::timestamp AT TIME ZONE trim(p_timezone);
    v_ends := (trim(p_date) || ' ' || left(trim(p_end_time), 5))::timestamp AT TIME ZONE trim(p_timezone);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_WINDOW');
  END;
  IF NOT (v_starts < v_ends) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_WINDOW');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.court_reservations
    WHERE tournament_id = p_tournament_id AND status = 'active' AND starts_at <= v_now
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.court_reservations
      WHERE tournament_id = p_tournament_id AND status = 'active'
        AND (
          court_id <> ALL (v_ids)
          OR starts_at IS DISTINCT FROM v_starts
          OR ends_at IS DISTINCT FROM v_ends
        )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_ALREADY_STARTED');
    END IF;
  END IF;

  v_courts := public.official_tournament_inventory_courts(p_club_id);
  FOREACH v_cid IN ARRAY v_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_courts) c
      WHERE coalesce(c->>'id', c->>'courtId') = v_cid
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_NOT_FOUND', 'courtId', v_cid);
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_courts) c
      WHERE coalesce(c->>'id', c->>'courtId') = v_cid
        AND (
          lower(coalesce(c->>'active', 'true')) IN ('false', '0', 'no')
          OR lower(coalesce(c->>'status', 'active')) IN ('locked', 'maintenance')
        )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COURT_FORBIDDEN', 'courtId', v_cid);
    END IF;
    v_avail := public.court_assert_available(
      p_tenant_id, p_club_id, v_cid, v_starts, v_ends, p_tournament_id, false, trim(p_timezone)
    );
    IF NOT coalesce((v_avail->>'ok')::boolean, false) THEN
      RETURN v_avail;
    END IF;
  END LOOP;

  UPDATE public.court_reservations
    SET status = 'cancelled', cancelled_at = v_now, updated_at = v_now
    WHERE tournament_id = p_tournament_id AND status = 'active';

  FOREACH v_cid IN ARRAY v_ids LOOP
    INSERT INTO public.court_reservations (
      tenant_id, club_id, court_id, source, owner_id, tournament_id,
      starts_at, ends_at, status, idempotency_key, origin, created_by
    ) VALUES (
      p_tenant_id, p_club_id, v_cid, 'official_tournament', p_tournament_id::text,
      p_tournament_id, v_starts, v_ends, 'active', p_idempotency_key, 'runtime', v_uid
    );
  END LOOP;

  v_payload := coalesce(v_t.payload, '{}'::jsonb);
  v_payload := jsonb_set(v_payload, '{courtSchedule}', jsonb_build_object(
    'date', left(trim(p_date), 10),
    'startTime', left(trim(p_start_time), 5),
    'endTime', left(trim(p_end_time), 5),
    'courtIds', to_jsonb(v_ids),
    'syncedAt', v_now,
    'timezone', trim(p_timezone)
  ), true);

  UPDATE public.canonical_tournaments
    SET payload = v_payload, version = v_t.version + 1, updated_at = v_now
    WHERE id = p_tournament_id;
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id = p_tournament_id;

  PERFORM public.court_reservation_finish_command(
    p_tenant_id, p_tournament_id, 'reserve_courts', p_idempotency_key, v_fp,
    jsonb_build_object('ok', true, 'tournament', to_jsonb(v_t), 'version', v_t.version)
  );
  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(v_t), 'version', v_t.version);
EXCEPTION
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COURT_OCCUPIED');
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END
$$;

CREATE OR REPLACE FUNCTION public.official_tournament_commit_group_schedule(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_event_id text,
  p_matches jsonb,
  p_expected_version bigint,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_cmd jsonb;
  v_fp text;
  v_payload jsonb;
  v_events jsonb;
  v_event jsonb;
  v_existing jsonb;
  v_proposed jsonb;
  v_match jsonb;
  v_next jsonb;
  v_a jsonb;
  v_b jsonb;
  v_res public.court_reservations%ROWTYPE;
  v_win tstzrange;
  v_now timestamptz := now();
  v_eid text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  END IF;
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  v_fp := coalesce(p_matches, '[]'::jsonb)::text;
  v_cmd := public.court_reservation_begin_command(
    p_tenant_id, p_tournament_id, 'commit_group_schedule', p_idempotency_key, v_fp
  );
  IF NOT coalesce((v_cmd->>'ok')::boolean, false) THEN RETURN v_cmd; END IF;
  IF coalesce((v_cmd->>'replay')::boolean, false) THEN RETURN v_cmd->'result'; END IF;

  SELECT * INTO v_t FROM public.canonical_tournaments
    WHERE id = p_tournament_id AND tenant_id = p_tenant_id AND club_id = p_club_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;
  IF v_t.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_MODE_INVALID');
  END IF;
  IF p_expected_version IS DISTINCT FROM v_t.version THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version, 'actualVersion', v_t.version
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.court_reservations
    WHERE tournament_id = p_tournament_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_RESERVATION_REQUIRED');
  END IF;
  SELECT * INTO v_res FROM public.court_reservations
    WHERE tournament_id = p_tournament_id AND status = 'active' LIMIT 1;
  v_win := tstzrange(v_res.starts_at, v_res.ends_at, '[)');

  v_payload := coalesce(v_t.payload, '{}'::jsonb);
  v_events := CASE WHEN jsonb_typeof(v_payload->'events') = 'array' THEN v_payload->'events' ELSE '[]'::jsonb END;
  v_eid := nullif(trim(coalesce(p_event_id, '')), '');
  SELECT e.event INTO v_event
  FROM jsonb_array_elements(v_events) e(event)
  WHERE v_eid IS NOT NULL AND coalesce(e.event->>'id','') = v_eid
  LIMIT 1;
  IF v_event IS NULL THEN
    SELECT e.event INTO v_event FROM jsonb_array_elements(v_events) e(event) LIMIT 1;
  END IF;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_STATE_INVALID');
  END IF;

  v_existing := coalesce((
    SELECT jsonb_agg(m.match)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_event->'matches')='array' THEN v_event->'matches' ELSE '[]'::jsonb END) m(match)
    WHERE coalesce(m.match->>'bracketMatchId','') = ''
  ), '[]'::jsonb);
  v_proposed := CASE WHEN jsonb_typeof(p_matches)='array' THEN p_matches ELSE '[]'::jsonb END;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_proposed) p
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_existing) e
      WHERE coalesce(e->>'id', e->>'matchId') = coalesce(p->>'id', p->>'matchId')
    )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_existing) e
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_proposed) p
      WHERE coalesce(p->>'id', p->>'matchId') = coalesce(e->>'id', e->>'matchId')
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_MATCH_UNKNOWN');
  END IF;

  FOR v_match IN SELECT * FROM jsonb_array_elements(v_proposed) LOOP
    IF nullif(trim(coalesce(v_match->>'courtId','')), '') IS NULL
       OR nullif(trim(coalesce(v_match->>'scheduledStart','')), '') IS NULL
       OR nullif(trim(coalesce(v_match->>'scheduledEnd','')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_MATCH_UNKNOWN');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.court_reservations
      WHERE tournament_id = p_tournament_id AND status = 'active'
        AND court_id = v_match->>'courtId'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_COURT_OUTSIDE_RESERVATION');
    END IF;
    IF NOT (
      tstzrange((v_match->>'scheduledStart')::timestamptz,
                (v_match->>'scheduledEnd')::timestamptz,
                '[)') <@ v_win
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_TIME_OUTSIDE_RESERVATION');
    END IF;
  END LOOP;

  FOR v_a IN SELECT * FROM jsonb_array_elements(v_proposed) LOOP
    FOR v_b IN SELECT * FROM jsonb_array_elements(v_proposed) LOOP
      IF coalesce(v_a->>'id', v_a->>'matchId') >= coalesce(v_b->>'id', v_b->>'matchId') THEN
        CONTINUE;
      END IF;
      IF v_a->>'courtId' = v_b->>'courtId'
         AND tstzrange((v_a->>'scheduledStart')::timestamptz, (v_a->>'scheduledEnd')::timestamptz, '[)')
          && tstzrange((v_b->>'scheduledStart')::timestamptz, (v_b->>'scheduledEnd')::timestamptz, '[)') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_COURT_CONFLICT');
      END IF;
      IF (
           coalesce(v_a->>'entryAId','') IN (v_b->>'entryAId', v_b->>'entryBId')
        OR coalesce(v_a->>'entryBId','') IN (v_b->>'entryAId', v_b->>'entryBId')
      ) AND coalesce(v_a->>'entryAId','') <> ''
        AND tstzrange((v_a->>'scheduledStart')::timestamptz, (v_a->>'scheduledEnd')::timestamptz, '[)')
         && tstzrange((v_b->>'scheduledStart')::timestamptz, (v_b->>'scheduledEnd')::timestamptz, '[)') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_PAIR_CONFLICT');
      END IF;
    END LOOP;
  END LOOP;

  v_next := coalesce((
    SELECT jsonb_agg(
      CASE WHEN coalesce(m.match->>'bracketMatchId','') = '' THEN
        (
          SELECT m.match || jsonb_build_object(
            'courtId', p->>'courtId',
            'scheduledStart', p->>'scheduledStart',
            'scheduledEnd', p->>'scheduledEnd'
          )
          FROM jsonb_array_elements(v_proposed) p
          WHERE coalesce(p->>'id', p->>'matchId') = coalesce(m.match->>'id', m.match->>'matchId')
          LIMIT 1
        )
      ELSE m.match END
      ORDER BY m.ord
    )
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_event->'matches')='array' THEN v_event->'matches' ELSE '[]'::jsonb END)
      WITH ORDINALITY AS m(match, ord)
  ), '[]'::jsonb);
  v_event := jsonb_set(v_event, '{matches}', v_next, true);
  v_events := coalesce((
    SELECT jsonb_agg(CASE WHEN coalesce(e.event->>'id','') = coalesce(v_event->>'id','') THEN v_event ELSE e.event END ORDER BY e.ord)
    FROM jsonb_array_elements(v_events) WITH ORDINALITY AS e(event, ord)
  ), '[]'::jsonb);
  v_payload := jsonb_set(v_payload, '{events}', v_events, true);

  UPDATE public.canonical_tournaments
    SET payload = v_payload, version = v_t.version + 1, updated_at = v_now
    WHERE id = p_tournament_id;
  SELECT * INTO v_t FROM public.canonical_tournaments WHERE id = p_tournament_id;
  PERFORM public.court_reservation_finish_command(
    p_tenant_id, p_tournament_id, 'commit_group_schedule', p_idempotency_key, v_fp,
    jsonb_build_object('ok', true, 'tournament', to_jsonb(v_t), 'version', v_t.version)
  );
  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(v_t), 'version', v_t.version);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END
$$;

-- Daily assign/change: consult shared occupancy. Preserve close/gender/CAS/idempotency.
CREATE OR REPLACE FUNCTION public.daily_play_assign_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_cid text:=nullif(trim(coalesce(p_court_id,'')),''); v_candidate text; v_courts jsonb; v_denied jsonb;
  v_avail jsonb;
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
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_m:=jsonb_set(v_m,'{status}','"assigned"',true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'assign_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_change_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_courts jsonb;
  v_mid text:=nullif(trim(coalesce(p_match_id,'')),''); v_cid text:=nullif(trim(coalesce(p_court_id,'')),'');
  v_denied jsonb; v_avail jsonb;
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
  v_m:=jsonb_set(v_m,'{courtId}',to_jsonb(v_cid),true);
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'change_court',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.court_assert_available(text,text,text,timestamptz,timestamptz,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.official_tournament_inventory_courts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.official_tournament_reserve_courts(text,text,uuid,jsonb,text,text,text,text,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.official_tournament_commit_group_schedule(text,text,uuid,text,jsonb,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.court_reservation_begin_command(text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_reservation_finish_command(text,uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.official_tournament_reserve_courts(text,text,uuid,jsonb,text,text,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.official_tournament_commit_group_schedule(text,text,uuid,text,jsonb,bigint,text) TO authenticated;
-- court_assert_available is internal (called by SECURITY DEFINER RPCs only).
REVOKE ALL ON FUNCTION public.court_assert_available(text,text,text,timestamptz,timestamptz,uuid,boolean,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.official_tournament_inventory_courts(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_assign_court(text,text,uuid,text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_play_change_court(text,text,uuid,text,text,integer,text) TO authenticated;

COMMIT;

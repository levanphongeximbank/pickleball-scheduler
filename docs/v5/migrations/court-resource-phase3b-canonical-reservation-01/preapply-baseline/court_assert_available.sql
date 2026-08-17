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

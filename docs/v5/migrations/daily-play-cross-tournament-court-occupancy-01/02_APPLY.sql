-- Daily Play cross-tournament court occupancy snapshot.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Additive function replace only. No table DML. No backfill. No lease mutation.
-- Does not weaken daily_play_court_leases_one_active_court_uidx.

BEGIN;

CREATE OR REPLACE FUNCTION public.daily_play_snapshot(
  p_tenant_id text, p_club_id text, p_tournament_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_state jsonb;
  v_courts jsonb;
  v_leases jsonb;
  v_occupied jsonb;
BEGIN
  SELECT * INTO v_t FROM public.canonical_tournaments
  WHERE id = p_tournament_id AND tenant_id = p_tenant_id
    AND club_id = p_club_id AND mode = 'daily_play';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  v_state := coalesce(v_t.payload#>'{settings,dailyPlay}', '{}'::jsonb);
  v_state := jsonb_set(v_state, '{revision}', to_jsonb(coalesce(
    CASE WHEN (v_state->>'revision') ~ '^[0-9]+$'
      THEN (v_state->>'revision')::integer END, 0
  )), true);
  v_state := jsonb_set(v_state, '{checkedInPlayerIds}',
    CASE WHEN jsonb_typeof(v_state->'checkedInPlayerIds') = 'array'
      THEN v_state->'checkedInPlayerIds' ELSE '[]'::jsonb END, true);
  v_state := jsonb_set(v_state, '{matches}',
    CASE WHEN jsonb_typeof(v_state->'matches') = 'array'
      THEN v_state->'matches' ELSE '[]'::jsonb END, true);

  v_courts := public.daily_play_read_courts(
    p_club_id,
    CASE WHEN v_state ? 'enabledCourtIds' THEN v_state->'enabledCourtIds' ELSE NULL END
  );
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'matchId', l.match_id, 'courtId', l.court_id, 'leasedAt', l.leased_at
  ) ORDER BY l.leased_at), '[]'::jsonb)
  INTO v_leases
  FROM public.daily_play_court_leases l
  WHERE l.tenant_id = p_tenant_id AND l.club_id = p_club_id
    AND l.tournament_id = p_tournament_id AND l.status = 'active';

  -- Club-wide occupancy truth. Court IDs only. Do not project other
  -- tournament/match/player/score metadata.
  SELECT coalesce(jsonb_agg(l.court_id ORDER BY l.court_id), '[]'::jsonb)
  INTO v_occupied
  FROM public.daily_play_court_leases l
  WHERE l.tenant_id = p_tenant_id
    AND l.club_id = p_club_id
    AND l.status = 'active';

  RETURN jsonb_build_object(
    'ok', true, 'tournamentId', p_tournament_id, 'state', v_state,
    'courts', v_courts, 'activeLeases', v_leases,
    'occupiedCourtIds', v_occupied
  );
END
$$;

REVOKE ALL ON FUNCTION public.daily_play_snapshot(text,text,uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

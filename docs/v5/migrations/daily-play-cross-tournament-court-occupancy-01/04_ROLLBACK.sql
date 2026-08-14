-- Daily Play cross-tournament court occupancy rollback.
-- DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Restores the prior daily_play_snapshot contract. No data deletion. No lease mutation.

BEGIN;

DO $$
DECLARE
  v_snapshot_count int;
  v_get_state_count int;
  v_snapshot_def text;
BEGIN
  IF to_regprocedure('public.daily_play_snapshot(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL: unexpected snapshot signature missing';
  END IF;
  IF to_regprocedure('public.daily_play_get_state(text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL: unexpected get_state signature missing';
  END IF;

  SELECT count(*) INTO v_snapshot_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_snapshot';
  IF v_snapshot_count <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL: later snapshot schema version detected, overload count=%',
      v_snapshot_count;
  END IF;

  SELECT count(*) INTO v_get_state_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'daily_play_get_state';
  IF v_get_state_count <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL: later get_state schema version detected, overload count=%',
      v_get_state_count;
  END IF;

  v_snapshot_def := pg_get_functiondef(
    'public.daily_play_snapshot(text,text,uuid)'::regprocedure
  );
  IF v_snapshot_def NOT ILIKE '%occupiedCourtIds%' THEN
    RAISE EXCEPTION 'ROLLBACK_FAIL: occupancy field not present; refusing to clobber an unexpected snapshot body';
  END IF;
END
$$;

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

  RETURN jsonb_build_object(
    'ok', true, 'tournamentId', p_tournament_id, 'state', v_state,
    'courts', v_courts, 'activeLeases', v_leases
  );
END
$$;

REVOKE ALL ON FUNCTION public.daily_play_snapshot(text,text,uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

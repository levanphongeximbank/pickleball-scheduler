-- Court Resource Phase 3B/4D Daily Play interval authority ROLLBACK.
-- Restores exact pre-4D acquire (Phase 3B body with now()+12h) and pre-4D start_match.
-- Does NOT remove Phase 3B. LOCAL AUTHORING ONLY.

BEGIN;

DROP FUNCTION IF EXISTS public.court_resource_daily_play_extend_capacity_if_needed(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.court_resource_daily_play_venue_capacity_end(text, timestamptz);

DROP TABLE IF EXISTS public.daily_play_court_capacity_windows;

-- Restore Phase 3B court_resource_daily_play_acquire (pre-4D arbitrary horizon).
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

-- Restore pre-4D daily_play_start_match (no capacity extension touch).
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

REVOKE ALL ON FUNCTION public.court_resource_daily_play_acquire(text, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_play_start_match(text, text, uuid, text, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_play_start_match(text, text, uuid, text, integer, text)
  TO authenticated;

UPDATE public.court_resource_reservation_cutover
SET enabled = false,
    updated_at = now()
WHERE cutover_id = 'canonical-reservation-phase3b'
  AND enabled IS DISTINCT FROM false;

COMMIT;

SELECT 'PHASE4D_ROLLBACK' AS check_item, true AS ok;
SELECT 'PRE4D_ACQUIRE_RESTORED' AS check_item,
  (
    pg_get_functiondef(
      'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
    ) ILIKE '%now() + interval ''12 hours''%'
  ) AS ok;
SELECT 'CAPACITY_WINDOWS_DROPPED' AS check_item,
  (to_regclass('public.daily_play_court_capacity_windows') IS NULL) AS ok;
SELECT 'PHASE3B_INTACT' AS check_item,
  (to_regclass('public.court_resource_reservations') IS NOT NULL) AS ok;

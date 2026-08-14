-- Official/Open canonical court reservation 01 ROLLBACK.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Restores exact Daily #424 assign/change bodies and pre-package canonical_tournament_update.
-- Does not replay Daily #424 package. Does not drop daily_play_court_leases.

BEGIN;

DO $$
DECLARE
  v_runtime bigint := 0;
  v_mutated_backfill bigint := 0;
  v_ledger_runtime bigint := 0;
BEGIN
  IF to_regclass('public.court_reservations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='court_reservations' AND column_name='origin'
    ) THEN
      SELECT count(*) INTO v_runtime
      FROM public.court_reservations
      WHERE origin = 'runtime';
      SELECT count(*) INTO v_mutated_backfill
      FROM public.court_reservations
      WHERE origin = 'package_backfill'
        AND updated_at IS DISTINCT FROM created_at;
    ELSE
      SELECT count(*) INTO v_runtime FROM public.court_reservations WHERE status = 'active';
    END IF;
  END IF;
  IF to_regclass('public.court_reservation_command_ledger') IS NOT NULL THEN
    SELECT count(*) INTO v_ledger_runtime
    FROM public.court_reservation_command_ledger
    WHERE command IN ('reserve_courts', 'commit_group_schedule');
  END IF;
  IF v_runtime > 0 OR v_mutated_backfill > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK_UNSAFE: runtime_rows=% mutated_backfill=% — fail closed',
      v_runtime, v_mutated_backfill;
  END IF;
  IF v_ledger_runtime > 0 THEN
    RAISE EXCEPTION 'ROLLBACK_UNSAFE: runtime command ledger rows=% — fail closed', v_ledger_runtime;
  END IF;
END
$$;

-- Remove unmutated package-created backfill rows only.
DELETE FROM public.court_reservations
 WHERE origin = 'package_backfill'
   AND updated_at IS NOT DISTINCT FROM created_at;

-- Restore Daily #424 bodies BEFORE dropping court_assert_available.
CREATE OR REPLACE FUNCTION public.daily_play_assign_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_t public.canonical_tournaments%ROWTYPE; v_s jsonb; v_cmd jsonb; v_result jsonb;
  v_actual int; v_matches jsonb; v_m jsonb; v_mid text:=nullif(trim(coalesce(p_match_id,'')),'');
  v_cid text:=nullif(trim(coalesce(p_court_id,'')),''); v_candidate text; v_courts jsonb; v_denied jsonb;
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
  v_denied jsonb;
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
DROP FUNCTION IF EXISTS public.canonical_tournament_update(text, text, uuid, jsonb, bigint);

CREATE OR REPLACE FUNCTION public.canonical_tournament_update(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_patch jsonb
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

  UPDATE public.canonical_tournaments t
  SET
    name = COALESCE(nullif(trim(p_patch->>'name'), ''), t.name),
    status = COALESCE(nullif(trim(p_patch->>'status'), ''), t.status),
    season_id = CASE WHEN p_patch ? 'season_id' THEN nullif(trim(p_patch->>'season_id'), '') ELSE t.season_id END,
    league_id = CASE WHEN p_patch ? 'league_id' THEN nullif(trim(p_patch->>'league_id'), '') ELSE t.league_id END,
    payload = CASE WHEN p_patch ? 'payload' THEN p_patch->'payload' ELSE t.payload END,
    engine_v4 = CASE WHEN p_patch ? 'engine_v4' THEN p_patch->'engine_v4' ELSE t.engine_v4 END,
    updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO row_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END;
$$;
DROP FUNCTION IF EXISTS public.official_tournament_commit_group_schedule(text, text, uuid, text, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.official_tournament_reserve_courts(text, text, uuid, jsonb, text, text, text, text, bigint, text);
DROP FUNCTION IF EXISTS public.official_tournament_inventory_courts(text);
DROP FUNCTION IF EXISTS public.court_assert_available(text, text, text, timestamptz, timestamptz, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.court_reservation_finish_command(text, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.court_reservation_begin_command(text, uuid, text, text, text);

DROP TABLE IF EXISTS public.court_reservation_command_ledger;
DROP TABLE IF EXISTS public.court_reservations;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.canonical_tournaments WHERE coalesce(version, 1) > 1
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_UNSAFE: canonical_tournaments.version already used';
  END IF;
  ALTER TABLE public.canonical_tournaments DROP COLUMN IF EXISTS version;
END
$$;

REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;

COMMIT;

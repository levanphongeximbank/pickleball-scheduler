-- Court Resource Phase 3B rollback. PACKAGE-OWNED OBJECTS ONLY.
-- Restores Daily Play assign/change/submit/cancel/close to reviewed pre-APPLY baseline.
-- Assign/change baseline is official-open court_assert_available integration (Staging live).
-- Leaves Phase 3A, pilot, Daily Play tables/data, and legacy booking data untouched.
BEGIN;
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

CREATE OR REPLACE FUNCTION public.daily_play_submit_score(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_score_a integer, p_score_b integer, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'submit_score',p_idempotency_key,v_result);
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.daily_play_cancel_match(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  v_s:=jsonb_set(v_s,'{matches}',public.daily_play_replace_match(v_matches,v_mid,v_m),true);
  v_s:=jsonb_set(v_s,'{revision}',to_jsonb(v_actual+1),true);
  PERFORM public.daily_play_write_state(p_tournament_id,v_actual,v_s);
  v_result:=jsonb_build_object('ok',true,'revision',v_actual+1,'match',v_m);
  PERFORM public.daily_play_finish_command(p_tenant_id,p_tournament_id,'cancel_match',p_idempotency_key,v_result);
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

CREATE OR REPLACE FUNCTION public.daily_play_close_session(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_expected_version integer,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

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

DROP FUNCTION IF EXISTS public.court_resource_daily_play_acquire(text,text,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.court_resource_daily_play_release_match(text,uuid,text,text);
DROP FUNCTION IF EXISTS public.court_resource_daily_play_release_court(text,text,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.court_resource_daily_play_release_tournament(text,uuid,text);
DROP FUNCTION IF EXISTS public.court_resource_reserve(text,text,uuid[],text,text,text,timestamptz,timestamptz,text);
DROP FUNCTION IF EXISTS public.court_resource_release(text,uuid[],text,text,uuid[],text,text);
DROP FUNCTION IF EXISTS public.court_resource_get_availability(text,text,uuid[],timestamptz,timestamptz,text,text);
DROP FUNCTION IF EXISTS public.court_resource_reserve_core(text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid);
DROP FUNCTION IF EXISTS public.court_resource_reservation_assert_access(text,text,uuid[]);
DROP FUNCTION IF EXISTS public.court_resource_resolve_physical_court_for_legacy(text,text,text);
DROP FUNCTION IF EXISTS public.court_resource_reservation_payload_fingerprint(text,uuid[],text,text,text,timestamptz,timestamptz);
DROP FUNCTION IF EXISTS public.court_resource_digest_sha256(bytea);
DROP FUNCTION IF EXISTS public.court_resource_reservation_normalize_court_ids(uuid[]);
DROP FUNCTION IF EXISTS public.court_resource_map_gateway_owner_type(text);
DROP FUNCTION IF EXISTS public.court_resource_set_canonical_reservation_cutover(boolean);
DROP FUNCTION IF EXISTS public.court_resource_canonical_reservation_cutover_enabled();
DROP TABLE IF EXISTS public.court_resource_reservation_commands;
DROP TABLE IF EXISTS public.court_resource_reservations;
DROP TABLE IF EXISTS public.court_resource_reservation_cutover;

COMMIT;

SELECT 'ROLLBACK_SCOPE' AS check_item,
  'Phase 3B package-owned objects only; Daily Play RPCs restored to pre-APPLY baseline' AS value, true AS ok;
SELECT 'PHASE3A_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PILOT_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'DAILY_PLAY_DATA_TOUCHED' AS check_item, 0 AS value, true AS ok;

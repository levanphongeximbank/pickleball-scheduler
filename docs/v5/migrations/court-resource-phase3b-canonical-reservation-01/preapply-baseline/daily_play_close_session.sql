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

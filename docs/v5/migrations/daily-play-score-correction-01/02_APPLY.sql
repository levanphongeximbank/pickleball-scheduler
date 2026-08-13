-- Daily Play canonical score correction RPC.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Additive only. Does not weaken daily_play_submit_score.
-- Does not create leases, player reservations, or rating/VPR updates.

BEGIN;

CREATE OR REPLACE FUNCTION public.daily_play_correct_score(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_score_a integer,
  p_score_b integer,
  p_expected_version integer,
  p_idempotency_key text,
  p_note text
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
  v_m jsonb;
  v_mid text := nullif(trim(coalesce(p_match_id, '')), '');
  v_old_a int;
  v_old_b int;
  v_log jsonb;
  v_seed jsonb;
  v_entry jsonb;
  v_actor text;
  v_note text;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_t
  FROM public.canonical_tournaments
  WHERE id = p_tournament_id
    AND tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND mode = 'daily_play'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  v_cmd := public.daily_play_begin_command(
    p_tenant_id, p_tournament_id, 'correct_score', p_idempotency_key
  );
  IF NOT coalesce((v_cmd->>'ok')::boolean, false) THEN
    RETURN v_cmd;
  END IF;
  IF (v_cmd->>'replay')::boolean THEN
    RETURN v_cmd->'result';
  END IF;

  IF p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a < 0 OR p_score_b < 0
     OR p_score_a = p_score_b THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCORE');
  END IF;

  v_s := coalesce(v_t.payload#>'{settings,dailyPlay}', '{}'::jsonb);
  v_actual := coalesce(
    CASE WHEN (v_s->>'revision') ~ '^[0-9]+$' THEN (v_s->>'revision')::int END,
    0
  );
  v_matches := CASE WHEN jsonb_typeof(v_s->'matches') = 'array' THEN v_s->'matches' ELSE '[]'::jsonb END;

  SELECT value INTO v_m
  FROM jsonb_array_elements(v_matches)
  WHERE coalesce(value->>'id', value->>'matchId') = v_mid;
  IF v_m IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  END IF;

  IF v_m->>'status' IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MATCH_NOT_COMPLETED');
  END IF;

  v_old_a := CASE WHEN (v_m->>'scoreA') ~ '^-?[0-9]+$' THEN (v_m->>'scoreA')::int END;
  v_old_b := CASE WHEN (v_m->>'scoreB') ~ '^-?[0-9]+$' THEN (v_m->>'scoreB')::int END;
  IF v_old_a IS NULL OR v_old_b IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCORE');
  END IF;

  IF v_old_a = p_score_a AND v_old_b = p_score_b THEN
    v_result := jsonb_build_object(
      'ok', true,
      'revision', v_actual,
      'match', v_m,
      'replay', true,
      'ratingVprApplied', false
    );
    PERFORM public.daily_play_finish_command(
      p_tenant_id, p_tournament_id, 'correct_score', p_idempotency_key, v_result
    );
    RETURN v_result;
  END IF;

  -- Stale expectedVersion → VERSION_CONFLICT (CAS). Mutation readback then applies.
  IF p_expected_version IS DISTINCT FROM v_actual THEN
    RETURN public.daily_play_version_conflict(p_expected_version, v_actual);
  END IF;

  v_actor := coalesce(nullif(auth.uid()::text, ''), 'BTC');
  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_log := CASE WHEN jsonb_typeof(v_m->'scoreLog') = 'array' THEN v_m->'scoreLog' ELSE '[]'::jsonb END;

  IF jsonb_array_length(v_log) = 0 THEN
    v_seed := jsonb_build_object(
      'id', 'log-orig-' || v_mid,
      'at', coalesce(v_m->>'completedAt', now()::text),
      'source', 'director',
      'action', 'finalized',
      'actorName', 'Hệ thống',
      'matchId', v_mid,
      'oldScoreA', 0,
      'oldScoreB', 0,
      'scoreA', v_old_a,
      'scoreB', v_old_b,
      'note', 'Điểm gốc khi hoàn tất'
    );
    v_log := v_log || v_seed;
  END IF;

  v_entry := jsonb_build_object(
    'id', 'log-correct-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    'at', now(),
    'source', 'director',
    'action', 'admin_override',
    'actorName', v_actor,
    'matchId', v_mid,
    'oldScoreA', v_old_a,
    'oldScoreB', v_old_b,
    'scoreA', p_score_a,
    'scoreB', p_score_b,
    'note', coalesce(v_note, 'Sửa điểm trận đã hoàn tất')
  );
  v_log := v_log || v_entry;

  v_m := jsonb_set(v_m, '{scoreA}', to_jsonb(p_score_a), true);
  v_m := jsonb_set(v_m, '{scoreB}', to_jsonb(p_score_b), true);
  v_m := jsonb_set(v_m, '{winner}', to_jsonb(CASE WHEN p_score_a > p_score_b THEN 'A' ELSE 'B' END), true);
  v_m := jsonb_set(v_m, '{winnerSide}', to_jsonb(CASE WHEN p_score_a > p_score_b THEN 'A' ELSE 'B' END), true);
  v_m := jsonb_set(v_m, '{status}', '"completed"', true);
  v_m := jsonb_set(v_m, '{correctedAt}', to_jsonb(now()), true);
  v_m := jsonb_set(v_m, '{scoreLog}', v_log, true);

  v_s := jsonb_set(v_s, '{matches}', public.daily_play_replace_match(v_matches, v_mid, v_m), true);
  v_s := jsonb_set(v_s, '{revision}', to_jsonb(v_actual + 1), true);
  PERFORM public.daily_play_write_state(p_tournament_id, v_actual, v_s);

  v_result := jsonb_build_object(
    'ok', true,
    'revision', v_actual + 1,
    'match', v_m,
    'ratingVprApplied', false
  );
  PERFORM public.daily_play_finish_command(
    p_tenant_id, p_tournament_id, 'correct_score', p_idempotency_key, v_result
  );
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.daily_play_correct_score(
  text, text, uuid, text, integer, integer, integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_play_correct_score(
  text, text, uuid, text, integer, integer, integer, text, text
) TO authenticated;

COMMIT;

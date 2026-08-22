-- Official/Open authenticated referee discovery rollback.
-- Safe schema-only rollback: no table, business row, token, or live row deletion.
-- Run only after separate Owner authorization.
-- Restores exact pre-discovery Staging bodies/grants, including
-- official_open_ensure_match_live FOR SHARE. Creator FOR UPDATE is not preserved.

BEGIN;

-- Restore exact pre-discovery Referee→Completion token RPC behavior/grants.

CREATE OR REPLACE FUNCTION public.official_open_ensure_match_live(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_labels jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_token text;
  v_live public.tournament_match_live%ROWTYPE;
  v_id text;
  v_target int;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  v_found := public.official_open_find_match(v_row.payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err('MATCH_NOT_FOUND', 'Không tìm thấy trận trong giải này.');
  END IF;
  v_match := v_found->'match';
  v_token := public.official_open_assignment_token(v_row.payload, v_match);
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RETURN public.official_open_json_err('NO_REFEREE_TOKEN', 'Trận chưa có token trọng tài.');
  END IF;
  v_target := public.official_open_round_target(v_row.payload, v_match);
  v_id := p_club_id || '::' || p_tournament_id::text || '::' || p_match_id;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_live.status IN ('processed', 'locked') THEN
      RETURN jsonb_build_object('ok', true, 'created', false, 'id', v_live.id, 'status', v_live.status);
    END IF;
    UPDATE public.tournament_match_live
    SET referee_token = v_token,
        referee_name = COALESCE(NULLIF(p_labels->>'refereeName', ''), referee_name),
        tournament_name = COALESCE(NULLIF(p_labels->>'tournamentName', ''), NULLIF(v_row.name, ''), tournament_name),
        entry_a_label = COALESCE(NULLIF(p_labels->>'entryALabel', ''), official_open_entry_name(v_row.payload, v_match->>'entryAId'), entry_a_label),
        entry_b_label = COALESCE(NULLIF(p_labels->>'entryBLabel', ''), official_open_entry_name(v_row.payload, v_match->>'entryBId'), entry_b_label),
        court_label = COALESCE(NULLIF(p_labels->>'courtLabel', ''), court_label),
        stage_label = COALESCE(NULLIF(p_labels->>'stageLabel', ''), stage_label),
        scoring_method = 'rally',
        scoring_target = v_target,
        scheduled_start = COALESCE(NULLIF(p_labels->>'scheduledStart', ''), NULLIF(v_match->>'scheduledStart', ''), scheduled_start),
        updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_live;
    RETURN jsonb_build_object('ok', true, 'created', false, 'id', v_live.id, 'status', v_live.status);
  END IF;
  INSERT INTO public.tournament_match_live (
    id, club_id, tournament_id, event_id, match_id, referee_token, referee_name,
    tournament_name, entry_a_label, entry_b_label, court_label, stage_label,
    score_a, score_b, status, is_daily, audit_log, updated_at,
    live_revision, scoring_target, scoring_method, scheduled_start
  ) VALUES (
    v_id,
    p_club_id,
    p_tournament_id::text,
    COALESCE(v_found->>'eventId', ''),
    p_match_id,
    v_token,
    COALESCE(NULLIF(p_labels->>'refereeName', ''), COALESCE(v_match->'referee'->>'name', 'Trọng tài')),
    COALESCE(NULLIF(p_labels->>'tournamentName', ''), v_row.name, 'Giải Official'),
    COALESCE(NULLIF(p_labels->>'entryALabel', ''), public.official_open_entry_name(v_row.payload, v_match->>'entryAId'), 'Cặp A'),
    COALESCE(NULLIF(p_labels->>'entryBLabel', ''), public.official_open_entry_name(v_row.payload, v_match->>'entryBId'), 'Cặp B'),
    COALESCE(NULLIF(p_labels->>'courtLabel', ''), ''),
    COALESCE(NULLIF(p_labels->>'stageLabel', ''), ''),
    0, 0, 'playing', false, '[]'::jsonb, now(),
    1, v_target, 'rally',
    COALESCE(NULLIF(p_labels->>'scheduledStart', ''), COALESCE(v_match->>'scheduledStart', ''))
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_live;
  IF v_live.id IS NULL THEN
    SELECT * INTO v_live FROM public.tournament_match_live WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'created', true, 'id', v_live.id, 'status', v_live.status);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ensure_match_live(text, text, uuid, text, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_ensure_match_live(text, text, uuid, text, jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_referee_get_match(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_target int;
  v_canonical jsonb := NULL;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_live.tournament_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  v_found := public.official_open_find_match(v_row.payload, v_live.match_id);
  v_match := CASE WHEN v_found IS NULL THEN '{}'::jsonb ELSE v_found->'match' END;
  v_target := COALESCE(v_live.scoring_target, public.official_open_round_target(v_row.payload, v_match));
  IF v_match->>'status' IN ('completed', 'forfeit') THEN
    v_canonical := jsonb_build_object(
      'scoreA', NULLIF(v_match->>'scoreA', '')::int,
      'scoreB', NULLIF(v_match->>'scoreB', '')::int,
      'winnerName', public.official_open_entry_name(v_row.payload, COALESCE(v_match->>'winnerId', '')),
      'status', v_match->>'status'
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'matchId', v_live.match_id,
    'tournamentName', COALESCE(NULLIF(v_live.tournament_name, ''), v_row.name),
    'stageLabel', COALESCE(NULLIF(v_live.stage_label, ''), ''),
    'entryALabel', COALESCE(NULLIF(v_live.entry_a_label, ''), 'Cặp A'),
    'entryBLabel', COALESCE(NULLIF(v_live.entry_b_label, ''), 'Cặp B'),
    'courtLabel', COALESCE(NULLIF(v_live.court_label, ''), ''),
    'scheduledStart', COALESCE(NULLIF(v_live.scheduled_start, ''), COALESCE(v_match->>'scheduledStart', '')),
    'scoringMethod', 'rally',
    'scoringMethodLabel', 'Rally',
    'targetScore', v_target,
    'scoreA', v_live.score_a,
    'scoreB', v_live.score_b,
    'status', v_live.status,
    'liveRevision', v_live.live_revision,
    'finalized', v_live.status IN ('processed', 'locked') OR COALESCE(v_match->>'status', '') IN ('completed', 'forfeit'),
    'canonicalResult', v_canonical
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_referee_get_match(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_referee_get_match(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_adjust_live_score(
  p_token text,
  p_team text,
  p_delta int,
  p_expected_score_a int,
  p_expected_score_b int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_team text;
  v_next_a int;
  v_next_b int;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  v_team := upper(btrim(COALESCE(p_team, '')));
  IF v_team NOT IN ('A', 'B') OR p_delta IS NULL OR p_delta NOT IN (1, -1) THEN
    RETURN public.official_open_json_err('INVALID_ADJUST', 'Chỉ Rally ±1.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  IF v_live.status IS DISTINCT FROM 'playing' THEN
    RETURN public.official_open_json_err('LIVE_LOCKED', 'Trận đã khóa điểm live.');
  END IF;
  IF v_live.score_a IS DISTINCT FROM p_expected_score_a
     OR v_live.score_b IS DISTINCT FROM p_expected_score_b THEN
    RETURN public.official_open_json_err(
      'LIVE_VERSION_CONFLICT',
      'Điểm live đã đổi. Tải lại rồi chấm tiếp.',
      jsonb_build_object('scoreA', v_live.score_a, 'scoreB', v_live.score_b, 'liveRevision', v_live.live_revision)
    );
  END IF;
  IF v_team = 'A' THEN
    v_next_a := GREATEST(0, v_live.score_a + p_delta);
    v_next_b := v_live.score_b;
  ELSE
    v_next_a := v_live.score_a;
    v_next_b := GREATEST(0, v_live.score_b + p_delta);
  END IF;
  UPDATE public.tournament_match_live
  SET score_a = v_next_a,
      score_b = v_next_b,
      live_revision = live_revision + 1,
      updated_at = now()
  WHERE id = v_live.id
  RETURNING * INTO v_live;
  RETURN jsonb_build_object(
    'ok', true,
    'scoreA', v_live.score_a,
    'scoreB', v_live.score_b,
    'liveRevision', v_live.live_revision,
    'status', v_live.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_commit_match_result(
  p_token text,
  p_score_a int,
  p_score_b int,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_result jsonb;
  v_hash text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_live.tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  IF v_row.club_id IS DISTINCT FROM v_live.club_id THEN
    RETURN public.official_open_json_err('TENANT_MISMATCH', 'Trận không thuộc giải này.');
  END IF;
  v_hash := md5(v_live.match_id || ':' || p_score_a::text || ':' || p_score_b::text);
  v_replay := public.official_open_ledger_replay(
    v_row.tenant_id, v_row.club_id, v_row.id, 'commit_match_result', p_idempotency_key, v_hash
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;
  v_result := public.official_open_commit_core(v_row, v_live.match_id, p_score_a, p_score_b);
  IF COALESCE(v_result->>'ok', 'false') = 'true' THEN
    UPDATE public.tournament_match_live
    SET score_a = p_score_a,
        score_b = p_score_b,
        status = 'processed',
        live_revision = live_revision + 1,
        updated_at = now()
    WHERE id = v_live.id;
    v_result := v_result || jsonb_build_object('liveStatus', 'processed');
    v_result := public.official_open_ledger_put(
      v_row.tenant_id, v_row.club_id, v_row.id, 'commit_match_result', p_idempotency_key, v_hash, v_result
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_commit_match_result(text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_commit_match_result(text, int, int, text) TO anon, authenticated;

-- Restore exact pre-discovery legacy token RPC behavior/grants.

CREATE OR REPLACE FUNCTION public.referee_get_match_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournament_match_live%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE referee_token = trim(p_token)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'id', v_row.id,
    'match_id', v_row.match_id,
    'referee_token', v_row.referee_token,
    'referee_name', v_row.referee_name,
    'tournament_name', v_row.tournament_name,
    'stage_label', v_row.stage_label,
    'entry_a_label', v_row.entry_a_label,
    'entry_b_label', v_row.entry_b_label,
    'court_label', v_row.court_label,
    'score_a', v_row.score_a,
    'score_b', v_row.score_b,
    'status', v_row.status,
    'is_daily', v_row.is_daily,
    'audit_log', v_row.audit_log,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referee_get_match_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referee_get_match_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.referee_update_match_score(
  p_token text,
  p_payload jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournament_match_live%ROWTYPE;
  v_action text;
  v_team text;
  v_delta int;
  v_score_a int;
  v_score_b int;
  v_old_a int;
  v_old_b int;
  v_entry jsonb;
  v_audit jsonb;
  v_user_agent text;
  v_note text;
  v_now timestamptz := now();
  v_actor text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE referee_token = trim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_action := lower(COALESCE(p_payload->>'action', ''));
  v_user_agent := left(COALESCE(p_payload->>'userAgent', ''), 240);
  v_note := COALESCE(p_payload->>'note', '');
  v_actor := COALESCE(NULLIF(trim(v_row.referee_name), ''), 'Trọng tài');
  IF v_action = 'adjust' THEN
    IF v_row.status <> 'playing' THEN
      RETURN NULL;
    END IF;
    v_team := upper(COALESCE(p_payload->>'team', ''));
    v_delta := COALESCE((p_payload->>'delta')::int, 0);
    IF v_team NOT IN ('A', 'B') OR v_delta = 0 THEN
      RETURN NULL;
    END IF;
    v_old_a := v_row.score_a;
    v_old_b := v_row.score_b;
    IF v_team = 'A' THEN
      v_score_a := greatest(0, v_old_a + v_delta);
      v_score_b := v_old_b;
    ELSE
      v_score_a := v_old_a;
      v_score_b := greatest(0, v_old_b + v_delta);
    END IF;
    v_entry := jsonb_build_object(
      'id', 'log-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
      'at', to_char(v_now AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'source', 'referee',
      'action', 'adjust',
      'actorName', v_actor,
      'matchId', v_row.match_id,
      'refereeToken', v_row.referee_token,
      'team', v_team,
      'delta', v_delta,
      'oldScoreA', v_old_a,
      'oldScoreB', v_old_b,
      'scoreA', v_score_a,
      'scoreB', v_score_b,
      'userAgent', v_user_agent
    );
    v_audit := COALESCE(v_row.audit_log, '[]'::jsonb) || v_entry;
    UPDATE public.tournament_match_live
    SET score_a = v_score_a,
        score_b = v_score_b,
        audit_log = v_audit,
        updated_at = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSIF v_action = 'finalize' THEN
    IF v_row.status <> 'playing' THEN
      RETURN NULL;
    END IF;
    v_old_a := v_row.score_a;
    v_old_b := v_row.score_b;
    v_score_a := greatest(0, COALESCE((p_payload->>'scoreA')::int, v_old_a));
    v_score_b := greatest(0, COALESCE((p_payload->>'scoreB')::int, v_old_b));
    v_entry := jsonb_build_object(
      'id', 'log-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
      'at', to_char(v_now AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'source', 'referee',
      'action', 'finalized',
      'actorName', v_actor,
      'matchId', v_row.match_id,
      'refereeToken', v_row.referee_token,
      'team', '',
      'delta', 0,
      'oldScoreA', v_old_a,
      'oldScoreB', v_old_b,
      'scoreA', v_score_a,
      'scoreB', v_score_b,
      'userAgent', v_user_agent,
      'note', v_note
    );
    v_audit := COALESCE(v_row.audit_log, '[]'::jsonb) || v_entry;
    UPDATE public.tournament_match_live
    SET score_a = v_score_a,
        score_b = v_score_b,
        status = 'finalize_requested',
        audit_log = v_audit,
        updated_at = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'id', v_row.id,
    'match_id', v_row.match_id,
    'referee_token', v_row.referee_token,
    'referee_name', v_row.referee_name,
    'tournament_name', v_row.tournament_name,
    'stage_label', v_row.stage_label,
    'entry_a_label', v_row.entry_a_label,
    'entry_b_label', v_row.entry_b_label,
    'court_label', v_row.court_label,
    'score_a', v_row.score_a,
    'score_b', v_row.score_b,
    'status', v_row.status,
    'is_daily', v_row.is_daily,
    'audit_log', v_row.audit_log,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referee_update_match_score(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referee_update_match_score(text, jsonb) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.official_open_open_my_referee_match(uuid, text);
DROP FUNCTION IF EXISTS public.official_open_list_my_referee_assignments();
DROP FUNCTION IF EXISTS public.official_open_assert_current_referee_token(text);
DROP FUNCTION IF EXISTS public.official_open_resolve_authorized_assignment_token(jsonb, text);
DROP FUNCTION IF EXISTS public.official_open_referee_assignment_authorized(jsonb, text, uuid, text);
DROP FUNCTION IF EXISTS public.official_open_referee_assignment_identity(jsonb, text);

COMMIT;

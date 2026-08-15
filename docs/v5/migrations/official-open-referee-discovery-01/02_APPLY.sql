-- Official/Open authenticated referee discovery + secure open.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT SEPARATE OWNER GO STAGING.
-- Builds on official_open_referee_to_completion_01.
-- Does not mutate canonical Tournament rows or pre-create live rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.official_open_referee_assignment_identity(
  p_payload jsonb,
  p_match_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_found jsonb;
  v_assignment jsonb;
  v_canonical_user_id text;
  v_legacy_email text;
  v_status text;
BEGIN
  v_found := public.official_open_find_match(p_payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN jsonb_build_object('assigned', false);
  END IF;

  v_assignment := p_payload->'settings'->'refereeAssignments'->p_match_id;
  IF jsonb_typeof(v_assignment) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('assigned', false);
  END IF;
  IF COALESCE(NULLIF(v_assignment->>'matchId', ''), p_match_id) IS DISTINCT FROM p_match_id THEN
    RETURN jsonb_build_object('assigned', false);
  END IF;

  v_status := lower(COALESCE(v_assignment->>'status', 'assigned'));
  IF v_status IS DISTINCT FROM 'assigned' OR NULLIF(v_assignment->>'revokedAt', '') IS NOT NULL THEN
    RETURN jsonb_build_object('assigned', false);
  END IF;

  -- The exact assignment record is the only authenticated identity authority.
  v_canonical_user_id := COALESCE(
    NULLIF(v_assignment->>'canonicalUserId', ''),
    NULLIF(v_assignment->>'refereeUserId', '')
  );

  -- Legacy compatibility is allowed only from an explicit assignment email field.
  v_legacy_email := COALESCE(
    NULLIF(v_assignment->>'refereeEmail', ''),
    NULLIF(v_assignment->>'email', '')
  );

  RETURN jsonb_build_object(
    'assigned', true,
    'canonicalUserId', v_canonical_user_id,
    'legacyEmail', v_legacy_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_referee_assignment_identity(jsonb, text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_referee_assignment_authorized(
  p_payload jsonb,
  p_match_id text,
  p_user_id uuid,
  p_authenticated_email text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_identity jsonb;
  v_canonical_user_id text;
  v_stored_email text;
  v_session_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_identity := public.official_open_referee_assignment_identity(p_payload, p_match_id);
  IF COALESCE((v_identity->>'assigned')::boolean, false) IS NOT TRUE THEN
    RETURN false;
  END IF;

  v_canonical_user_id := NULLIF(btrim(v_identity->>'canonicalUserId'), '');
  IF v_canonical_user_id IS NOT NULL THEN
    RETURN v_canonical_user_id = p_user_id::text;
  END IF;

  -- Legacy fallback: exact normalized complete email only. No display-name,
  -- prefix, substring, username, roster-label, fuzzy, or similarity matching.
  v_stored_email := lower(btrim(COALESCE(v_identity->>'legacyEmail', '')));
  v_session_email := lower(btrim(COALESCE(p_authenticated_email, '')));
  IF v_stored_email = '' OR v_session_email = '' THEN
    RETURN false;
  END IF;
  IF v_stored_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' THEN
    RETURN false;
  END IF;
  IF v_session_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' THEN
    RETURN false;
  END IF;
  RETURN v_stored_email = v_session_email;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_referee_assignment_authorized(jsonb, text, uuid, text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_resolve_authorized_assignment_token(
  p_payload jsonb,
  p_match_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_found jsonb;
  v_match jsonb;
  v_assignment jsonb;
  v_assignment_token text;
  v_match_token text;
BEGIN
  v_found := public.official_open_find_match(p_payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err('MATCH_NOT_FOUND', 'Không tìm thấy trận trong giải.');
  END IF;

  v_match := v_found->'match';
  v_assignment := p_payload->'settings'->'refereeAssignments'->p_match_id;
  IF jsonb_typeof(v_assignment) IS DISTINCT FROM 'object'
     OR COALESCE(NULLIF(v_assignment->>'matchId', ''), p_match_id) IS DISTINCT FROM p_match_id
     OR lower(COALESCE(v_assignment->>'status', 'assigned')) IS DISTINCT FROM 'assigned'
     OR NULLIF(v_assignment->>'revokedAt', '') IS NOT NULL THEN
    RETURN public.official_open_json_err(
      'REFEREE_ASSIGNMENT_DENIED',
      'Phân công trọng tài không còn hiệu lực.'
    );
  END IF;

  -- settings.refereeAssignments[matchId].token is the sole release authority.
  v_assignment_token := v_assignment->>'token';
  IF NULLIF(btrim(COALESCE(v_assignment_token, '')), '') IS NULL THEN
    RETURN public.official_open_json_err(
      'ASSIGNMENT_TOKEN_MISSING',
      'Phân công canonical chưa có token trọng tài.'
    );
  END IF;
  IF v_assignment_token IS DISTINCT FROM btrim(v_assignment_token)
     OR length(v_assignment_token) < 16
     OR v_assignment_token LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err(
      'INVALID_TOKEN',
      'Token phân công canonical không hợp lệ.'
    );
  END IF;

  -- match.referee.token is a denormalized compatibility copy only.
  v_match_token := v_match->'referee'->>'token';
  IF NULLIF(btrim(COALESCE(v_match_token, '')), '') IS NOT NULL
     AND v_match_token IS DISTINCT FROM v_assignment_token THEN
    RETURN public.official_open_json_err(
      'TOKEN_BINDING_INCONSISTENT',
      'Token tại match không khớp token phân công canonical.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'token', v_assignment_token);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_resolve_authorized_assignment_token(jsonb, text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_assert_current_referee_token(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplied_token text := p_token;
  v_live public.tournament_match_live%ROWTYPE;
  v_live_id text;
  v_match_id text;
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_assignment jsonb;
  v_assignment_token text;
  v_match_token text;
BEGIN
  IF v_supplied_token IS NULL
     OR v_supplied_token IS DISTINCT FROM btrim(v_supplied_token)
     OR length(v_supplied_token) < 16
     OR v_supplied_token LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;

  -- Identity resolution only. No lock, and no authorization decision yet.
  SELECT *
  INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = v_supplied_token;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  v_live_id := v_live.id;
  v_match_id := v_live.match_id;

  SELECT *
  INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_live.tournament_id
    AND t.club_id = v_live.club_id
    AND t.mode = 'official_tournament'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err(
      'CURRENT_ASSIGNMENT_DENIED',
      'Live row không thuộc giải Official/Open canonical hiện hành.'
    );
  END IF;

  v_found := public.official_open_find_match(v_row.payload, v_match_id);
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err(
      'CURRENT_ASSIGNMENT_DENIED',
      'Trận không còn tồn tại trong giải canonical.'
    );
  END IF;
  v_match := v_found->'match';
  v_assignment := v_row.payload->'settings'->'refereeAssignments'->v_match_id;
  IF jsonb_typeof(v_assignment) IS DISTINCT FROM 'object'
     OR COALESCE(NULLIF(v_assignment->>'matchId', ''), v_match_id)
          IS DISTINCT FROM v_match_id
     OR lower(COALESCE(v_assignment->>'status', 'assigned')) IS DISTINCT FROM 'assigned'
     OR NULLIF(v_assignment->>'revokedAt', '') IS NOT NULL THEN
    RETURN public.official_open_json_err(
      'CURRENT_ASSIGNMENT_DENIED',
      'Phân công trọng tài hiện hành đã bị gỡ hoặc thu hồi.'
    );
  END IF;

  v_assignment_token := v_assignment->>'token';
  IF v_assignment_token IS NULL
     OR v_assignment_token IS DISTINCT FROM btrim(v_assignment_token)
     OR length(v_assignment_token) < 16
     OR v_assignment_token LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err(
      'ASSIGNMENT_TOKEN_MISSING',
      'Phân công hiện hành không có token hợp lệ.'
    );
  END IF;
  IF v_assignment_token IS DISTINCT FROM v_supplied_token THEN
    RETURN public.official_open_json_err(
      'STALE_REFEREE_TOKEN',
      'Token không còn thuộc phân công trọng tài hiện hành.'
    );
  END IF;

  v_match_token := v_match->'referee'->>'token';
  IF NULLIF(btrim(COALESCE(v_match_token, '')), '') IS NOT NULL
     AND v_match_token IS DISTINCT FROM v_assignment_token THEN
    RETURN public.official_open_json_err(
      'TOKEN_BINDING_INCONSISTENT',
      'Token tại match không khớp phân công hiện hành.'
    );
  END IF;

  SELECT *
  INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_live_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_live.club_id IS DISTINCT FROM v_row.club_id
     OR v_live.tournament_id IS DISTINCT FROM v_row.id::text
     OR v_live.match_id IS DISTINCT FROM v_match_id
     OR v_live.referee_token IS DISTINCT FROM v_supplied_token
     OR v_live.referee_token IS DISTINCT FROM v_assignment_token THEN
    RETURN public.official_open_json_err(
      'STALE_REFEREE_TOKEN',
      'Token không còn thuộc phân công trọng tài hiện hành.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'liveId', v_live.id,
    'tournamentId', v_row.id,
    'matchId', v_live.match_id,
    'clubId', v_live.club_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_assert_current_referee_token(text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_list_my_referee_assignments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := NULLIF(btrim(COALESCE(auth.jwt()->>'email', '')), '');
  v_tenant_id text := public.user_venue_id();
  v_assignments jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN public.official_open_json_err('NOT_AUTHENTICATED', 'Yêu cầu đăng nhập.');
  END IF;
  IF v_tenant_id IS NULL OR btrim(v_tenant_id) = '' THEN
    RETURN public.official_open_json_err('CROSS_TENANT_DENIED', 'Không xác định được tenant của trọng tài.');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tournamentId', t.id,
        'tournamentName', t.name,
        'competitionType', 'official_open',
        'matchId', match.value->>'id',
        'stage', COALESCE(match.value->>'stage', ''),
        'round', COALESCE(match.value->>'round', ''),
        'groupLabel', COALESCE(
          (
            SELECT COALESCE(group_item.value->>'label', group_item.value->>'name', match.value->>'groupId')
            FROM jsonb_array_elements(COALESCE(event.value->'groups', '[]'::jsonb)) AS group_item(value)
            WHERE group_item.value->>'id' = match.value->>'groupId'
            LIMIT 1
          ),
          match.value->>'groupId',
          ''
        ),
        'teamAName', public.official_open_entry_name(t.payload, match.value->>'entryAId'),
        'teamBName', public.official_open_entry_name(t.payload, match.value->>'entryBId'),
        'scheduledStart', COALESCE(match.value->>'scheduledStart', ''),
        'scheduledEnd', COALESCE(match.value->>'scheduledEnd', ''),
        'courtId', COALESCE(match.value->>'courtId', ''),
        'courtLabel', COALESCE(
          NULLIF(match.value->>'courtLabel', ''),
          CASE
            WHEN COALESCE(match.value->>'courtId', '') = '' THEN ''
            ELSE format('Sân %s', match.value->>'courtId')
          END
        ),
        'status', COALESCE(match.value->>'status', t.status),
        'canOpen', NULLIF(
          btrim(
            COALESCE(
              t.payload->'settings'->'refereeAssignments'->(match.value->>'id')->>'token',
              ''
            )
          ),
          ''
        ) IS NOT NULL
      )
      ORDER BY
        NULLIF(match.value->>'scheduledStart', '') NULLS LAST,
        t.updated_at DESC,
        match.value->>'id'
    ),
    '[]'::jsonb
  )
  INTO v_assignments
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.payload->'events', '[]'::jsonb)) AS event(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(event.value->'matches', '[]'::jsonb)) AS match(value)
  WHERE t.mode = 'official_tournament'
    AND t.tenant_id = v_tenant_id
    AND lower(COALESCE(t.status, '')) <> 'cancelled'
    AND public.official_open_referee_assignment_authorized(
      t.payload,
      match.value->>'id',
      v_user_id,
      v_email
    );

  RETURN jsonb_build_object('ok', true, 'assignments', v_assignments);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_list_my_referee_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_list_my_referee_assignments() TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_open_my_referee_match(
  p_tournament_id uuid,
  p_match_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := NULLIF(btrim(COALESCE(auth.jwt()->>'email', '')), '');
  v_tenant_id text := public.user_venue_id();
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_token text;
  v_token_result jsonb;
  v_live public.tournament_match_live%ROWTYPE;
  v_live_id text;
  v_target int;
  v_court_label text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN public.official_open_json_err('NOT_AUTHENTICATED', 'Yêu cầu đăng nhập.');
  END IF;
  IF p_tournament_id IS NULL OR p_match_id IS NULL OR btrim(p_match_id) = '' THEN
    RETURN public.official_open_json_err('INVALID_MATCH_SCOPE', 'Thiếu giải hoặc trận.');
  END IF;
  IF v_tenant_id IS NULL OR btrim(v_tenant_id) = '' THEN
    RETURN public.official_open_json_err('CROSS_TENANT_DENIED', 'Không xác định được tenant của trọng tài.');
  END IF;

  SELECT *
  INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id
    AND t.mode = 'official_tournament'
    AND t.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải Official/Open.');
  END IF;

  v_found := public.official_open_find_match(v_row.payload, btrim(p_match_id));
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err('MATCH_NOT_FOUND', 'Không tìm thấy trận trong giải.');
  END IF;
  v_match := v_found->'match';

  IF NOT public.official_open_referee_assignment_authorized(
    v_row.payload,
    btrim(p_match_id),
    v_user_id,
    v_email
  ) THEN
    RETURN public.official_open_json_err('REFEREE_ASSIGNMENT_DENIED', 'Bạn không được phân công trận này.');
  END IF;

  v_token_result := public.official_open_resolve_authorized_assignment_token(
    v_row.payload,
    btrim(p_match_id)
  );
  IF COALESCE(v_token_result->>'ok', 'false') <> 'true' THEN
    RETURN v_token_result;
  END IF;
  v_token := v_token_result->>'token';

  v_live_id := v_row.club_id || '::' || v_row.id::text || '::' || btrim(p_match_id);
  v_target := public.official_open_round_target(v_row.payload, v_match);
  v_court_label := COALESCE(
    NULLIF(v_match->>'courtLabel', ''),
    CASE
      WHEN COALESCE(v_match->>'courtId', '') = '' THEN ''
      ELSE format('Sân %s', v_match->>'courtId')
    END
  );

  SELECT *
  INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_live_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_live.club_id IS DISTINCT FROM v_row.club_id
       OR v_live.tournament_id IS DISTINCT FROM v_row.id::text
       OR v_live.match_id IS DISTINCT FROM btrim(p_match_id) THEN
      RETURN public.official_open_json_err('LIVE_SCOPE_CONFLICT', 'Live row không thuộc đúng trận.');
    END IF;
    IF v_live.referee_token IS DISTINCT FROM v_token THEN
      RETURN public.official_open_json_err(
        'LIVE_TOKEN_BINDING_INCONSISTENT',
        'Token live không khớp token phân công canonical.'
      );
    END IF;
    IF v_live.status NOT IN ('processed', 'locked') THEN
      UPDATE public.tournament_match_live
      SET
        referee_name = COALESCE(NULLIF(v_match->'referee'->>'name', ''), referee_name),
        tournament_name = COALESCE(NULLIF(v_row.name, ''), tournament_name),
        entry_a_label = COALESCE(
          NULLIF(public.official_open_entry_name(v_row.payload, v_match->>'entryAId'), ''),
          entry_a_label
        ),
        entry_b_label = COALESCE(
          NULLIF(public.official_open_entry_name(v_row.payload, v_match->>'entryBId'), ''),
          entry_b_label
        ),
        court_label = COALESCE(NULLIF(v_court_label, ''), court_label),
        stage_label = COALESCE(NULLIF(v_match->>'stage', ''), stage_label),
        scoring_method = 'rally',
        scoring_target = v_target,
        scheduled_start = COALESCE(NULLIF(v_match->>'scheduledStart', ''), scheduled_start),
        updated_at = now()
      WHERE id = v_live_id
      RETURNING * INTO v_live;
    END IF;
  ELSE
    INSERT INTO public.tournament_match_live (
      id, club_id, tournament_id, event_id, match_id, referee_token, referee_name,
      tournament_name, entry_a_label, entry_b_label, court_label, stage_label,
      score_a, score_b, status, is_daily, audit_log, updated_at,
      live_revision, scoring_target, scoring_method, scheduled_start
    ) VALUES (
      v_live_id,
      v_row.club_id,
      v_row.id::text,
      COALESCE(v_found->>'eventId', ''),
      btrim(p_match_id),
      v_token,
      COALESCE(NULLIF(v_match->'referee'->>'name', ''), 'Trọng tài'),
      COALESCE(NULLIF(v_row.name, ''), 'Giải Official'),
      COALESCE(
        NULLIF(public.official_open_entry_name(v_row.payload, v_match->>'entryAId'), ''),
        'Cặp A'
      ),
      COALESCE(
        NULLIF(public.official_open_entry_name(v_row.payload, v_match->>'entryBId'), ''),
        'Cặp B'
      ),
      v_court_label,
      COALESCE(v_match->>'stage', ''),
      0, 0, 'playing', false, '[]'::jsonb, now(),
      1, v_target, 'rally', COALESCE(v_match->>'scheduledStart', '')
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_live;

    IF v_live.id IS NULL THEN
      SELECT *
      INTO v_live
      FROM public.tournament_match_live
      WHERE id = v_live_id
      FOR UPDATE;
      IF NOT FOUND
         OR v_live.club_id IS DISTINCT FROM v_row.club_id
         OR v_live.tournament_id IS DISTINCT FROM v_row.id::text
         OR v_live.match_id IS DISTINCT FROM btrim(p_match_id)
         OR v_live.referee_token IS DISTINCT FROM v_token THEN
        RETURN public.official_open_json_err(
          'LIVE_TOKEN_BINDING_INCONSISTENT',
          'Không thể tạo live row với token phân công canonical.'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'tournamentId', v_row.id,
    'matchId', btrim(p_match_id),
    'routeToken', v_live.referee_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_open_my_referee_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_open_my_referee_match(uuid, text) TO authenticated;

-- Organizer live synchronization may rotate an active live row only to the
-- exact current assignment-map token after copy-consistency validation.
-- Live-row creation locks the canonical Tournament FOR UPDATE first so it
-- serializes with the Staging fixture identity rebind.

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
  v_token_result jsonb;
  v_live public.tournament_match_live%ROWTYPE;
  v_id text;
  v_target int;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id
    AND t.tenant_id = p_tenant_id
    AND t.club_id = p_club_id
  FOR UPDATE;
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
  v_token_result := public.official_open_resolve_authorized_assignment_token(
    v_row.payload,
    p_match_id
  );
  IF COALESCE(v_token_result->>'ok', 'false') <> 'true' THEN
    RETURN v_token_result;
  END IF;
  v_token := v_token_result->>'token';
  v_target := public.official_open_round_target(v_row.payload, v_match);
  v_id := p_club_id || '::' || p_tournament_id::text || '::' || p_match_id;

  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_live.status IN ('processed', 'locked') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'created', false,
        'id', v_live.id,
        'status', v_live.status
      );
    END IF;
    UPDATE public.tournament_match_live
    SET referee_token = v_token,
        referee_name = COALESCE(NULLIF(p_labels->>'refereeName', ''), referee_name),
        tournament_name = COALESCE(
          NULLIF(p_labels->>'tournamentName', ''),
          NULLIF(v_row.name, ''),
          tournament_name
        ),
        entry_a_label = COALESCE(
          NULLIF(p_labels->>'entryALabel', ''),
          public.official_open_entry_name(v_row.payload, v_match->>'entryAId'),
          entry_a_label
        ),
        entry_b_label = COALESCE(
          NULLIF(p_labels->>'entryBLabel', ''),
          public.official_open_entry_name(v_row.payload, v_match->>'entryBId'),
          entry_b_label
        ),
        court_label = COALESCE(NULLIF(p_labels->>'courtLabel', ''), court_label),
        stage_label = COALESCE(NULLIF(p_labels->>'stageLabel', ''), stage_label),
        scoring_method = 'rally',
        scoring_target = v_target,
        scheduled_start = COALESCE(
          NULLIF(p_labels->>'scheduledStart', ''),
          NULLIF(v_match->>'scheduledStart', ''),
          scheduled_start
        ),
        updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_live;
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'id', v_live.id,
      'status', v_live.status
    );
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
    COALESCE(
      NULLIF(p_labels->>'entryALabel', ''),
      public.official_open_entry_name(v_row.payload, v_match->>'entryAId'),
      'Cặp A'
    ),
    COALESCE(
      NULLIF(p_labels->>'entryBLabel', ''),
      public.official_open_entry_name(v_row.payload, v_match->>'entryBId'),
      'Cặp B'
    ),
    COALESCE(NULLIF(p_labels->>'courtLabel', ''), ''),
    COALESCE(NULLIF(p_labels->>'stageLabel', ''), ''),
    0, 0, 'playing', false, '[]'::jsonb, now(),
    1, v_target, 'rally',
    COALESCE(NULLIF(p_labels->>'scheduledStart', ''), COALESCE(v_match->>'scheduledStart', ''))
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_live;

  IF v_live.id IS NULL THEN
    SELECT * INTO v_live
    FROM public.tournament_match_live
    WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'created', true,
    'id', v_live.id,
    'status', v_live.status
  );
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

-- Harden every Official/Open token capability against the current assignment.

CREATE OR REPLACE FUNCTION public.official_open_referee_get_match(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard jsonb;
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_target int;
  v_canonical jsonb := NULL;
BEGIN
  v_guard := public.official_open_assert_current_referee_token(p_token);
  IF COALESCE(v_guard->>'ok', 'false') <> 'true' THEN
    RETURN v_guard;
  END IF;

  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_guard->>'liveId';

  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = (v_guard->>'tournamentId')::uuid;

  v_found := public.official_open_find_match(v_row.payload, v_live.match_id);
  v_match := CASE WHEN v_found IS NULL THEN '{}'::jsonb ELSE v_found->'match' END;
  v_target := COALESCE(
    v_live.scoring_target,
    public.official_open_round_target(v_row.payload, v_match)
  );
  IF v_match->>'status' IN ('completed', 'forfeit') THEN
    v_canonical := jsonb_build_object(
      'scoreA', NULLIF(v_match->>'scoreA', '')::int,
      'scoreB', NULLIF(v_match->>'scoreB', '')::int,
      'winnerName', public.official_open_entry_name(
        v_row.payload,
        COALESCE(v_match->>'winnerId', '')
      ),
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
    'scheduledStart', COALESCE(
      NULLIF(v_live.scheduled_start, ''),
      COALESCE(v_match->>'scheduledStart', '')
    ),
    'scoringMethod', 'rally',
    'scoringMethodLabel', 'Rally',
    'targetScore', v_target,
    'scoreA', v_live.score_a,
    'scoreB', v_live.score_b,
    'status', v_live.status,
    'liveRevision', v_live.live_revision,
    'finalized',
      v_live.status IN ('processed', 'locked')
      OR COALESCE(v_match->>'status', '') IN ('completed', 'forfeit'),
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
  v_guard jsonb;
  v_live public.tournament_match_live%ROWTYPE;
  v_team text;
  v_next_a int;
  v_next_b int;
BEGIN
  v_guard := public.official_open_assert_current_referee_token(p_token);
  IF COALESCE(v_guard->>'ok', 'false') <> 'true' THEN
    RETURN v_guard;
  END IF;

  v_team := upper(btrim(COALESCE(p_team, '')));
  IF v_team NOT IN ('A', 'B') OR p_delta IS NULL OR p_delta NOT IN (1, -1) THEN
    RETURN public.official_open_json_err('INVALID_ADJUST', 'Chỉ Rally ±1.');
  END IF;

  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_guard->>'liveId'
  FOR UPDATE;
  IF v_live.status IS DISTINCT FROM 'playing' THEN
    RETURN public.official_open_json_err('LIVE_LOCKED', 'Trận đã khóa điểm live.');
  END IF;
  IF v_live.score_a IS DISTINCT FROM p_expected_score_a
     OR v_live.score_b IS DISTINCT FROM p_expected_score_b THEN
    RETURN public.official_open_json_err(
      'LIVE_VERSION_CONFLICT',
      'Điểm live đã đổi. Tải lại rồi chấm tiếp.',
      jsonb_build_object(
        'scoreA', v_live.score_a,
        'scoreB', v_live.score_b,
        'liveRevision', v_live.live_revision
      )
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

REVOKE ALL ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int)
TO anon, authenticated;

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
  v_guard jsonb;
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_result jsonb;
  v_hash text;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;

  v_guard := public.official_open_assert_current_referee_token(p_token);
  IF COALESCE(v_guard->>'ok', 'false') <> 'true' THEN
    RETURN v_guard;
  END IF;

  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = (v_guard->>'tournamentId')::uuid
  FOR UPDATE;

  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_guard->>'liveId'
  FOR UPDATE;

  v_hash := md5(v_live.match_id || ':' || p_score_a::text || ':' || p_score_b::text);
  v_replay := public.official_open_ledger_replay(
    v_row.tenant_id,
    v_row.club_id,
    v_row.id,
    'commit_match_result',
    p_idempotency_key,
    v_hash
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;

  v_result := public.official_open_commit_core(
    v_row,
    v_live.match_id,
    p_score_a,
    p_score_b
  );
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
      v_row.tenant_id,
      v_row.club_id,
      v_row.id,
      'commit_match_result',
      p_idempotency_key,
      v_hash,
      v_result
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_commit_match_result(text, int, int, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_commit_match_result(text, int, int, text)
TO anon, authenticated;

-- Legacy token RPCs remain available for non-Official modes, but are denied
-- from touching a live row whose canonical Tournament mode is Official/Open.

CREATE OR REPLACE FUNCTION public.referee_get_match_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournament_match_live%ROWTYPE;
  v_mode text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT t.mode
  INTO v_mode
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_row.tournament_id;
  IF NOT FOUND OR v_mode = 'official_tournament' THEN
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
  v_mode text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT t.mode
  INTO v_mode
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_row.tournament_id;
  IF NOT FOUND OR v_mode = 'official_tournament' THEN
    RETURN NULL;
  END IF;

  v_action := lower(COALESCE(p_payload->>'action', ''));
  v_user_agent := left(COALESCE(p_payload->>'userAgent', ''), 240);
  v_note := COALESCE(p_payload->>'note', '');
  v_actor := COALESCE(NULLIF(btrim(v_row.referee_name), ''), 'Trọng tài');

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
      v_score_a := GREATEST(0, v_old_a + v_delta);
      v_score_b := v_old_b;
    ELSE
      v_score_a := v_old_a;
      v_score_b := GREATEST(0, v_old_b + v_delta);
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
    v_score_a := GREATEST(0, COALESCE((p_payload->>'scoreA')::int, v_old_a));
    v_score_b := GREATEST(0, COALESCE((p_payload->>'scoreB')::int, v_old_b));
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
GRANT EXECUTE ON FUNCTION public.referee_update_match_score(text, jsonb)
TO anon, authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- 10_REFEREE_COMMIT_APPLY.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-017
-- STAGING ONLY. Do not apply to Production.
-- SQL_APPLIED=NO until explicit Owner GO.
--
-- Adds:
--   canonical_commit_internal_referee_match_result(text, integer, integer, bigint)
--
-- Assigned REFEREE cannot call canonical_tournament_update (needs
-- tournament.update). This security-definer adapter writes the match
-- result once with expected_version CAS, then locks tournament_match_live.
-- Internal matches only. Does not rewrite 01–08.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.canonical_commit_internal_referee_match_result(
  p_token text,
  p_score_a integer,
  p_score_b integer,
  p_expected_version bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_uid uuid;
  v_tournament_id uuid;
  v_tenant_id text;
  v_club_id text;
  v_match_id text;
  v_assigned boolean := false;
  v_organizer boolean := false;
  v_row public.canonical_tournaments%ROWTYPE;
  v_payload jsonb;
  v_match jsonb;
  v_event_idx int;
  v_match_idx int;
  v_group_idx int;
  v_path text[];
  v_entry_a text;
  v_entry_b text;
  v_winner text;
  v_loser text;
  v_status text;
  v_next_status text;
  v_score_a int;
  v_score_b int;
  v_existing_status text;
  v_existing_a int;
  v_existing_b int;
  v_completed_at text;
  v_idempotent boolean := false;
BEGIN
  v_token := trim(COALESCE(p_token, ''));
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RAISE EXCEPTION 'REFEREE_TOKEN_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED'
      USING ERRCODE = '28000';
  END IF;

  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'VERSION_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  v_score_a := GREATEST(0, COALESCE(p_score_a, 0));
  v_score_b := GREATEST(0, COALESCE(p_score_b, 0));
  IF v_score_a = v_score_b THEN
    RAISE EXCEPTION 'DRAW_NOT_ALLOWED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    t.id,
    t.tenant_id,
    t.club_id,
    m.mv->>'id'
  INTO
    v_tournament_id,
    v_tenant_id,
    v_club_id,
    v_match_id
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.payload->'events') = 'array'
      THEN t.payload->'events'
      ELSE '[]'::jsonb
    END
  ) AS e(ev)
  CROSS JOIN LATERAL (
    SELECT mv
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(e.ev->'matches') = 'array'
        THEN e.ev->'matches'
        ELSE '[]'::jsonb
      END
    ) AS mv
    UNION ALL
    SELECT mv
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(e.ev->'groups') = 'array'
        THEN e.ev->'groups'
        ELSE '[]'::jsonb
      END
    ) AS gv
    CROSS JOIN jsonb_array_elements(
      CASE WHEN jsonb_typeof(gv->'matches') = 'array'
        THEN gv->'matches'
        ELSE '[]'::jsonb
      END
    ) AS mv
  ) AS m
  WHERE t.mode = 'internal_tournament'
    AND TRIM(COALESCE(m.mv->'referee'->>'token', '')) = v_token
  LIMIT 1;

  IF v_tournament_id IS NULL OR v_match_id IS NULL THEN
    RAISE EXCEPTION 'REFEREE_TOKEN_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = v_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFEREE_TOKEN_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  v_payload := COALESCE(v_row.payload, '{}'::jsonb);

  SELECT m.mv, e.ord, m.ord
  INTO v_match, v_event_idx, v_match_idx
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_payload->'events') = 'array'
      THEN v_payload->'events' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS e(ev, ord)
  CROSS JOIN jsonb_array_elements(
    CASE WHEN jsonb_typeof(e.ev->'matches') = 'array'
      THEN e.ev->'matches' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS m(mv, ord)
  WHERE TRIM(COALESCE(m.mv->>'id', '')) = v_match_id
  LIMIT 1;

  IF v_match IS NOT NULL THEN
    v_path := ARRAY['events', (v_event_idx - 1)::text, 'matches', (v_match_idx - 1)::text];
  ELSE
    SELECT m.mv, e.ord, g.ord, m.ord
    INTO v_match, v_event_idx, v_group_idx, v_match_idx
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_payload->'events') = 'array'
        THEN v_payload->'events' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS e(ev, ord)
    CROSS JOIN jsonb_array_elements(
      CASE WHEN jsonb_typeof(e.ev->'groups') = 'array'
        THEN e.ev->'groups' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS g(gv, ord)
    CROSS JOIN jsonb_array_elements(
      CASE WHEN jsonb_typeof(g.gv->'matches') = 'array'
        THEN g.gv->'matches' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS m(mv, ord)
    WHERE TRIM(COALESCE(m.mv->>'id', '')) = v_match_id
    LIMIT 1;

    IF v_match IS NULL THEN
      RAISE EXCEPTION 'MATCH_NOT_FOUND'
        USING ERRCODE = 'P0001';
    END IF;
    v_path := ARRAY[
      'events', (v_event_idx - 1)::text,
      'groups', (v_group_idx - 1)::text,
      'matches', (v_match_idx - 1)::text
    ];
  END IF;

  v_assigned := LOWER(TRIM(COALESCE(
    v_match->'referee'->>'canonicalUserId',
    v_match->'referee'->>'refereeUserId',
    ''
  ))) = LOWER(v_uid::text);

  v_organizer := public.is_super_admin()
    OR (
      v_row.tenant_id IS NOT DISTINCT FROM public.user_venue_id()
      AND public.user_has_permission('tournament.update')
    );

  IF NOT v_assigned AND NOT v_organizer THEN
    RAISE EXCEPTION 'TOURNAMENT_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  v_existing_status := LOWER(TRIM(COALESCE(v_match->>'status', '')));
  BEGIN
    v_existing_a := NULLIF(TRIM(COALESCE(v_match->>'scoreA', '')), '')::int;
    v_existing_b := NULLIF(TRIM(COALESCE(v_match->>'scoreB', '')), '')::int;
  EXCEPTION
    WHEN others THEN
      v_existing_a := NULL;
      v_existing_b := NULL;
  END;

  IF v_existing_status IN ('completed', 'forfeit', 'final', 'locked') THEN
    IF v_existing_a IS NOT DISTINCT FROM v_score_a
       AND v_existing_b IS NOT DISTINCT FROM v_score_b THEN
      v_idempotent := true;
    ELSE
      RAISE EXCEPTION 'MATCH_ALREADY_COMPLETED'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_entry_a := NULLIF(TRIM(COALESCE(v_match->>'entryAId', v_match->>'teamAId', '')), '');
  v_entry_b := NULLIF(TRIM(COALESCE(v_match->>'entryBId', v_match->>'teamBId', '')), '');
  IF v_score_a > v_score_b THEN
    v_winner := COALESCE(v_entry_a, '');
    v_loser := COALESCE(v_entry_b, '');
  ELSE
    v_winner := COALESCE(v_entry_b, '');
    v_loser := COALESCE(v_entry_a, '');
  END IF;

  v_completed_at := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_status := 'completed';
  v_next_status := v_row.status;
  IF v_next_status = 'ready' THEN
    v_next_status := 'active';
  END IF;

  IF NOT v_idempotent THEN
    v_payload := jsonb_set(
      v_payload,
      v_path,
      v_match || jsonb_build_object(
        'scoreA', v_score_a,
        'scoreB', v_score_b,
        'status', v_status,
        'winnerId', v_winner,
        'loserId', v_loser,
        'completedAt', v_completed_at
      ),
      false
    );

    UPDATE public.canonical_tournaments t
    SET
      payload = v_payload,
      status = v_next_status,
      version = t.version + 1,
      updated_at = now()
    WHERE t.id = v_tournament_id
    RETURNING * INTO v_row;
  END IF;

  UPDATE public.tournament_match_live
  SET
    score_a = v_score_a,
    score_b = v_score_b,
    status = 'locked',
    updated_at = now()
  WHERE referee_token = v_token
     OR (
       club_id = v_row.club_id
       AND tournament_id = v_tournament_id::text
       AND match_id = v_match_id
     );

  RETURN json_build_object(
    'ok', true,
    'match_id', v_match_id,
    'score_a', v_score_a,
    'score_b', v_score_b,
    'status', v_status,
    'version', v_row.version,
    'tournament_id', v_tournament_id,
    'idempotent', v_idempotent
  );
END;
$$;

COMMENT ON FUNCTION public.canonical_commit_internal_referee_match_result(text, integer, integer, bigint) IS
  'IT-E2E-BROWSER-017: assigned Internal referee commits canonical match result with expected_version CAS.';

REVOKE ALL ON FUNCTION public.canonical_commit_internal_referee_match_result(text, integer, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_commit_internal_referee_match_result(text, integer, integer, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.canonical_commit_internal_referee_match_result(text, integer, integer, bigint) TO authenticated;

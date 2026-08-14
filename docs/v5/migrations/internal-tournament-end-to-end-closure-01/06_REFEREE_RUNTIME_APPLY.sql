-- ═══════════════════════════════════════════════════════════════════
-- 06_REFEREE_RUNTIME_APPLY.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-016
-- STAGING ONLY. Do not apply to Production.
--
-- Adds:
--   unique (club_id, tournament_id, match_id) on tournament_match_live
--   canonical_ensure_internal_referee_match_live(p_token text)
--
-- Does not rewrite 01–04. Does not touch Team ensure RPC.
-- ═══════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS tournament_match_live_club_tournament_match_uidx
  ON public.tournament_match_live (club_id, tournament_id, match_id);

COMMENT ON INDEX public.tournament_match_live_club_tournament_match_uidx IS
  'IT-E2E-BROWSER-016: one Internal/shared live row per club+tournament+match.';

CREATE OR REPLACE FUNCTION public.canonical_ensure_internal_referee_match_live(p_token text)
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
  v_tournament_name text;
  v_event jsonb;
  v_event_id text;
  v_match jsonb;
  v_match_id text;
  v_assigned boolean := false;
  v_organizer boolean := false;
  v_row public.tournament_match_live%ROWTYPE;
  v_entry_a text;
  v_entry_b text;
  v_court text;
  v_stage text;
  v_status text;
  v_match_status text;
  v_ref_name text;
  v_live_id text;
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

  SELECT
    t.id,
    t.tenant_id,
    t.club_id,
    t.name,
    e.ev,
    COALESCE(NULLIF(TRIM(e.ev->>'id'), ''), ''),
    m.mv
  INTO
    v_tournament_id,
    v_tenant_id,
    v_club_id,
    v_tournament_name,
    v_event,
    v_event_id,
    v_match
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

  IF v_match IS NULL OR v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'REFEREE_TOKEN_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  v_match_id := NULLIF(TRIM(COALESCE(v_match->>'id', '')), '');
  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'REFEREE_TOKEN_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  v_assigned := LOWER(TRIM(COALESCE(
    v_match->'referee'->>'canonicalUserId',
    v_match->'referee'->>'refereeUserId',
    ''
  ))) = LOWER(v_uid::text);

  -- Organizer/staff: existing update contract only.
  -- Do not treat tournament.create as scoring authority (PLAYER has create).
  v_organizer := public.is_super_admin()
    OR (
      v_tenant_id IS NOT DISTINCT FROM public.user_venue_id()
      AND public.user_has_permission('tournament.update')
    );

  IF NOT v_assigned AND NOT v_organizer THEN
    RAISE EXCEPTION 'TOURNAMENT_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE referee_token = v_token
  LIMIT 1;

  IF FOUND THEN
    RETURN public.referee_get_match_by_token(v_token);
  END IF;

  SELECT *
  INTO v_row
  FROM public.tournament_match_live
  WHERE club_id = v_club_id
    AND tournament_id = v_tournament_id::text
    AND match_id = v_match_id
  LIMIT 1;

  IF FOUND THEN
    RETURN public.referee_get_match_by_token(v_row.referee_token);
  END IF;

  v_entry_a := COALESCE(
    (
      SELECT COALESCE(NULLIF(TRIM(ent->>'name'), ''), NULLIF(TRIM(ent->>'label'), ''))
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_event->'entries') = 'array'
          THEN v_event->'entries'
          ELSE '[]'::jsonb
        END
      ) ent
      WHERE ent->>'id' = COALESCE(v_match->>'entryAId', v_match->>'teamAId')
      LIMIT 1
    ),
    NULLIF(TRIM(v_match->>'entryALabel'), ''),
    NULLIF(TRIM(v_match->>'teamALabel'), ''),
    'Đội A'
  );

  v_entry_b := COALESCE(
    (
      SELECT COALESCE(NULLIF(TRIM(ent->>'name'), ''), NULLIF(TRIM(ent->>'label'), ''))
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_event->'entries') = 'array'
          THEN v_event->'entries'
          ELSE '[]'::jsonb
        END
      ) ent
      WHERE ent->>'id' = COALESCE(v_match->>'entryBId', v_match->>'teamBId')
      LIMIT 1
    ),
    NULLIF(TRIM(v_match->>'entryBLabel'), ''),
    NULLIF(TRIM(v_match->>'teamBLabel'), ''),
    'Đội B'
  );

  v_court := COALESCE(
    NULLIF(TRIM(v_match->>'courtName'), ''),
    NULLIF(TRIM(v_match->>'courtLabel'), ''),
    NULLIF(TRIM(v_match->>'courtId'), ''),
    ''
  );

  v_stage := COALESCE(
    NULLIF(TRIM(v_match->>'stageLabel'), ''),
    NULLIF(TRIM(
      CONCAT_WS(
        ' · ',
        CASE
          WHEN v_match->>'stage' = 'group' THEN 'Vòng bảng'
          ELSE NULLIF(TRIM(v_match->>'stage'), '')
        END,
        CASE
          WHEN NULLIF(TRIM(v_match->>'round'), '') IS NOT NULL
            THEN 'Vòng ' || TRIM(v_match->>'round')
          ELSE NULL
        END
      )
    ), ''),
    ''
  );

  v_match_status := LOWER(TRIM(COALESCE(v_match->>'status', '')));
  IF v_match_status IN ('completed', 'forfeit', 'final', 'locked')
     OR NULLIF(TRIM(COALESCE(v_match->>'winnerId', '')), '') IS NOT NULL THEN
    v_status := 'locked';
  ELSE
    -- Shared Internal scorer contract (tournament_match_live): open = playing.
    -- Team match_live_states.not_started is a different table and must not be copied here.
    v_status := 'playing';
  END IF;

  v_ref_name := COALESCE(
    NULLIF(TRIM(v_match->'referee'->>'name'), ''),
    'Trọng tài'
  );

  v_live_id := v_club_id || '::' || v_tournament_id::text || '::' || v_match_id;

  BEGIN
    INSERT INTO public.tournament_match_live (
      id,
      club_id,
      tournament_id,
      event_id,
      match_id,
      referee_token,
      referee_name,
      tournament_name,
      entry_a_label,
      entry_b_label,
      court_label,
      score_a,
      score_b,
      status,
      is_daily,
      stage_label,
      audit_log,
      updated_at
    ) VALUES (
      v_live_id,
      v_club_id,
      v_tournament_id::text,
      v_event_id,
      v_match_id,
      v_token,
      v_ref_name,
      COALESCE(NULLIF(TRIM(v_tournament_name), ''), v_tournament_id::text),
      v_entry_a,
      v_entry_b,
      v_court,
      0,
      0,
      v_status,
      false,
      v_stage,
      '[]'::jsonb,
      now()
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  RETURN public.referee_get_match_by_token(v_token);
END;
$$;

COMMENT ON FUNCTION public.canonical_ensure_internal_referee_match_live(text) IS
  'IT-E2E-BROWSER-016: idempotent Internal referee tournament_match_live ensure from canonical assignment token.';

REVOKE ALL ON FUNCTION public.canonical_ensure_internal_referee_match_live(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_ensure_internal_referee_match_live(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.canonical_ensure_internal_referee_match_live(text) TO authenticated;

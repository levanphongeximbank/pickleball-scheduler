-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: internal-tournament-end-to-end-closure-01
-- Workstream: INTERNAL-TOURNAMENT-END-TO-END-CLOSURE-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Adds / hardens:
--   canonical_tournaments.version (bigint, monotonic)
--   Internal mode: expected_version REQUIRED (VERSION_REQUIRED / VERSION_CONFLICT)
--   Non-Internal: expected_version still optional (Team BC)
--   Internal-only status transition enforcement
--   Internal completion: competition from EXISTING payload; close snapshot from MERGED
--   IT-P27-001: locked alone is NEVER terminal (completed|forfeit only)
--   force reopen: p_patch.force_status_reopen = true for completed → active
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.canonical_tournaments
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.canonical_tournaments.version IS
  'Monotonic server-owned compare token for canonical_tournament_update CAS.';

CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_internal_status_transition(
  p_mode text,
  p_from text,
  p_to text,
  p_force_reopen boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := lower(trim(COALESCE(p_from, 'draft')));
  v_to text := lower(trim(COALESCE(p_to, 'draft')));
BEGIN
  IF COALESCE(p_mode, '') IS DISTINCT FROM 'internal_tournament' THEN
    RETURN;
  END IF;

  IF v_from = v_to THEN
    RETURN;
  END IF;

  IF p_force_reopen IS TRUE
     AND v_from = 'completed'
     AND v_to = 'active' THEN
    RETURN;
  END IF;

  IF v_from = 'draft' AND v_to IN ('registration', 'ready', 'cancelled') THEN
    RETURN;
  ELSIF v_from = 'registration' AND v_to IN ('ready', 'draft', 'cancelled') THEN
    RETURN;
  ELSIF v_from = 'ready' AND v_to IN ('active', 'completed', 'registration', 'cancelled') THEN
    RETURN;
  ELSIF v_from = 'active' AND v_to IN ('completed', 'cancelled') THEN
    RETURN;
  ELSIF v_from = 'cancelled' AND v_to = 'draft' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'INTERNAL_STATUS_TRANSITION_DENIED'
    USING ERRCODE = 'P0001',
          DETAIL = format('from=%s to=%s mode=%s', v_from, v_to, p_mode);
END;
$$;

-- Drop legacy 4-arg overload if present (Pass 2.6 signature).
DROP FUNCTION IF EXISTS public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb);

-- Validates Internal completion.
-- COMPETITION proof uses EXISTING server payload (pre-patch) — locked alone ≠ complete.
-- CLOSE SNAPSHOT (closed/summary/champion) uses MERGED close payload.
-- Terminal match statuses: completed | forfeit (matches bracketEngine / MATCH_STATUS).
CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_internal_completion_eligible(
  p_mode text,
  p_from_status text,
  p_to_status text,
  p_existing_payload jsonb,
  p_merged_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := lower(trim(COALESCE(p_from_status, '')));
  v_to text := lower(trim(COALESCE(p_to_status, '')));
  v_existing jsonb := COALESCE(p_existing_payload, '{}'::jsonb);
  v_merged jsonb := COALESCE(p_merged_payload, p_existing_payload, '{}'::jsonb);
  v_ops jsonb;
  v_summary jsonb;
  v_event jsonb;
  v_matches jsonb;
  v_groups jsonb;
  v_match jsonb;
  v_group_count int := 0;
  v_group_match_count int := 0;
  v_ko_count int := 0;
  v_incomplete int := 0;
  v_has_champion boolean := false;
  v_has_completed_final boolean := false;
  v_stage text;
  v_status text;
BEGIN
  IF COALESCE(p_mode, '') IS DISTINCT FROM 'internal_tournament' THEN
    RETURN;
  END IF;

  IF v_to IS DISTINCT FROM 'completed' OR v_from = 'completed' THEN
    RETURN;
  END IF;

  -- A. COMPETITION_COMPLETENESS from EXISTING row (client cannot manufacture).
  v_event := COALESCE(v_existing #> '{events,0}', '{}'::jsonb);
  v_matches := COALESCE(v_event->'matches', '[]'::jsonb);
  v_groups := COALESCE(v_event->'groups', '[]'::jsonb);

  IF jsonb_typeof(v_matches) <> 'array' OR jsonb_array_length(v_matches) < 1 THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'no_matches';
  END IF;

  v_group_count := CASE
    WHEN jsonb_typeof(v_groups) = 'array' THEN jsonb_array_length(v_groups)
    ELSE 0
  END;

  IF v_group_count < 1 THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'missing_group_stage';
  END IF;

  FOR v_match IN SELECT value FROM jsonb_array_elements(v_matches)
  LOOP
    v_status := lower(trim(COALESCE(v_match->>'status', '')));
    -- IT-P27-001: locked alone is NEVER terminal.
    IF v_status NOT IN ('completed', 'forfeit') THEN
      v_incomplete := v_incomplete + 1;
    END IF;

    IF nullif(trim(COALESCE(v_match->>'bracketMatchId', '')), '') IS NULL THEN
      v_group_match_count := v_group_match_count + 1;
    ELSE
      v_ko_count := v_ko_count + 1;
    END IF;

    v_stage := lower(trim(COALESCE(v_match->>'stage', COALESCE(v_match->>'round', ''))));
    IF (
      v_stage IN ('final', 'chung ket', 'chung_ket')
      OR position('final' in v_stage) > 0
    )
    AND v_status IN ('completed', 'forfeit')
    AND nullif(trim(COALESCE(v_match->>'winnerId', '')), '') IS NOT NULL THEN
      v_has_completed_final := true;
    END IF;
  END LOOP;

  IF v_incomplete > 0 THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = format('incomplete_matches=%s', v_incomplete);
  END IF;

  IF v_group_match_count < 1 THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'missing_group_stage';
  END IF;

  IF v_group_count = 1 THEN
    IF v_ko_count > 0 THEN
      RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
        USING ERRCODE = 'P0001', DETAIL = 'one_group_has_knockout';
    END IF;
  ELSE
    IF NOT v_has_completed_final THEN
      RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
        USING ERRCODE = 'P0001', DETAIL = 'knockout_incomplete';
    END IF;
  END IF;

  -- B. CLOSE_SNAPSHOT from MERGED close payload (produced by closeTournament).
  v_ops := COALESCE(v_merged #> '{settings,resultsOps}', '{}'::jsonb);
  IF COALESCE((v_ops->>'closed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'results_not_closed';
  END IF;

  v_summary := v_ops->'summary';
  IF v_summary IS NULL OR jsonb_typeof(v_summary) <> 'object' THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'missing_summary';
  END IF;

  v_has_champion :=
    (nullif(trim(COALESCE(v_summary #>> '{champion,entryId}', '')), '') IS NOT NULL)
    OR (nullif(trim(COALESCE(v_summary #>> '{champion,entryName}', '')), '') IS NOT NULL)
    OR (nullif(trim(COALESCE(v_summary->>'championId', '')), '') IS NOT NULL);

  IF NOT v_has_champion THEN
    RAISE EXCEPTION 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE'
      USING ERRCODE = 'P0001', DETAIL = 'missing_champion';
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.canonical_tournament_create(
  p_tenant_id text,
  p_club_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  ext_key text;
  row_data public.canonical_tournaments%ROWTYPE;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.create');

  ext_key := COALESCE(nullif(trim(p_payload->>'external_key'), ''), 'tournament-' || new_id::text);

  INSERT INTO public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload, engine_v4, version
  ) VALUES (
    new_id,
    p_tenant_id,
    p_club_id,
    ext_key,
    COALESCE(nullif(trim(p_payload->>'name'), ''), 'Giải mới'),
    COALESCE(nullif(trim(p_payload->>'mode'), ''), 'internal_tournament'),
    COALESCE(nullif(trim(p_payload->>'status'), ''), 'draft'),
    nullif(trim(p_payload->>'season_id'), ''),
    nullif(trim(p_payload->>'league_id'), ''),
    COALESCE(p_payload->'payload', '{}'::jsonb) || jsonb_build_object('id', new_id::text),
    COALESCE(p_payload->'engine_v4', '{}'::jsonb),
    1
  )
  RETURNING * INTO row_data;

  RETURN jsonb_build_object('ok', true, 'tournament', to_jsonb(row_data));
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLERRM);
    END IF;
    RAISE;
END;
$$;

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
  v_current public.canonical_tournaments%ROWTYPE;
  v_expected bigint;
  v_next_status text;
  v_force_reopen boolean := false;
  v_merged_payload jsonb;
  v_has_expected boolean := false;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_current
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id
    AND t.tenant_id = p_tenant_id
    AND t.club_id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOURNAMENT_NOT_FOUND');
  END IF;

  v_has_expected :=
    (p_patch ? 'expected_version')
    AND nullif(trim(COALESCE(p_patch->>'expected_version', '')), '') IS NOT NULL;

  -- Internal: expected_version is mandatory (fail closed, zero mutation).
  IF v_current.mode = 'internal_tournament' AND NOT v_has_expected THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VERSION_REQUIRED',
      'error', 'expected_version is required for internal_tournament updates.',
      'currentVersion', v_current.version
    );
  END IF;

  IF v_has_expected THEN
    BEGIN
      v_expected := (p_patch->>'expected_version')::bigint;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'VERSION_REQUIRED',
        'error', 'expected_version không hợp lệ.',
        'expectedVersion', p_patch->>'expected_version',
        'currentVersion', v_current.version
      );
    END;

    IF v_current.version IS DISTINCT FROM v_expected THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'VERSION_CONFLICT',
        'error', 'VERSION_CONFLICT',
        'expectedVersion', v_expected,
        'currentVersion', v_current.version
      );
    END IF;
  END IF;

  v_force_reopen := COALESCE((p_patch->>'force_status_reopen')::boolean, false);
  v_next_status := COALESCE(nullif(trim(p_patch->>'status'), ''), v_current.status);
  v_merged_payload := CASE
    WHEN p_patch ? 'payload' THEN p_patch->'payload'
    ELSE v_current.payload
  END;

  BEGIN
    PERFORM public.canonical_tournament_assert_internal_status_transition(
      v_current.mode,
      v_current.status,
      v_next_status,
      v_force_reopen
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INTERNAL_STATUS_TRANSITION_DENIED' THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'INTERNAL_STATUS_TRANSITION_DENIED',
          'error', format('Không thể chuyển giải nội bộ từ %s sang %s.', v_current.status, v_next_status),
          'from', v_current.status,
          'to', v_next_status
        );
      END IF;
      RAISE;
  END;

  BEGIN
    PERFORM public.canonical_tournament_assert_internal_completion_eligible(
      v_current.mode,
      v_current.status,
      v_next_status,
      v_current.payload,
      v_merged_payload
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE' THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE',
          'error', 'Giải nội bộ chưa đủ điều kiện hoàn tất.',
          'detail', SQLERRM
        );
      END IF;
      RAISE;
  END;

  UPDATE public.canonical_tournaments t
  SET
    name = COALESCE(nullif(trim(p_patch->>'name'), ''), t.name),
    status = v_next_status,
    season_id = CASE WHEN p_patch ? 'season_id' THEN nullif(trim(p_patch->>'season_id'), '') ELSE t.season_id END,
    league_id = CASE WHEN p_patch ? 'league_id' THEN nullif(trim(p_patch->>'league_id'), '') ELSE t.league_id END,
    payload = CASE WHEN p_patch ? 'payload' THEN p_patch->'payload' ELSE t.payload END,
    engine_v4 = CASE WHEN p_patch ? 'engine_v4' THEN p_patch->'engine_v4' ELSE t.engine_v4 END,
    version = t.version + 1,
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

REVOKE ALL ON FUNCTION public.canonical_tournament_assert_internal_status_transition(text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.canonical_tournament_assert_internal_status_transition(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_create(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.canonical_tournament_assert_internal_status_transition(text, text, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_assert_internal_completion_eligible(text, text, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_create(text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM anon;

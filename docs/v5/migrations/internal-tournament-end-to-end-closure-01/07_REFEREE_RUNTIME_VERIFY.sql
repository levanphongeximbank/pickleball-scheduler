-- ═══════════════════════════════════════════════════════════════════
-- 07_REFEREE_RUNTIME_VERIFY.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-016
-- STAGING ONLY. ROLLBACK_RUN=NO.
--
-- Uses Owner fixture token from canonical payload (does not print it).
-- Creates one throwaway Internal tournament for score-preservation only;
-- Owner fixture scores are never rewritten.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id uuid := 'd3a35fd1-5caf-4d18-86b4-5df0881c9dc3';
  v_assigned uuid := 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5';
  v_unassigned uuid := '7b381912-2190-415c-b099-6b1e87567b7a';
  v_cross uuid := 'e54abeac-6619-477a-9eb4-b64b05c1ddba';
  v_organizer uuid := 'f7eacd7b-6d78-431e-a40e-ed21d3ce3876';
  v_token text;
  v_hub_token text;
  v_got json;
  v_got2 json;
  v_count int;
  v_count2 int;
  v_dummy_id uuid := 'a0160000-0000-4000-8000-000000000016';
  v_dummy_token text := 'it016scorepreserve01xx';
  v_dummy_got json;
  v_err text;
  v_has_anon boolean;
BEGIN
  IF to_regprocedure('public.canonical_ensure_internal_referee_match_live(text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_ensure_internal_referee_match_live missing';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name = 'canonical_ensure_internal_referee_match_live'
      AND grantee = 'anon'
      AND privilege_type = 'EXECUTE'
  ) INTO v_has_anon;

  IF v_has_anon THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not EXECUTE ensure RPC';
  END IF;

  SELECT TRIM(m->'referee'->>'token')
  INTO v_token
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(t.payload->'events') e
  CROSS JOIN LATERAL jsonb_array_elements(e->'matches') m
  WHERE t.id = v_owner_id
    AND m->>'id' = 'GA-R1-M1'
  LIMIT 1;

  IF v_token IS NULL OR length(v_token) < 16 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: Owner GA-R1-M1 canonical token missing';
  END IF;

  v_hub_token := v_token;

  -- 1. Invalid token
  PERFORM set_config('request.jwt.claim.sub', v_assigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_assigned::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_ensure_internal_referee_match_live('short');
    RAISE EXCEPTION 'VERIFY_FAIL: invalid token was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'REFEREE_TOKEN_INVALID' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: invalid token expected REFEREE_TOKEN_INVALID got %', SQLERRM;
      END IF;
  END;

  -- 8. Unassigned authenticated user denied
  PERFORM set_config('request.jwt.claim.sub', v_unassigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_unassigned::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_ensure_internal_referee_match_live(v_token);
    RAISE EXCEPTION 'VERIFY_FAIL: unassigned user was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'TOURNAMENT_FORBIDDEN' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: unassigned expected TOURNAMENT_FORBIDDEN got %', SQLERRM;
      END IF;
  END;

  -- 10. Cross-tenant user denied
  PERFORM set_config('request.jwt.claim.sub', v_cross::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cross::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_ensure_internal_referee_match_live(v_token);
    RAISE EXCEPTION 'VERIFY_FAIL: cross-tenant user was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'TOURNAMENT_FORBIDDEN' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: cross-tenant expected TOURNAMENT_FORBIDDEN got %', SQLERRM;
      END IF;
  END;

  -- 2 / 8. Assigned referee ensure succeeds
  PERFORM set_config('request.jwt.claim.sub', v_assigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_assigned::text, 'role', 'authenticated')::text, true);
  v_got := public.canonical_ensure_internal_referee_match_live(v_token);

  IF v_got IS NULL OR v_got->>'match_id' IS DISTINCT FROM 'GA-R1-M1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: assigned ensure did not return GA-R1-M1';
  END IF;

  IF v_got->>'referee_token' IS DISTINCT FROM v_hub_token THEN
    RAISE EXCEPTION 'VERIFY_FAIL: TOKEN_PARITY failed after first ensure';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.tournament_match_live
  WHERE tournament_id = v_owner_id::text
    AND match_id = 'GA-R1-M1';

  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: LIVE_ROW_COUNT_AFTER_FIRST_ENSURE=%', v_count;
  END IF;

  -- 4 / 5. Second ensure: still 1 row, token unchanged
  v_got2 := public.canonical_ensure_internal_referee_match_live(v_token);
  SELECT count(*)
  INTO v_count2
  FROM public.tournament_match_live
  WHERE tournament_id = v_owner_id::text
    AND match_id = 'GA-R1-M1';

  IF v_count2 IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: LIVE_ROW_COUNT_AFTER_SECOND_ENSURE=%', v_count2;
  END IF;

  IF v_got2->>'referee_token' IS DISTINCT FROM v_hub_token THEN
    RAISE EXCEPTION 'VERIFY_FAIL: token changed on second ensure';
  END IF;

  -- 7. referee_get_match_by_token returns GA-R1-M1
  v_got := public.referee_get_match_by_token(v_token);
  IF v_got IS NULL OR v_got->>'match_id' IS DISTINCT FROM 'GA-R1-M1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: referee_get_match_by_token did not return GA-R1-M1';
  END IF;
  IF v_got->>'referee_token' IS DISTINCT FROM v_hub_token THEN
    RAISE EXCEPTION 'VERIFY_FAIL: get-by-token token parity failed';
  END IF;

  -- 11. Organizer same-tenant allowed; does not reset
  PERFORM set_config('request.jwt.claim.sub', v_organizer::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_organizer::text, 'role', 'authenticated')::text, true);
  v_got := public.canonical_ensure_internal_referee_match_live(v_token);
  IF v_got IS NULL OR v_got->>'match_id' IS DISTINCT FROM 'GA-R1-M1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: organizer ensure denied';
  END IF;

  -- 12. Score preservation on controlled dummy row (not Owner fixture)
  DELETE FROM public.tournament_match_live WHERE tournament_id = v_dummy_id::text;
  DELETE FROM public.canonical_tournaments WHERE id = v_dummy_id;

  INSERT INTO public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload, engine_v4, version
  ) VALUES (
    v_dummy_id,
    'venue-staging-a',
    'club-ecebf64c78f948ccb2b59842441eb26c',
    'it016-score-preserve',
    'IT016 score preserve',
    'internal_tournament',
    'ready',
    jsonb_build_object(
      'events', jsonb_build_array(
        jsonb_build_object(
          'id', 'event-it016',
          'matches', jsonb_build_array(
            jsonb_build_object(
              'id', 'IT016-M1',
              'status', 'waiting',
              'entryALabel', 'A',
              'entryBLabel', 'B',
              'referee', jsonb_build_object(
                'token', v_dummy_token,
                'canonicalUserId', v_assigned::text,
                'name', 'IT016'
              )
            )
          )
        )
      )
    ),
    '{}'::jsonb,
    1
  );

  PERFORM set_config('request.jwt.claim.sub', v_assigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_assigned::text, 'role', 'authenticated')::text, true);
  v_dummy_got := public.canonical_ensure_internal_referee_match_live(v_dummy_token);
  IF v_dummy_got IS NULL OR v_dummy_got->>'match_id' IS DISTINCT FROM 'IT016-M1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: dummy ensure failed';
  END IF;

  UPDATE public.tournament_match_live
  SET score_a = 7, score_b = 4
  WHERE referee_token = v_dummy_token;

  v_dummy_got := public.canonical_ensure_internal_referee_match_live(v_dummy_token);
  IF (v_dummy_got->>'score_a')::int IS DISTINCT FROM 7
     OR (v_dummy_got->>'score_b')::int IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: SCORE_PRESERVED_ON_REENSURE failed';
  END IF;

  DELETE FROM public.tournament_match_live WHERE referee_token = v_dummy_token;
  DELETE FROM public.canonical_tournaments WHERE id = v_dummy_id;

  RAISE NOTICE 'VERIFY_OK IT-E2E-BROWSER-016 first=% second=% token_parity=YES', v_count, v_count2;
END $$;

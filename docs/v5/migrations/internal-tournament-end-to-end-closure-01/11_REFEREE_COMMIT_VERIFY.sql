-- ═══════════════════════════════════════════════════════════════════
-- 11_REFEREE_COMMIT_VERIFY.sql
-- Package: internal-tournament-end-to-end-closure-01 (additive follow-up)
-- Workstream: IT-E2E-BROWSER-017
-- STAGING ONLY. ROLLBACK_RUN=NO.
--
-- Throwaway tournament only. Does NOT commit Owner fixture GA-R1-M1.
-- Asserts Owner live 11-5 and canonical waiting remain unchanged.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id uuid := 'd3a35fd1-5caf-4d18-86b4-5df0881c9dc3';
  v_assigned uuid := 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5';
  v_unassigned uuid := '7b381912-2190-415c-b099-6b1e87567b7a';
  v_cross uuid := 'e54abeac-6619-477a-9eb4-b64b05c1ddba';
  v_dummy_id uuid := 'a0170000-0000-4000-8000-000000000017';
  v_dummy_token text := 'it017commitfixture01x';
  v_owner_live_a int;
  v_owner_live_b int;
  v_owner_live_status text;
  v_owner_match jsonb;
  v_got json;
  v_has_anon boolean;
  v_err text;
  v_dummy_match jsonb;
  v_dummy_version bigint;
BEGIN
  IF to_regprocedure('public.canonical_commit_internal_referee_match_result(text,integer,integer,bigint)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical_commit_internal_referee_match_result missing';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name = 'canonical_commit_internal_referee_match_result'
      AND grantee = 'anon'
      AND privilege_type = 'EXECUTE'
  ) INTO v_has_anon;

  IF v_has_anon THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not EXECUTE commit RPC';
  END IF;

  SELECT score_a, score_b, status
  INTO v_owner_live_a, v_owner_live_b, v_owner_live_status
  FROM public.tournament_match_live
  WHERE tournament_id = v_owner_id::text
    AND match_id = 'GA-R1-M1'
  LIMIT 1;

  SELECT m
  INTO v_owner_match
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(t.payload->'events') e
  CROSS JOIN LATERAL jsonb_array_elements(e->'matches') m
  WHERE t.id = v_owner_id
    AND m->>'id' = 'GA-R1-M1'
  LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', v_assigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_assigned::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_commit_internal_referee_match_result('short', 11, 5, 1);
    RAISE EXCEPTION 'VERIFY_FAIL: invalid token was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'REFEREE_TOKEN_INVALID' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: invalid token expected REFEREE_TOKEN_INVALID got %', SQLERRM;
      END IF;
  END;

  DELETE FROM public.tournament_match_live WHERE tournament_id = v_dummy_id::text;
  DELETE FROM public.canonical_tournaments WHERE id = v_dummy_id;

  INSERT INTO public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload, engine_v4, version
  ) VALUES (
    v_dummy_id,
    'venue-staging-a',
    'club-ecebf64c78f948ccb2b59842441eb26c',
    'it017-commit',
    'IT017 commit fixture',
    'internal_tournament',
    'ready',
    jsonb_build_object(
      'events', jsonb_build_array(
        jsonb_build_object(
          'id', 'event-it017',
          'entries', jsonb_build_array(
            jsonb_build_object('id', 'e1', 'name', 'A'),
            jsonb_build_object('id', 'e2', 'name', 'B')
          ),
          'matches', jsonb_build_array(
            jsonb_build_object(
              'id', 'IT017-M1',
              'status', 'waiting',
              'entryAId', 'e1',
              'entryBId', 'e2',
              'entryALabel', 'A',
              'entryBLabel', 'B',
              'referee', jsonb_build_object(
                'token', v_dummy_token,
                'canonicalUserId', v_assigned::text,
                'name', 'IT017'
              )
            )
          )
        )
      )
    ),
    '{}'::jsonb,
    4
  );

  INSERT INTO public.tournament_match_live (
    id, club_id, tournament_id, event_id, match_id, referee_token, referee_name,
    tournament_name, entry_a_label, entry_b_label, score_a, score_b, status, is_daily, audit_log, updated_at
  ) VALUES (
    v_dummy_id::text || '::IT017-M1',
    'club-ecebf64c78f948ccb2b59842441eb26c',
    v_dummy_id::text,
    'event-it017',
    'IT017-M1',
    v_dummy_token,
    'IT017',
    'IT017 commit fixture',
    'A',
    'B',
    11,
    5,
    'playing',
    false,
    '[]'::jsonb,
    now()
  );

  PERFORM set_config('request.jwt.claim.sub', v_unassigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_unassigned::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_commit_internal_referee_match_result(v_dummy_token, 11, 5, 4);
    RAISE EXCEPTION 'VERIFY_FAIL: unassigned user was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'TOURNAMENT_FORBIDDEN' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: unassigned expected TOURNAMENT_FORBIDDEN got %', SQLERRM;
      END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_cross::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cross::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.canonical_commit_internal_referee_match_result(v_dummy_token, 11, 5, 4);
    RAISE EXCEPTION 'VERIFY_FAIL: cross-tenant user was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'TOURNAMENT_FORBIDDEN' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: cross-tenant expected TOURNAMENT_FORBIDDEN got %', SQLERRM;
      END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_assigned::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_assigned::text, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM public.canonical_commit_internal_referee_match_result(v_dummy_token, 11, 5, 3);
    RAISE EXCEPTION 'VERIFY_FAIL: stale version was allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'VERSION_CONFLICT' THEN
        RAISE EXCEPTION 'VERIFY_FAIL: stale version expected VERSION_CONFLICT got %', SQLERRM;
      END IF;
  END;

  v_got := public.canonical_commit_internal_referee_match_result(v_dummy_token, 11, 5, 4);
  IF v_got IS NULL OR (v_got->>'ok')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY_FAIL: assigned commit failed %', v_got;
  END IF;
  IF v_got->>'match_id' IS DISTINCT FROM 'IT017-M1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: commit match_id=%', v_got->>'match_id';
  END IF;
  IF (v_got->>'score_a')::int IS DISTINCT FROM 11 OR (v_got->>'score_b')::int IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: commit scores %', v_got;
  END IF;

  SELECT version INTO v_dummy_version FROM public.canonical_tournaments WHERE id = v_dummy_id;
  IF v_dummy_version IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: version after commit=%', v_dummy_version;
  END IF;

  SELECT m INTO v_dummy_match
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(t.payload->'events') e
  CROSS JOIN LATERAL jsonb_array_elements(e->'matches') m
  WHERE t.id = v_dummy_id AND m->>'id' = 'IT017-M1'
  LIMIT 1;

  IF v_dummy_match->>'status' IS DISTINCT FROM 'completed'
     OR (v_dummy_match->>'scoreA')::int IS DISTINCT FROM 11
     OR (v_dummy_match->>'scoreB')::int IS DISTINCT FROM 5
     OR v_dummy_match->>'winnerId' IS DISTINCT FROM 'e1' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical match not committed %', v_dummy_match;
  END IF;

  IF (SELECT status FROM public.tournament_match_live WHERE referee_token = v_dummy_token) IS DISTINCT FROM 'locked' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: live row not locked';
  END IF;

  v_got := public.canonical_commit_internal_referee_match_result(v_dummy_token, 11, 5, 5);
  IF (v_got->>'idempotent')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY_FAIL: second same-score commit should be idempotent %', v_got;
  END IF;

  DELETE FROM public.tournament_match_live WHERE referee_token = v_dummy_token;
  DELETE FROM public.canonical_tournaments WHERE id = v_dummy_id;

  IF (SELECT score_a FROM public.tournament_match_live
      WHERE tournament_id = v_owner_id::text AND match_id = 'GA-R1-M1'
      LIMIT 1) IS DISTINCT FROM v_owner_live_a
     OR (SELECT score_b FROM public.tournament_match_live
      WHERE tournament_id = v_owner_id::text AND match_id = 'GA-R1-M1'
      LIMIT 1) IS DISTINCT FROM v_owner_live_b
     OR (SELECT status FROM public.tournament_match_live
      WHERE tournament_id = v_owner_id::text AND match_id = 'GA-R1-M1'
      LIMIT 1) IS DISTINCT FROM v_owner_live_status THEN
    RAISE EXCEPTION 'VERIFY_FAIL: OWNER_FIXTURE_LIVE_MUTATED';
  END IF;

  SELECT m INTO v_owner_match
  FROM public.canonical_tournaments t
  CROSS JOIN LATERAL jsonb_array_elements(t.payload->'events') e
  CROSS JOIN LATERAL jsonb_array_elements(e->'matches') m
  WHERE t.id = v_owner_id AND m->>'id' = 'GA-R1-M1'
  LIMIT 1;

  IF COALESCE(v_owner_match->>'status', 'waiting') NOT IN ('waiting', 'assigned', 'playing') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: OWNER_FIXTURE_CANONICAL_MUTATED %', v_owner_match;
  END IF;

  RAISE NOTICE 'VERIFY_OK IT-E2E-BROWSER-017 dummy commit CAS+idempotent; owner fixture unchanged';
END $$;

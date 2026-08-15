-- Staging-only Owner fixture canonical identity rebind.
-- This is an explicit one-row, version-checked operator CAS. Never run in Production.
--
-- Locked pgcrypto SHA-256 (digest(jsonb::text, 'sha256') hex):
-- EXPECTED_PRE_PAYLOAD_HASH=
--   56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd
-- EXPECTED_POST_PAYLOAD_HASH=
--   233df3d9994d4f26715d48ffd9e80f97337b5126322ff5112faec6533f27182e
-- EXPECTED_PROTECTED_PROJECTION_HASH=
--   56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd

BEGIN;

DO $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_payload jsonb;
  v_events jsonb;
  v_rows int;
  v_live_count int;
  v_expected_ids text[] := ARRAY[
    'GA-R1-M1', 'GA-R2-M1', 'GA-R3-M1',
    'GB-R1-M1', 'GB-R2-M1', 'GB-R3-M1'
  ];
  v_pre_hash text :=
    '56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd';
  v_post_hash text :=
    '233df3d9994d4f26715d48ffd9e80f97337b5126322ff5112faec6533f27182e';
  v_protected_hash text :=
    '56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd';
  v_projection jsonb;
  v_match_id text;
  v_assignment_count int;
  v_bad_count int;
BEGIN
  SELECT *
  INTO v_t
  FROM public.canonical_tournaments
  WHERE id = 'a5d7661a-6967-4f12-86f6-fd92a2d30de9'::uuid
  FOR UPDATE;

  IF NOT FOUND
     OR v_t.tenant_id IS DISTINCT FROM 'venue-staging-a'
     OR v_t.club_id IS DISTINCT FROM 'club-ecebf64c78f948ccb2b59842441eb26c'
     OR v_t.mode IS DISTINCT FROM 'official_tournament'
     OR v_t.status IS DISTINCT FROM 'ready'
     OR v_t.version IS DISTINCT FROM 23
     OR encode(digest(v_t.payload::text, 'sha256'), 'hex') IS DISTINCT FROM v_pre_hash
     OR md5(v_t.payload::text) IS DISTINCT FROM '7902d78e76fd5acaef081a928c3715f4' THEN
    RAISE EXCEPTION 'APPLY_ABORT: fixture CAS precondition changed';
  END IF;
  IF public.official_open_is_closed(v_t) THEN
    RAISE EXCEPTION 'APPLY_ABORT: fixture is closed';
  END IF;

  v_projection := v_t.payload;
  FOREACH v_match_id IN ARRAY v_expected_ids LOOP
    v_projection := v_projection #- ARRAY[
      'settings', 'refereeAssignments', v_match_id, 'canonicalUserId'
    ];
  END LOOP;
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(e.value->'matches') = 'array' THEN
        e.value || jsonb_build_object(
          'matches',
          (
            SELECT jsonb_agg(
              CASE
                WHEN m.value->>'id' = ANY(v_expected_ids) THEN
                  m.value #- '{referee,canonicalUserId}'
                ELSE m.value
              END
              ORDER BY m.ordinality
            )
            FROM jsonb_array_elements(e.value->'matches')
              WITH ORDINALITY AS m(value, ordinality)
          )
        )
      ELSE e.value
    END
    ORDER BY e.ordinality
  )
  INTO v_events
  FROM jsonb_array_elements(COALESCE(v_projection->'events', '[]'::jsonb))
    WITH ORDINALITY AS e(value, ordinality);
  v_projection := v_projection || jsonb_build_object(
    'events',
    COALESCE(v_events, '[]'::jsonb)
  );
  IF encode(digest(v_projection::text, 'sha256'), 'hex')
       IS DISTINCT FROM v_protected_hash THEN
    RAISE EXCEPTION 'APPLY_ABORT: locked protected projection hash changed';
  END IF;

  SELECT count(*)
  INTO v_assignment_count
  FROM jsonb_each(COALESCE(v_t.payload->'settings'->'refereeAssignments', '{}'::jsonb)) a(key, value)
  WHERE a.key = ANY(v_expected_ids);
  IF v_assignment_count <> 6
     OR (
       SELECT count(*)
       FROM jsonb_object_keys(
         COALESCE(v_t.payload->'settings'->'refereeAssignments', '{}'::jsonb)
       )
     ) <> 6 THEN
    RAISE EXCEPTION 'APPLY_ABORT: expected exactly six target assignments';
  END IF;

  SELECT count(*)
  INTO v_bad_count
  FROM jsonb_each(COALESCE(v_t.payload->'settings'->'refereeAssignments', '{}'::jsonb)) a(key, value)
  WHERE a.key = ANY(v_expected_ids)
    AND (
      NULLIF(btrim(COALESCE(a.value->>'canonicalUserId', '')), '') IS NOT NULL
      OR lower(COALESCE(a.value->>'status', 'assigned')) <> 'assigned'
      OR NULLIF(a.value->>'revokedAt', '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(a.value->>'token', '')), '') IS NULL
    );
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'APPLY_ABORT: assignment identity/token state changed';
  END IF;

  SELECT count(*)
  INTO v_assignment_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE m.value->>'id' = ANY(v_expected_ids);
  IF v_assignment_count <> 6 THEN
    RAISE EXCEPTION 'APPLY_ABORT: expected exactly six target matches';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::uuid
      AND lower(u.email) = 'tt418.referee01@staging.local'
      AND p.id = u.id AND p.role = 'REFEREE' AND p.status = 'active'
      AND p.venue_id = v_t.tenant_id
  ) OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = '8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::uuid
      AND lower(u.email) = 'tt418.referee02@staging.local'
      AND p.id = u.id AND p.role = 'REFEREE' AND p.status = 'active'
      AND p.venue_id = v_t.tenant_id
  ) THEN
    RAISE EXCEPTION 'APPLY_ABORT: canonical referee account proof changed';
  END IF;

  SELECT count(*)
  INTO v_live_count
  FROM public.tournament_match_live
  WHERE tournament_id = v_t.id::text;
  IF v_live_count <> 0 THEN
    RAISE EXCEPTION 'APPLY_ABORT: fixture has live rows under canonical row lock';
  END IF;

  v_payload := v_t.payload;
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GA-R1-M1,canonicalUserId}',
    to_jsonb('ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::text),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GA-R2-M1,canonicalUserId}',
    to_jsonb('ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::text),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GA-R3-M1,canonicalUserId}',
    to_jsonb('ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::text),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GB-R1-M1,canonicalUserId}',
    to_jsonb('8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::text),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GB-R2-M1,canonicalUserId}',
    to_jsonb('8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::text),
    true
  );
  v_payload := jsonb_set(
    v_payload,
    '{settings,refereeAssignments,GB-R3-M1,canonicalUserId}',
    to_jsonb('8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::text),
    true
  );

  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(e.value->'matches') = 'array' THEN
        e.value || jsonb_build_object(
          'matches',
          (
            SELECT jsonb_agg(
              CASE
                WHEN m.value->>'id' IN ('GA-R1-M1', 'GA-R2-M1', 'GA-R3-M1') THEN
                  jsonb_set(
                    m.value,
                    '{referee,canonicalUserId}',
                    to_jsonb('ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::text),
                    true
                  )
                WHEN m.value->>'id' IN ('GB-R1-M1', 'GB-R2-M1', 'GB-R3-M1') THEN
                  jsonb_set(
                    m.value,
                    '{referee,canonicalUserId}',
                    to_jsonb('8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::text),
                    true
                  )
                ELSE m.value
              END
              ORDER BY m.ordinality
            )
            FROM jsonb_array_elements(e.value->'matches')
              WITH ORDINALITY AS m(value, ordinality)
          )
        )
      ELSE e.value
    END
    ORDER BY e.ordinality
  )
  INTO v_events
  FROM jsonb_array_elements(COALESCE(v_payload->'events', '[]'::jsonb))
    WITH ORDINALITY AS e(value, ordinality);

  v_payload := jsonb_set(v_payload, '{events}', COALESCE(v_events, '[]'::jsonb), true);

  IF encode(digest(v_payload::text, 'sha256'), 'hex') IS DISTINCT FROM v_post_hash THEN
    RAISE EXCEPTION 'APPLY_ABORT: constructed payload is not the exact authorized identity mutation';
  END IF;

  v_projection := v_payload;
  FOREACH v_match_id IN ARRAY v_expected_ids LOOP
    v_projection := v_projection #- ARRAY[
      'settings', 'refereeAssignments', v_match_id, 'canonicalUserId'
    ];
  END LOOP;
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(e.value->'matches') = 'array' THEN
        e.value || jsonb_build_object(
          'matches',
          (
            SELECT jsonb_agg(
              CASE
                WHEN m.value->>'id' = ANY(v_expected_ids) THEN
                  m.value #- '{referee,canonicalUserId}'
                ELSE m.value
              END
              ORDER BY m.ordinality
            )
            FROM jsonb_array_elements(e.value->'matches')
              WITH ORDINALITY AS m(value, ordinality)
          )
        )
      ELSE e.value
    END
    ORDER BY e.ordinality
  )
  INTO v_events
  FROM jsonb_array_elements(COALESCE(v_projection->'events', '[]'::jsonb))
    WITH ORDINALITY AS e(value, ordinality);
  v_projection := v_projection || jsonb_build_object(
    'events',
    COALESCE(v_events, '[]'::jsonb)
  );
  IF encode(digest(v_projection::text, 'sha256'), 'hex')
       IS DISTINCT FROM v_protected_hash THEN
    RAISE EXCEPTION 'APPLY_ABORT: constructed payload changed a protected field';
  END IF;

  UPDATE public.canonical_tournaments
  SET payload = v_payload,
      version = version + 1,
      updated_at = now()
  WHERE id = v_t.id
    AND tenant_id = v_t.tenant_id
    AND club_id = v_t.club_id
    AND mode = 'official_tournament'
    AND status = 'ready'
    AND version = 23
    AND encode(digest(payload::text, 'sha256'), 'hex') = v_pre_hash;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'APPLY_ABORT: fixture CAS update did not affect exactly one row';
  END IF;

  RAISE NOTICE 'APPLY_OK: six assignment and six denormalized match identities rebound';
END;
$$;

COMMIT;

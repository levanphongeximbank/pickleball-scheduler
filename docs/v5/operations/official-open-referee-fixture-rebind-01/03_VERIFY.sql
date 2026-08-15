-- Staging-only Owner fixture identity rebind: READ-ONLY verify.
--
-- Locked pgcrypto SHA-256 (digest(jsonb::text, 'sha256') hex):
-- EXPECTED_PRE_PAYLOAD_HASH=
--   56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd
-- EXPECTED_POST_PAYLOAD_HASH=
--   233df3d9994d4f26715d48ffd9e80f97337b5126322ff5112faec6533f27182e
-- EXPECTED_PROTECTED_PROJECTION_HASH=
--   56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd

DO $$
DECLARE
  v_t public.canonical_tournaments%ROWTYPE;
  v_expected_ids text[] := ARRAY[
    'GA-R1-M1', 'GA-R2-M1', 'GA-R3-M1',
    'GB-R1-M1', 'GB-R2-M1', 'GB-R3-M1'
  ];
  v_post_hash text :=
    '233df3d9994d4f26715d48ffd9e80f97337b5126322ff5112faec6533f27182e';
  v_protected_hash text :=
    '56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd';
  v_count int;
  v_projection jsonb;
  v_events jsonb;
  v_match_id text;
BEGIN
  SELECT *
  INTO v_t
  FROM public.canonical_tournaments
  WHERE id = 'a5d7661a-6967-4f12-86f6-fd92a2d30de9'::uuid;

  IF NOT FOUND
     OR v_t.tenant_id IS DISTINCT FROM 'venue-staging-a'
     OR v_t.club_id IS DISTINCT FROM 'club-ecebf64c78f948ccb2b59842441eb26c'
     OR v_t.mode IS DISTINCT FROM 'official_tournament'
     OR v_t.status IS DISTINCT FROM 'ready'
     OR v_t.version IS DISTINCT FROM 24 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: fixture scope/status/version';
  END IF;

  IF encode(digest(v_t.payload::text, 'sha256'), 'hex') IS DISTINCT FROM v_post_hash THEN
    RAISE EXCEPTION 'VERIFY_FAIL: POST payload hash is not the exact authorized identity mutation';
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
    RAISE EXCEPTION 'VERIFY_FAIL: protected projection hash changed; mutation was not identity-only';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM jsonb_each(COALESCE(v_t.payload->'settings'->'refereeAssignments', '{}'::jsonb)) a(key, value)
  WHERE a.key = ANY(v_expected_ids)
    AND a.value->>'canonicalUserId' = CASE
      WHEN a.key LIKE 'GA-%' THEN 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'
      ELSE '8bb178b3-c0d8-4965-848d-2de9d73fa9d6'
    END
    AND lower(COALESCE(a.value->>'status', 'assigned')) = 'assigned'
    AND NULLIF(a.value->>'revokedAt', '') IS NULL
    AND NULLIF(btrim(COALESCE(a.value->>'token', '')), '') IS NOT NULL;
  IF v_count <> 6
     OR (
       SELECT count(*)
       FROM jsonb_object_keys(
         COALESCE(v_t.payload->'settings'->'refereeAssignments', '{}'::jsonb)
       )
     ) <> 6 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: six canonical assignment identities not present';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE m.value->>'id' = ANY(v_expected_ids)
    AND m.value->'referee'->>'canonicalUserId' = CASE
      WHEN m.value->>'id' LIKE 'GA-%' THEN 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'
      ELSE '8bb178b3-c0d8-4965-848d-2de9d73fa9d6'
    END
    AND m.value->'referee'->>'token' =
        v_t.payload->'settings'->'refereeAssignments'->(m.value->>'id')->>'token';
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: six denormalized match identities/token bindings not present';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE lower(COALESCE(m.value->>'status', '')) IN ('completed', 'forfeit');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: fixture result state changed';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.tournament_match_live
  WHERE tournament_id = v_t.id::text;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: fixture live rows were created';
  END IF;

  RAISE NOTICE 'VERIFY_OK: exact six-record canonical identity rebind';
  RAISE NOTICE 'VERIFY_OK: VERIFY_EXACT_POST_PAYLOAD_HASH=YES';
  RAISE NOTICE 'VERIFY_OK: PROTECTED_PROJECTION_HASH_BEFORE_AFTER_EQUAL=YES';
  RAISE NOTICE 'VERIFY_OK: FIXTURE_VERIFY_IDENTITY_ONLY_MUTATION=YES';
  RAISE NOTICE 'VERIFY_OK: token/live/result state unchanged';
END;
$$;

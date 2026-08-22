-- Staging-only Owner fixture identity rebind: READ-ONLY precheck.
-- Never run against Production.
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
  v_pre_hash text :=
    '56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd';
  v_protected_hash text :=
    '56f466152e7cdf3197873136b0620bc4d6d757f08d2a69de315dc9f015391cfd';
  v_assignment_count int;
  v_completed_count int;
  v_live_count int;
  v_bad_count int;
  v_payload_hash text;
  v_projection jsonb;
  v_events jsonb;
  v_match_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: pgcrypto is required for payload digest';
  END IF;

  SELECT *
  INTO v_t
  FROM public.canonical_tournaments
  WHERE id = 'a5d7661a-6967-4f12-86f6-fd92a2d30de9'::uuid;

  IF NOT FOUND
     OR v_t.tenant_id IS DISTINCT FROM 'venue-staging-a'
     OR v_t.club_id IS DISTINCT FROM 'club-ecebf64c78f948ccb2b59842441eb26c'
     OR v_t.mode IS DISTINCT FROM 'official_tournament'
     OR v_t.status IS DISTINCT FROM 'ready'
     OR v_t.version IS DISTINCT FROM 23 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: fixture scope/version changed';
  END IF;

  v_payload_hash := encode(digest(v_t.payload::text, 'sha256'), 'hex');
  IF v_payload_hash IS DISTINCT FROM v_pre_hash
     OR md5(v_t.payload::text) IS DISTINCT FROM '7902d78e76fd5acaef081a928c3715f4' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: fixture PRE payload hash changed';
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
    RAISE EXCEPTION 'PRECHECK_FAIL: protected projection hash changed';
  END IF;

  IF public.official_open_is_closed(v_t)
     OR COALESCE(NULLIF(v_t.payload->>'completedAt', ''), '') <> '' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: fixture already closed/completed';
  END IF;

  SELECT count(*)
  INTO v_completed_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE lower(COALESCE(m.value->>'status', '')) IN ('completed', 'forfeit');
  IF v_completed_count <> 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: fixture has completed matches';
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
    RAISE EXCEPTION 'PRECHECK_FAIL: expected exactly six target assignments';
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
      OR a.value->>'rosterId' IS DISTINCT FROM CASE
        WHEN a.key LIKE 'GA-%' THEN 'ref-roster-1fda59b8'
        ELSE 'ref-roster-ec542538'
      END
      OR a.value->>'refereeName' IS DISTINCT FROM CASE
        WHEN a.key LIKE 'GA-%' THEN 'tt418.referee01@staging.local'
        ELSE 'tt418.referee02@staging.local'
      END
    );
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: assignment identity/token state changed';
  END IF;

  SELECT count(*)
  INTO v_assignment_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE m.value->>'id' = ANY(v_expected_ids);
  IF v_assignment_count <> 6 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: expected exactly six target matches';
  END IF;

  SELECT count(*)
  INTO v_bad_count
  FROM jsonb_array_elements(COALESCE(v_t.payload->'events', '[]'::jsonb)) e(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.value->'matches', '[]'::jsonb)) m(value)
  WHERE m.value->>'id' = ANY(v_expected_ids)
    AND (
      NULLIF(btrim(COALESCE(m.value->'referee'->>'canonicalUserId', '')), '') IS NOT NULL
      OR m.value->'referee'->>'name' IS DISTINCT FROM CASE
        WHEN m.value->>'id' LIKE 'GA-%' THEN 'tt418.referee01@staging.local'
        ELSE 'tt418.referee02@staging.local'
      END
      OR m.value->'referee'->>'token' IS DISTINCT FROM
         v_t.payload->'settings'->'refereeAssignments'->(m.value->>'id')->>'token'
    );
  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: denormalized match referee state changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = 'ca78575b-c5bf-4d32-bd7c-cc3027fea2a5'::uuid
      AND lower(u.email) = 'tt418.referee01@staging.local'
      AND p.id = u.id AND lower(p.email) = lower(u.email)
      AND p.role = 'REFEREE' AND p.status = 'active'
      AND p.venue_id = 'venue-staging-a'
  ) OR (
    SELECT count(*) FROM auth.users WHERE lower(email) = 'tt418.referee01@staging.local'
  ) <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: Referee 01 canonical account is not unique/active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = '8bb178b3-c0d8-4965-848d-2de9d73fa9d6'::uuid
      AND lower(u.email) = 'tt418.referee02@staging.local'
      AND p.id = u.id AND lower(p.email) = lower(u.email)
      AND p.role = 'REFEREE' AND p.status = 'active'
      AND p.venue_id = 'venue-staging-a'
  ) OR (
    SELECT count(*) FROM auth.users WHERE lower(email) = 'tt418.referee02@staging.local'
  ) <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: Referee 02 canonical account is not unique/active';
  END IF;

  SELECT count(*)
  INTO v_live_count
  FROM public.tournament_match_live
  WHERE tournament_id = v_t.id::text;
  IF v_live_count <> 0 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: fixture unexpectedly has live rows';
  END IF;

  RAISE NOTICE 'PRECHECK_OK: exact six-record Staging fixture identity rebind';
  RAISE NOTICE 'PRECHECK_OK: PRECHECK_EXACT_PRE_PAYLOAD_HASH=YES';
END;
$$;

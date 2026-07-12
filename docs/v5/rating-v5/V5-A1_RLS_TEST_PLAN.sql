-- V5-A.1 RLS verification queries (staging — NOT RUN until migration applied)
-- Run as: staging QA with two test users (user_a, user_b) in different tenants
-- Expected: each test documents PASS/FAIL in docs/v5/rating-v5/V5-A1_RLS_TEST_RESULTS.md

-- ─── Setup markers (manual seed before tests) ───────────────────
-- insert test profiles user_a (tenant A), user_b (tenant B)
-- apply PHASE_V5A_RATING_FOUNDATION.sql first

-- TEST 1: User A cannot read User B private assessment
-- SET ROLE authenticated; SET request.jwt.claim.sub = user_a;
-- SELECT count(*) FROM player_skill_assessments WHERE player_id = user_b;
-- EXPECT: 0

-- TEST 2: User A cannot update User B profile
-- UPDATE player_rating_profiles SET display_rating = 5.0 WHERE player_id = user_b;
-- EXPECT: permission denied or 0 rows

-- TEST 3: User cannot set verified rating via direct insert
-- INSERT INTO player_rating_profiles (tenant_id, player_id, rating_mode, verified_rating_mean)
-- VALUES ('tenant-a', auth.uid(), 'doubles', 5.0);
-- EXPECT: policy violation (insert denied)

-- TEST 4: User cannot set evidence level 4–5 on submit
-- INSERT INTO rating_evidence (tenant_id, player_id, rating_mode, evidence_type, evidence_level, submitted_by)
-- VALUES ('tenant-a', auth.uid(), 'doubles', 'coach', 5, auth.uid());
-- EXPECT: policy violation (evidence_level <= 3)

-- TEST 5: User cannot UPDATE rating event
-- UPDATE player_rating_events SET post_rating_mean = 6.0 WHERE player_id = auth.uid();
-- EXPECT: trigger exception append-only

-- TEST 6: User cannot DELETE rating event
-- DELETE FROM player_rating_events WHERE player_id = auth.uid();
-- EXPECT: trigger exception append-only

-- TEST 7: User cannot INSERT rating event directly
-- INSERT INTO player_rating_events (tenant_id, player_id, rating_mode, event_type, source_type)
-- VALUES ('tenant-a', auth.uid(), 'doubles', 'match', 'open');
-- EXPECT: policy violation

-- TEST 8: Coach cannot UPDATE canonical profile
-- (as coach role) UPDATE player_rating_profiles SET open_rating_mean = 4.0 WHERE player_id = player_x;
-- EXPECT: denied

-- TEST 9: Tenant A cannot read tenant B profile
-- SELECT count(*) FROM player_rating_profiles WHERE tenant_id = 'tenant-b';
-- EXPECT: 0 for user in tenant A

-- TEST 10: Service RPC can upsert shadow profile
-- (as service_role) SELECT rating_v5_service_upsert_profile(user_a, 'doubles', '{"isShadow":true}');
-- EXPECT: ok true

-- Automated runner: scripts/verify-v5a1-rls-staging.mjs (V5-B.1 wiring)

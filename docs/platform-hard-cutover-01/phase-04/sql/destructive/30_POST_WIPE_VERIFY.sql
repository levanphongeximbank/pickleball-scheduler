-- PLATFORM-HARD-CUTOVER-01 Phase 4 — Post-wipe / post-drop verification (READ-ONLY)
-- NOT executed by this PR.

-- Protected intact
SELECT
  (SELECT count(*) FROM auth.users) AS auth_n,
  (SELECT count(*) FROM public.profiles) AS profiles_n,
  (SELECT count(*) FROM public.venues) AS venues_n,
  (SELECT count(*) FROM public.tenant_members) AS tm_n,
  (SELECT count(*) FROM public.roles) AS roles_n,
  (SELECT count(*) FROM public.permissions) AS permissions_n,
  (SELECT count(*) FROM public.role_permissions) AS rp_n,
  (SELECT count(*) FROM public.plans) AS plans_n,
  (SELECT count(*) FROM public.plan_limits) AS plan_limits_n;

-- Biz tables empty (sample critical)
SELECT
  (SELECT count(*) FROM public.club_data_v3) AS club_data_v3_n,
  (SELECT count(*) FROM public.clubs) AS clubs_n,
  (SELECT count(*) FROM public.team_tournaments) AS tt_n,
  (SELECT count(*) FROM public.pick_vn_player_ratings) AS ratings_n,
  (SELECT count(*) FROM public.athletes) AS athletes_n,
  (SELECT count(*) FROM public.tournament_match_live) AS match_live_n;

-- club_ai_data must be gone
SELECT EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'club_ai_data' AND c.relkind = 'r'
) AS club_ai_data_exists;
-- Expect: false

-- club_data_v3 policies intact
SELECT pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'club_data_v3'
ORDER BY 1;

-- Public catalog RPCs intact
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'public_catalog_list_%'
ORDER BY 1;

-- Optional logical-manifest tables (exact allowlist of 10):
-- absent ⇒ accepted; present ⇒ must be empty after wipe (literal guards only).
SELECT
  to_regclass('public._phase19b_test_accounts') IS NOT NULL AS phase19b_present,
  to_regclass('public.ai_workflow_checklists') IS NOT NULL AS ai_workflow_present,
  to_regclass('public.court_claim_requests') IS NOT NULL AS court_claim_present,
  to_regclass('public.tournament_certifications') IS NOT NULL AS tournament_cert_present,
  to_regclass('public.vpr_athlete_links') IS NOT NULL AS vpr_links_present,
  to_regclass('public.vpr_athletes') IS NOT NULL AS vpr_athletes_present,
  to_regclass('public.vpr_audit_logs') IS NOT NULL AS vpr_audit_present,
  to_regclass('public.vpr_leaderboard') IS NOT NULL AS vpr_leaderboard_present,
  to_regclass('public.vpr_point_config') IS NOT NULL AS vpr_config_present,
  to_regclass('public.vpr_point_ledger') IS NOT NULL AS vpr_ledger_present;

DO $$
DECLARE
  v_n bigint;
BEGIN
  IF to_regclass('public._phase19b_test_accounts') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public._phase19b_test_accounts' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: _phase19b_test_accounts not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.ai_workflow_checklists') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.ai_workflow_checklists' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: ai_workflow_checklists not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.court_claim_requests') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.court_claim_requests' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: court_claim_requests not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.tournament_certifications') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.tournament_certifications' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: tournament_certifications not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_athlete_links') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_athlete_links' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_athlete_links not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_athletes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_athletes' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_athletes not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_audit_logs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_audit_logs' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_audit_logs not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_leaderboard') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_leaderboard' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_leaderboard not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_point_config') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_point_config' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_point_config not empty (%)', v_n; END IF;
  END IF;
  IF to_regclass('public.vpr_point_ledger') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.vpr_point_ledger' INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'POST_WIPE: vpr_point_ledger not empty (%)', v_n; END IF;
  END IF;
END $$;

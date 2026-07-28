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

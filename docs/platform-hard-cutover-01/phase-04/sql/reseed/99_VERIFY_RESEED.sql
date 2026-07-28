-- Post-reseed verification (read-only). NOT run in Phase 4 / remediation PR.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_n,
  (SELECT count(*) FROM public.venues) AS venues_n,
  (SELECT count(*) FROM public.tenant_members) AS tm_n,
  (SELECT count(*) FROM public.clubs) AS clubs_n,
  (SELECT count(*) FROM public.club_data_v3) AS club_blob_n,
  (SELECT count(*) FROM public.court_clusters) AS clusters_n,
  (SELECT count(*) FROM public.courts) AS courts_n,
  (SELECT count(*) FROM public.competition_ssot_competitions) AS comps_n,
  (SELECT count(*) FROM public.competition_ssot_participants) AS participants_n,
  (SELECT count(*) FROM public.competition_ssot_matches) AS matches_n,
  (SELECT count(*) FROM public.competition_ssot_finalized_results) AS finalized_n;

-- Seed key presence (when biz tables reseeded)
SELECT external_key, status
FROM public.competition_ssot_competitions
WHERE external_key LIKE 'hard-cutover-seed::%'
ORDER BY external_key;

-- Expect: auth/venues/tm unchanged from pre-wipe snapshot; biz tables >= 0 after seed;
-- finalized_results.source = competition_ssot_finalize only for seed path.

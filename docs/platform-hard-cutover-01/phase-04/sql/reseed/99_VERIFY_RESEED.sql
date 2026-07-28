-- Post-reseed verification (read-only). NOT run in Phase 4.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_n,
  (SELECT count(*) FROM public.venues) AS venues_n,
  (SELECT count(*) FROM public.tenant_members) AS tm_n,
  (SELECT count(*) FROM public.clubs) AS clubs_n,
  (SELECT count(*) FROM public.club_data_v3) AS club_blob_n,
  (SELECT count(*) FROM public.court_clusters) AS clusters_n,
  (SELECT count(*) FROM public.competition_ssot_competitions) AS comps_n,
  (SELECT count(*) FROM public.competition_ssot_finalized_results) AS finalized_n;

-- Expect: auth/venues/tm unchanged from pre-wipe snapshot; biz tables >= 0 after seed.

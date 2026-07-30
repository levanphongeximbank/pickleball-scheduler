-- PLATFORM-HARD-CUTOVER Staging rollback
-- TARGET ONLY: qyewbxjsiiyufanzcjcq
-- Pre-state for this package: rating_v5_rollout_config = 0 rows,
-- rating_v5_pilot_enrollments = 0 rows.
-- Do NOT auto-run. Owner GO required.

-- 1) Remove exact enrollment created/updated by this package key.
delete from public.rating_v5_pilot_enrollments
where player_id = '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c'::uuid
  and cohort_label = 'phase4-owner-acceptance'
  and tenant_id = 'venue-staging-a';

-- 2) Restore rollout_config pre-state (empty): delete default row only if it
-- still carries this package's cohort label.
delete from public.rating_v5_rollout_config
where id = 'default'
  and pilot_cohort_label = 'phase4-owner-acceptance';

-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Enroll exactly one pinned Operator actor for phase4-owner-acceptance.
--
-- Actor pin provenance (no display name):
--   public.clubs.created_by_user_id for
--   name = 'HC Operator Seed Club venue-staging-a'
--   tenant_id = 'venue-staging-a'
--   → auth/profile/player_id = 13e0968b-53c5-4ba6-8ae0-dce12b1faf9c
-- Duplicate VENUE_OWNER on same venue is intentionally NOT enrolled.

insert into public.rating_v5_pilot_enrollments (
  tenant_id,
  player_id,
  cohort_label,
  status,
  enrolled_at,
  notes,
  version,
  updated_at
)
values (
  'venue-staging-a',
  '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c'::uuid,
  'phase4-owner-acceptance',
  'active',
  now(),
  'hard-cutover-phase4-owner-acceptance::pinned-operator',
  1,
  now()
)
on conflict (player_id, cohort_label) do update set
  tenant_id = excluded.tenant_id,
  status = 'active',
  paused_at = null,
  removed_at = null,
  expires_at = null,
  notes = excluded.notes,
  updated_at = now()
where public.rating_v5_pilot_enrollments.player_id = '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c'::uuid
  and public.rating_v5_pilot_enrollments.cohort_label = 'phase4-owner-acceptance';

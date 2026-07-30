-- Read-only verify for Staging owner pilot activation.
-- TARGET ONLY: qyewbxjsiiyufanzcjcq

select id, shadow_mode_enabled, allow_v5_assessment, pilot_cohort_label
from public.rating_v5_rollout_config
where id = 'default';

select
  left(player_id::text, 4) || '***' || right(player_id::text, 4) as masked_player_id,
  tenant_id,
  cohort_label,
  status
from public.rating_v5_pilot_enrollments
where cohort_label = 'phase4-owner-acceptance'
order by player_id;

-- Expect exactly one enrollment for the pinned actor
select count(*)::int as phase4_enrollment_count
from public.rating_v5_pilot_enrollments
where cohort_label = 'phase4-owner-acceptance';

select public.rating_v5_assert_pilot_gate(
  '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c'::uuid,
  'venue-staging-a',
  'start'
) as pilot_gate;

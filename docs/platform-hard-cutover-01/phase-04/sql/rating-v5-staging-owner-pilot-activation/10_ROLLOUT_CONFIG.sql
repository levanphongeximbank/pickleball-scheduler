-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Upsert exactly one default rollout config enabling V5 assessment in shadow mode.

insert into public.rating_v5_rollout_config (
  id,
  shadow_mode_enabled,
  pilot_cohort_label,
  allow_v5_assessment,
  allow_v5_profile_write,
  compare_v2_enabled,
  max_completed_assessments,
  cooldown_days,
  allow_manual_reassessment,
  reassessment_requires_approval,
  updated_at
)
values (
  'default',
  true,
  'phase4-owner-acceptance',
  true,
  true,
  true,
  1,
  7,
  true,
  true,
  now()
)
on conflict (id) do update set
  shadow_mode_enabled = excluded.shadow_mode_enabled,
  pilot_cohort_label = excluded.pilot_cohort_label,
  allow_v5_assessment = excluded.allow_v5_assessment,
  allow_v5_profile_write = excluded.allow_v5_profile_write,
  compare_v2_enabled = excluded.compare_v2_enabled,
  max_completed_assessments = excluded.max_completed_assessments,
  cooldown_days = excluded.cooldown_days,
  allow_manual_reassessment = excluded.allow_manual_reassessment,
  reassessment_requires_approval = excluded.reassessment_requires_approval,
  updated_at = now();

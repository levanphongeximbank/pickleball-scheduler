-- PLATFORM-HARD-CUTOVER Staging remediation
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Upsert exactly one default rollout config enabling V5 assessment in shadow mode.
-- Explicit fields only: id, shadow_mode_enabled, allow_v5_assessment, pilot_cohort_label.
-- Remaining columns keep table defaults (no calibration/admin grants).

insert into public.rating_v5_rollout_config (
  id,
  shadow_mode_enabled,
  pilot_cohort_label,
  allow_v5_assessment
)
values (
  'default',
  true,
  'phase4-owner-acceptance',
  true
)
on conflict (id) do update set
  shadow_mode_enabled = excluded.shadow_mode_enabled,
  pilot_cohort_label = excluded.pilot_cohort_label,
  allow_v5_assessment = excluded.allow_v5_assessment,
  updated_at = now();

-- V5-P1 — Post-migration verification queries (Production)
-- Run after P1-B apply only. Read-only checks.

-- V1: Project sanity — replace with owner-confirmed production ref
select current_database() as db, current_user as role;

-- V2: Rollout config (assessment must be OFF at first deploy)
select
  id,
  shadow_mode_enabled,
  compare_v2_enabled,
  allow_v5_assessment,
  pilot_cohort_label,
  max_completed_assessments,
  cooldown_days,
  reassessment_requires_approval
from public.rating_v5_rollout_config
where id = 'default';
-- expect: allow_v5_assessment = false, pilot_cohort_label = club-rating-v5-production-pilot

-- V3: Enrollment SOT tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'rating_v5_pilot_enrollments',
    'rating_v5_reassessment_approvals',
    'player_rating_profiles',
    'player_skill_assessments',
    'player_rating_events'
  )
order by table_name;
-- expect: 5 rows

-- V4: Pilot gate RPC exists
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'rating_v5_assert_pilot_gate',
    'rating_v5_get_my_pilot_enrollment',
    'rating_v5_admin_upsert_pilot_enrollment',
    'rating_v5_invalidate_assessment',
    'rating_v5_recompute_shadow_profile'
  )
order by routine_name;
-- expect: 5 rows

-- V5: No enrollments at go-live
select count(*) as active_enrollments
from public.rating_v5_pilot_enrollments
where status = 'active';
-- expect: 0 before Wave A

-- V6: V2 isolation snapshot
select count(*) as v2_rows from public.pick_vn_player_ratings;
-- compare to pre-migration snapshot; must match

-- V7: Profile traceability columns
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'player_rating_profiles'
  and column_name in (
    'source_assessment_id',
    'source_event_id',
    'source_selection_reason',
    'source_selected_at',
    'profile_version'
  )
order by column_name;
-- expect: 5 rows

-- V8: Invalidation columns on assessments
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'player_skill_assessments'
  and column_name in ('invalidated_at', 'lifecycle_version', 'invalidation_reason_code')
order by column_name;
-- expect: 3 rows

-- V9: RLS enabled on enrollment tables
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('rating_v5_pilot_enrollments', 'rating_v5_reassessment_approvals');
-- expect: rowsecurity = true for both

-- V10: Non-enrolled gate (run as authenticated test user JWT context)
-- select public.rating_v5_assert_pilot_gate('<player_uuid>', '<tenant_id>', 'start');
-- expect: {"ok":false,"code":"PILOT_NOT_ENROLLED"}

-- Phase 1C — verification queries (read-mostly; negative probes commented)
-- See docs/player-management/phase-1c-migration-sql/06_STATIC_VERIFICATION_SQL.md

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'birth_date',
    'handedness',
    'activity_region',
    'privacy_settings',
    'identity_verification_status',
    'birth_year',
    'gender',
    'player_id'
  )
order by column_name;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname in (
    'profiles_birth_date_not_future_check',
    'profiles_handedness_check',
    'profiles_identity_verification_status_check',
    'profiles_privacy_settings_object_check',
    'profiles_privacy_settings_booleans_check',
    'profiles_activity_region_object_check'
  )
order by conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'profiles'
  and indexname = 'profiles_identity_verification_status_partial_idx';

select
  proname,
  position('identity_verification_status' in pg_get_functiondef(oid)) > 0 as guards_verification
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'profiles_guard_privileged_update';

select
  count(*) as total_profiles,
  count(*) filter (where privacy_settings is null) as privacy_null,
  count(*) filter (where identity_verification_status is null) as verification_null,
  count(*) filter (where birth_date is not null) as birth_date_populated,
  count(*) filter (where handedness is not null) as handedness_populated,
  count(*) filter (where activity_region is not null) as region_populated
from public.profiles;

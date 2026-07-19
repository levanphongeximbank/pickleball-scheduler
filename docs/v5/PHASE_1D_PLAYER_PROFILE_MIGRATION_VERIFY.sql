-- =============================================================================
-- Phase 1D — Player Profile Migration VERIFY (read-mostly)
-- Staging readiness checks after PHASE_1D_PLAYER_PROFILE_MIGRATION.sql
-- =============================================================================

-- Columns
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

-- Constraints
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

-- Index
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'profiles'
  and indexname = 'profiles_identity_verification_status_partial_idx';

-- Guard function: no SECURITY DEFINER owner bypass; self verification blocked
select
  proname,
  prosecdef as security_definer,
  position('current_user' in pg_get_functiondef(oid)) > 0
    and position($$current_user = 'postgres'$$ in pg_get_functiondef(oid)) > 0
    as has_current_user_postgres_bypass,
  position('Cannot self-modify identity_verification_status' in pg_get_functiondef(oid)) > 0
    as has_self_verification_block,
  position($$user_has_permission('user.manage')$$ in pg_get_functiondef(oid)) > 0
    as has_user_manage_path,
  position($$v_auth_role = 'service_role'$$ in pg_get_functiondef(oid)) > 0
    as has_service_role_bypass
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'profiles_guard_privileged_update';

-- Trigger present
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
  and tgname = 'profiles_guard_privileged_update_trg';

-- Sanity counts (privacy_null and verification_null should be 0)
select
  count(*) as total_profiles,
  count(*) filter (where privacy_settings is null) as privacy_null,
  count(*) filter (where identity_verification_status is null) as verification_null,
  count(*) filter (where birth_date is not null) as birth_date_populated,
  count(*) filter (where handedness is not null) as handedness_populated,
  count(*) filter (where activity_region is not null) as region_populated,
  count(*) filter (where birth_year is not null) as birth_year_populated
from public.profiles;

-- Expectation aliases for operator checklist
select
  (select count(*) = 0 from public.profiles where privacy_settings is null) as privacy_backfill_ok,
  (select count(*) = 0 from public.profiles where identity_verification_status is null) as verification_backfill_ok,
  (
    select position($$current_user = 'postgres'$$ in pg_get_functiondef(oid)) = 0
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'profiles_guard_privileged_update'
  ) as no_current_user_postgres_bypass;

-- =============================================================================
-- Phase 1E — Production PREFLIGHT (READ-ONLY)
-- Player Management profile migration readiness inventory
--
-- DOES NOT: INSERT / UPDATE / DELETE / ALTER / DROP / CREATE
-- DOES NOT: apply PHASE_1D_PLAYER_PROFILE_MIGRATION.sql
--
-- Confirm environment is Production (ref expuvcohlcjzvrrauvud) before running.
-- Never run against Staging with Production conclusions.
-- =============================================================================

-- 1) Required columns
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

-- 2) Required constraints
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

-- 3) Duplicate constraint names on profiles (should be empty for Phase 1D names)
select conname, count(*) as copies
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like 'profiles_%'
group by conname
having count(*) > 1
order by conname;

-- 4) Partial index
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'profiles'
  and indexname = 'profiles_identity_verification_status_partial_idx';

-- 5) Guard function safety signals
select
  proname,
  prosecdef as security_definer,
  position($$current_user = 'postgres'$$ in pg_get_functiondef(oid)) > 0
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

-- 6) Trigger attachment
select tgname, tgenabled, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
  and tgname = 'profiles_guard_privileged_update_trg';

-- 7) Other UPDATE triggers on profiles (conflict inventory)
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
  and tgtype & 16 = 16 -- UPDATE
order by tgname;

-- 8) Null / invalid value sanity
select
  count(*)::bigint as total_profiles,
  count(*) filter (where privacy_settings is null)::bigint as privacy_null,
  count(*) filter (where identity_verification_status is null)::bigint as verification_null,
  count(*) filter (
    where handedness is not null
      and handedness not in ('right', 'left', 'ambidextrous', 'unknown')
  )::bigint as invalid_handedness,
  count(*) filter (
    where identity_verification_status is not null
      and identity_verification_status not in ('unverified', 'pending', 'verified', 'rejected')
  )::bigint as invalid_verification
from public.profiles;

-- 9) RLS enabled + policy names (inventory only; compare to baseline in runbook)
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.profiles'::regclass;

select polname, polcmd, polpermissive
from pg_policy
where polrelid = 'public.profiles'::regclass
order by polname;

-- 10) Grants inventory (table-level)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'profiles'
order by grantee, privilege_type;

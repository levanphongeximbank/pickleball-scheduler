-- Phase 1C — Guard auth hotfix verification (read-mostly)
-- Run after applying PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX.sql on Staging.

-- 1) Function exists, SECURITY DEFINER, search_path public
select
  p.proname,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) like '%SET search_path TO ''public''%' 
    or pg_get_functiondef(p.oid) like '%SET search_path = public%' as has_search_path_public,
  position('current_user = ''postgres''' in pg_get_functiondef(p.oid)) = 0 as no_current_user_postgres_bypass,
  position('service_role' in pg_get_functiondef(p.oid)) > 0 as has_service_role_bypass,
  position('Cannot self-modify identity_verification_status' in pg_get_functiondef(p.oid)) > 0 as has_self_verification_block,
  position('user.manage' in pg_get_functiondef(p.oid)) > 0 as has_user_manage_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'profiles_guard_privileged_update';

-- 2) Trigger still attached
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and tgname = 'profiles_guard_privileged_update_trg'
  and not tgisinternal;

-- 3) RLS unchanged (enabled)
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.profiles'::regclass;

-- 4) Phase 1C columns still present (hotfix must not drop them)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'birth_date',
    'handedness',
    'activity_region',
    'privacy_settings',
    'identity_verification_status'
  )
order by column_name;

-- Negative probe (authenticated JWT self-session; expect FAIL):
-- update public.profiles
-- set identity_verification_status = 'pending'
-- where id = auth.uid();

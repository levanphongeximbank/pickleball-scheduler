-- =============================================================================
-- Phase 1I-B — Public Player Directory read model VERIFY (static / post-apply)
-- Pair: docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql
--
-- Run after Staging apply (separate Owner token). Safe read-only checks.
-- This file does NOT mutate data.
-- =============================================================================

-- 1) Functions exist with expected signatures
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  p.prosecdef as is_security_definer,
  p.provolatile as volatility -- s=stable, i=immutable, v=volatile
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'player_directory_search',
    'player_directory_get',
    'player_directory_format_activity_region',
    'player_directory_encode_cursor',
    'player_directory_decode_cursor',
    'player_directory_project_row'
  )
order by p.proname;

-- 2) search_path hardening on DEFINER RPCs
select
  p.proname,
  pg_get_functiondef(p.oid) like '%SET search_path TO ''pg_catalog'', ''public''%'
    or pg_get_functiondef(p.oid) like '%SET search_path = pg_catalog, public%'
    as has_hardened_search_path,
  p.prosecdef as is_security_definer,
  position('auth.uid()' in pg_get_functiondef(p.oid)) > 0 as checks_auth_uid,
  position('privacy_settings' in pg_get_functiondef(p.oid)) > 0 as reads_privacy_internally,
  position('''privacy_settings''' in pg_get_functiondef(p.oid)) > 0
    or position('"privacy_settings"' in pg_get_functiondef(p.oid)) > 0
    as emits_privacy_settings_key
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('player_directory_search', 'player_directory_get');

-- Expect: has_hardened_search_path=true, is_security_definer=true,
--         checks_auth_uid=true, emits_privacy_settings_key=false

-- 3) EXECUTE privileges
select
  p.proname,
  r.rolname as grantee,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join pg_roles r
where n.nspname = 'public'
  and p.proname in ('player_directory_search', 'player_directory_get')
  and r.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by p.proname, r.rolname;

-- Expect: authenticated can_execute=true; anon can_execute=false

-- 4) Helpers not executable by anon/authenticated
select
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'player_directory_format_activity_region',
    'player_directory_encode_cursor',
    'player_directory_decode_cursor',
    'player_directory_project_row'
  )
order by p.proname;

-- Expect: anon_execute=false, authenticated_execute=false

-- 5) Indexes present
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'profiles_directory_eligible_name_id_idx',
    'profiles_directory_player_id_idx'
  )
order by indexname;

-- 6) Forbidden output keys must not appear as emitted JSON keys in projector
select
  position('"privacy_settings"' in pg_get_functiondef(p.oid)) = 0
    and position('''privacy_settings''' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_privacy_key,
  position('"identity_verification_status"' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_verification_key,
  position('"status"' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_status_key,
  position('"venue_id"' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_venue_key,
  position('"email"' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_email_key,
  position('"phone"' in pg_get_functiondef(p.oid)) = 0
    as projector_omits_phone_key,
  position('"player_id"' in pg_get_functiondef(p.oid)) > 0
    as projector_emits_player_id,
  position('"activity_region"' in pg_get_functiondef(p.oid)) > 0
    as projector_emits_activity_region,
  position('is_verified' in pg_get_functiondef(p.oid)) > 0
    as projector_emits_is_verified
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'player_directory_project_row';

-- 7) Cursor helpers recognize pd1 prefix / version
-- (Post-apply smoke; skip if not authenticated in this session)
-- select public.player_directory_encode_cursor('alpha', 'p_1');
-- select public.player_directory_decode_cursor(
--   public.player_directory_encode_cursor('alpha', 'p_1')
-- );

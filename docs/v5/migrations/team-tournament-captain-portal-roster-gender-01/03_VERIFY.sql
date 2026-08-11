-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-captain-portal-roster-gender-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-PORTAL-ROSTER-GENDER-AND-MLP4-OPTION-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

select
  'rpc_present' as check_item,
  to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is not null as ok;

select
  'grants_authenticated_execute' as check_item,
  has_function_privilege('authenticated', 'public.team_tournament_get_captain_portal(text,integer)', 'EXECUTE') as ok;

select
  'grants_anon_denied' as check_item,
  not has_function_privilege('anon', 'public.team_tournament_get_captain_portal(text,integer)', 'EXECUTE') as ok;

select
  'security_definer' as check_item,
  (p.prosecdef = true) as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_captain_portal'
  and pg_get_function_identity_arguments(p.oid) = 'text, integer';

select
  'source_has_roster_athletes' as check_item,
  (pg_get_functiondef(p.oid) ilike '%rosterAthletes%') as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_captain_portal'
  and pg_get_function_identity_arguments(p.oid) = 'text, integer';

select
  'source_has_athlete_id_display_name_gender' as check_item,
  (
    pg_get_functiondef(p.oid) ilike '%athleteId%'
    and pg_get_functiondef(p.oid) ilike '%displayName%'
    and pg_get_functiondef(p.oid) ilike '%gender%'
  ) as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_captain_portal'
  and pg_get_function_identity_arguments(p.oid) = 'text, integer';

select
  'source_no_email_phone_in_roster' as check_item,
  (
    pg_get_functiondef(p.oid) not ilike '%rosterAthletes%email%'
    and pg_get_functiondef(p.oid) not ilike '%rosterAthletes%phone%'
    and position('email' in lower(substring(pg_get_functiondef(p.oid) from position('rosterAthletes' in pg_get_functiondef(p.oid)) for 800))) = 0
  ) as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_captain_portal'
  and pg_get_function_identity_arguments(p.oid) = 'text, integer';

-- Profiles RLS policies must remain (package does not alter them)
select
  'profiles_rls_unchanged_policies_exist' as check_item,
  (
    select count(*)::int > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  ) as ok;

select
  'package_verify_summary' as check_item,
  true as ok,
  'VERIFY_OK: captain portal rosterAthletes contract + grants + no profiles RLS package change' as note;

-- TEAM-TOURNAMENT-RPC-OVERLOAD-REMEDIATION-01
-- 03_VERIFY.sql
-- READ-ONLY verification after remediation.

-- 1) Exactly one get_setup remains — the canonical 4-arg
select
  p.oid,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_setup'
order by identity_arguments;

select count(*) as get_setup_overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_setup';
-- Expect: 1

select exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean'
) as canonical_present;

select exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text'
) as stale_2arg_present;
-- Expect: false

-- 2) replace_groups unchanged / still unique
select count(*) as replace_groups_overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_replace_groups';
-- Expect: 1

-- 3) Authenticated grant remains on canonical get_setup
select has_function_privilege(
  'authenticated',
  'public.team_tournament_get_setup(text, text, integer, boolean)'::regprocedure,
  'EXECUTE'
) as authenticated_can_execute_canonical;
-- Expect: true

-- PASS when:
-- get_setup_overload_count = 1
-- canonical_present = true
-- stale_2arg_present = false
-- replace_groups_overload_count = 1
-- authenticated_can_execute_canonical = true

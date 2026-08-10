-- TEAM-TOURNAMENT-RPC-OVERLOAD-REMEDIATION-01
-- 01_PRECHECK.sql
-- READ-ONLY. Do NOT apply remediation until Owner GO.
-- Target: Staging qyewbxjsiiyufanzcjcq

-- 1) Identify overloaded get_setup (proven live captain-confirm blocker)
select
  p.oid,
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_setup'
order by identity_arguments;

-- Expect OVERLOAD_COUNT = 2 before remediation:
--   CANDIDATE_1 (STALE):   (p_tournament_id text, p_viewer_team_id text)
--   CANDIDATE_2 (CANONICAL):(p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean)

select count(*) as get_setup_overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_get_setup';

-- 2) Confirm replace_groups is NOT overloaded (live did not reach this RPC)
select count(*) as replace_groups_overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_replace_groups';

select
  pg_get_function_identity_arguments(p.oid) as replace_groups_signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'team_tournament_replace_groups';

-- 3) Related setup RPCs — expect count = 1 each
select p.proname, count(*) as overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'team_tournament_replace_groups',
    'team_tournament_replace_matchups',
    'team_tournament_save_draft',
    'team_tournament_update_setup_config',
    'team_tournament_update_matchup_schedule'
  )
group by p.proname
order by p.proname;

-- GO criteria for remediation:
-- get_setup_overload_count = 2
-- replace_groups_overload_count = 1
-- stale identity_arguments exactly: p_tournament_id text, p_viewer_team_id text
-- canonical identity_arguments exactly:
--   p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean

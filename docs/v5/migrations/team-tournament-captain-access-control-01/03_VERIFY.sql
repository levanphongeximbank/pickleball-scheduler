-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-captain-access-control-01
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

select
  'functions' as check_group,
  count(*) filter (where p.proname = 'team_tournament_captain_access_enabled') as captain_access_enabled_fn,
  count(*) filter (where p.proname = 'team_tournament_assert_captain_portal_access') as assert_fn,
  count(*) filter (where p.proname = 'team_tournament_set_captain_access') as set_fn,
  count(*) filter (where p.proname = 'team_tournament_get_captain_portal') as get_portal_fn,
  count(*) filter (where p.proname = 'team_tournament_guard_captain_portal_write') as guard_fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'team_tournament_captain_access_enabled',
    'team_tournament_assert_captain_portal_access',
    'team_tournament_set_captain_access',
    'team_tournament_get_captain_portal',
    'team_tournament_guard_captain_portal_write'
  );

select
  'backfill' as check_group,
  count(*)::int as total_tournaments,
  count(*) filter (where settings ? 'captainAccessEnabled')::int as with_key,
  count(*) filter (where not (settings ? 'captainAccessEnabled'))::int as missing_key,
  count(*) filter (where (settings->>'captainAccessEnabled')::boolean is true)::int as enabled_true,
  count(*) filter (where (settings->>'captainAccessEnabled')::boolean is false)::int as enabled_false
from public.team_tournaments;

select
  'grants_authenticated' as check_group,
  has_function_privilege('authenticated', 'public.team_tournament_set_captain_access(text,boolean,integer,text)', 'execute') as set_auth,
  has_function_privilege('authenticated', 'public.team_tournament_get_captain_portal(text,integer)', 'execute') as get_auth,
  has_function_privilege('authenticated', 'public.team_tournament_assert_captain_portal_access(text,text)', 'execute') as assert_auth;

select
  'grants_anon_denied' as check_group,
  has_function_privilege('anon', 'public.team_tournament_set_captain_access(text,boolean,integer,text)', 'execute') as set_anon,
  has_function_privilege('anon', 'public.team_tournament_get_captain_portal(text,integer)', 'execute') as get_anon,
  has_function_privilege('anon', 'public.team_tournament_assert_captain_portal_access(text,text)', 'execute') as assert_anon;

-- Expect: missing_key = 0; set_anon/get_anon/assert_anon = false
select
  case
    when exists (
      select 1 from public.team_tournaments where not (settings ? 'captainAccessEnabled')
    ) then 'VERIFY_FAIL: backfill incomplete'
    when not has_function_privilege('authenticated', 'public.team_tournament_set_captain_access(text,boolean,integer,text)', 'execute')
      then 'VERIFY_FAIL: set missing authenticated grant'
    when has_function_privilege('anon', 'public.team_tournament_set_captain_access(text,boolean,integer,text)', 'execute')
      then 'VERIFY_FAIL: set granted to anon'
    when to_regprocedure('public.team_tournament_get_captain_portal(text,integer)') is null
      then 'VERIFY_FAIL: get_captain_portal missing'
    else 'VERIFY_OK'
  end as verify_status;

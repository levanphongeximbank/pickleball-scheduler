-- Read-only post-apply verification. Expected result: six PASS rows,
-- followed by twelve zero counts (six anon + six authenticated).

with targets(table_name) as (
  values
    ('match_game_states'),
    ('match_incidents'),
    ('match_participant_positions'),
    ('referee_device_sessions'),
    ('rating_proposals'),
    ('rating_confidence_events')
), checks as (
  select
    t.table_name,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    (select count(*) from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = t.table_name) as policy_count,
    has_table_privilege('anon', format('public.%I', t.table_name), 'SELECT') as anon_select,
    has_table_privilege('anon', format('public.%I', t.table_name), 'INSERT') as anon_insert,
    has_table_privilege('anon', format('public.%I', t.table_name), 'UPDATE') as anon_update,
    has_table_privilege('anon', format('public.%I', t.table_name), 'DELETE') as anon_delete
  from targets t
  left join pg_catalog.pg_namespace n on n.nspname = 'public'
  left join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
)
select *,
  case when rls_enabled and policy_count = 0 and anon_select
         and not anon_insert and not anon_update and not anon_delete
    then 'PASS' else 'FAIL' end as verification_status
from checks
order by table_name;

begin read only;
set local role anon;
select 'anon.match_game_states' as check_name, count(*) as visible_rows from public.match_game_states;
select 'anon.match_incidents' as check_name, count(*) as visible_rows from public.match_incidents;
select 'anon.match_participant_positions' as check_name, count(*) as visible_rows from public.match_participant_positions;
select 'anon.referee_device_sessions' as check_name, count(*) as visible_rows from public.referee_device_sessions;
select 'anon.rating_proposals' as check_name, count(*) as visible_rows from public.rating_proposals;
select 'anon.rating_confidence_events' as check_name, count(*) as visible_rows from public.rating_confidence_events;
rollback;

begin read only;
set local role authenticated;
select 'authenticated.match_game_states' as check_name, count(*) as visible_rows from public.match_game_states;
select 'authenticated.match_incidents' as check_name, count(*) as visible_rows from public.match_incidents;
select 'authenticated.match_participant_positions' as check_name, count(*) as visible_rows from public.match_participant_positions;
select 'authenticated.referee_device_sessions' as check_name, count(*) as visible_rows from public.referee_device_sessions;
select 'authenticated.rating_proposals' as check_name, count(*) as visible_rows from public.rating_proposals;
select 'authenticated.rating_confidence_events' as check_name, count(*) as visible_rows from public.rating_confidence_events;
rollback;

-- After execution, rerun Supabase Advisor and confirm these six
-- rls_disabled_in_public ERROR findings are absent.

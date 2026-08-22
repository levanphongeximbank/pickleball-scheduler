-- official-open-sideout-runtime-01 / 01_PRECHECK.sql
-- SELECT-ONLY. Do not mutate Staging/Production from this file.

-- 1) tournament_match_live columns present today
select
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'tournament_match_live'
order by c.ordinal_position;

-- 2) Expected Side-out columns (should be absent before APPLY)
select
  count(*) filter (where column_name = 'scoring_method') as has_scoring_method,
  count(*) filter (where column_name = 'serving_side') as has_serving_side,
  count(*) filter (where column_name = 'server_number') as has_server_number,
  count(*) filter (where column_name = 'service_state') as has_service_state
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tournament_match_live'
  and column_name in ('scoring_method', 'serving_side', 'server_number', 'service_state');

-- 3) Classic referee RPC inventory
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'referee_get_match_by_token',
    'referee_update_match_score'
  )
order by 1, 2;

-- 4) Confirm live table is still the Official execution model (row sample shape only)
select
  count(*) as live_row_count
from public.tournament_match_live;

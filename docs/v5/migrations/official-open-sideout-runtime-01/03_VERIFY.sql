-- official-open-sideout-runtime-01 / 03_VERIFY.sql
-- Read-only verification after APPLY. No fixture mutation.

select
  count(*) filter (where column_name = 'scoring_method') as has_scoring_method,
  count(*) filter (where column_name = 'serving_side') as has_serving_side,
  count(*) filter (where column_name = 'server_number') as has_server_number,
  count(*) filter (where column_name = 'service_state') as has_service_state
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tournament_match_live'
  and column_name in ('scoring_method', 'serving_side', 'server_number', 'service_state');

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.tournament_match_live'::regclass
  and (
    conname like 'tournament_match_live_%scoring%'
    or conname like 'tournament_match_live_%serving%'
    or conname like 'tournament_match_live_%server%'
  );

-- RPC still present (token-scoped updater must remain)
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'referee_update_match_score';

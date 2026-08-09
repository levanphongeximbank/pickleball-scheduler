-- Select-only verification for dreambreaker advancement package.
-- Safe to run after apply. Does not mutate data.

select 'team_tournament_dreambreaker_states' as obj,
  to_regclass('public.team_tournament_dreambreaker_states') is not null as present;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'team_tournament_recompute_matchup_result',
    'team_tournament_maybe_activate_dreambreaker',
    'team_tournament_confirm_sub_match',
    'team_tournament_submit_dreambreaker_order',
    'team_tournament_lock_dreambreaker_order',
    'team_tournament_start_dreambreaker',
    'team_tournament_record_dreambreaker_point',
    'team_tournament_undo_dreambreaker_point',
    'team_tournament_dreambreaker_injury',
    'team_tournament_sync_dreambreaker',
    'team_tournament_apply_forfeit',
    'team_tournament_withdraw_team',
    'team_tournament_randomize_lineup'
  )
order by 1, 2;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_tournament_teams'
  and column_name in ('withdrawn', 'withdrawn_at', 'withdrawal_reason')
order by 1;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_tournament_standings'
  and column_name = 'forfeit_count';

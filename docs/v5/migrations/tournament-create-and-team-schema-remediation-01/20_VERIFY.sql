-- Verification (read-only). Expect three rows / all true.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_tournament_teams'
  and column_name in ('withdrawn', 'withdrawn_at', 'withdrawal_reason')
order by column_name;

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournament_teams'
      and column_name = 'withdrawn'
  ) as has_withdrawn,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournament_teams'
      and column_name = 'withdrawn_at'
  ) as has_withdrawn_at,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_tournament_teams'
      and column_name = 'withdrawal_reason'
  ) as has_withdrawal_reason,
  (
    select p.prosrc ilike '%t.withdrawn%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
    limit 1
  ) as get_setup_refs_t_withdrawn;

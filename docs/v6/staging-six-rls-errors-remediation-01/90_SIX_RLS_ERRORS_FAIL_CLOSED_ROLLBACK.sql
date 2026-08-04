-- EMERGENCY STAGING ROLLBACK ONLY. Requires a separate explicit Owner GO.
-- Restores the audited insecure pre-state; expected data mutations: 0.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  target text;
  target_rows bigint;
  targets constant text[] := array[
    'match_game_states',
    'match_incidents',
    'match_participant_positions',
    'referee_device_sessions',
    'rating_proposals',
    'rating_confidence_events'
  ];
begin
  foreach target in array targets loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = target
        and c.relkind in ('r', 'p')
        and c.relrowsecurity
    ) then
      raise exception 'Rollback refused: public.% is missing or RLS is not enabled', target;
    end if;

    if exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = target
    ) then
      raise exception 'Rollback refused: public.% now has policies', target;
    end if;

    execute format('select count(*) from public.%I', target) into target_rows;
    if target_rows <> 0 then
      raise exception 'Rollback refused: public.% now contains % rows', target, target_rows;
    end if;

    if has_table_privilege('anon', format('public.%I', target), 'INSERT')
       or has_table_privilege('anon', format('public.%I', target), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', target), 'DELETE') then
      raise exception 'Rollback refused: anon DML ACL drift detected on public.%', target;
    end if;
  end loop;
end
$preflight$;

grant insert, update, delete on table public.match_game_states to anon;
grant insert, update, delete on table public.match_incidents to anon;
grant insert, update, delete on table public.match_participant_positions to anon;
grant insert, update, delete on table public.referee_device_sessions to anon;
grant insert, update, delete on table public.rating_proposals to anon;
grant insert, update, delete on table public.rating_confidence_events to anon;

alter table public.match_game_states disable row level security;
alter table public.match_incidents disable row level security;
alter table public.match_participant_positions disable row level security;
alter table public.referee_device_sessions disable row level security;
alter table public.rating_proposals disable row level security;
alter table public.rating_confidence_events disable row level security;

commit;

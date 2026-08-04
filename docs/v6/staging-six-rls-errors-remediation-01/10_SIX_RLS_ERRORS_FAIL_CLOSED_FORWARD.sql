-- Phase 6 / Staging-only candidate. DO NOT APPLY without explicit Owner GO.
-- Fail-closes the six empty public tables reported by Supabase Advisor.
-- Expected data mutations: 0.

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
    ) then
      raise exception 'Preflight failed: public.% is not a regular/partitioned table', target;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = target
        and c.relrowsecurity
    ) then
      raise exception 'Preflight failed: RLS is already enabled on public.%', target;
    end if;

    if exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = target
    ) then
      raise exception 'Preflight failed: public.% has policies', target;
    end if;

    execute format('select count(*) from public.%I', target) into target_rows;
    if target_rows <> 0 then
      raise exception 'Preflight failed: public.% contains % rows', target, target_rows;
    end if;

    if not (
      has_table_privilege('anon', format('public.%I', target), 'SELECT')
      and has_table_privilege('anon', format('public.%I', target), 'INSERT')
      and has_table_privilege('anon', format('public.%I', target), 'UPDATE')
      and has_table_privilege('anon', format('public.%I', target), 'DELETE')
    ) then
      raise exception 'Preflight failed: anon ACL drift detected on public.%', target;
    end if;
  end loop;
end
$preflight$;

alter table public.match_game_states enable row level security;
alter table public.match_incidents enable row level security;
alter table public.match_participant_positions enable row level security;
alter table public.referee_device_sessions enable row level security;
alter table public.rating_proposals enable row level security;
alter table public.rating_confidence_events enable row level security;

revoke insert, update, delete on table public.match_game_states from anon;
revoke insert, update, delete on table public.match_incidents from anon;
revoke insert, update, delete on table public.match_participant_positions from anon;
revoke insert, update, delete on table public.referee_device_sessions from anon;
revoke insert, update, delete on table public.rating_proposals from anon;
revoke insert, update, delete on table public.rating_confidence_events from anon;

commit;

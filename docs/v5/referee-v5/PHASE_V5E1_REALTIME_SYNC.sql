-- Phase V5-E1 — Realtime synchronization (STAGING ONLY)
-- Adds match_live_states to Supabase Realtime publication.
-- RLS on match_live_states already restricts SELECT to assigned referees.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_live_states'
  ) then
    alter publication supabase_realtime add table public.match_live_states;
  end if;
end $$;

comment on table public.match_live_states is
  'V5 materialized match snapshot. Realtime UPDATE broadcasts version bump; clients reload official state via Edge.';

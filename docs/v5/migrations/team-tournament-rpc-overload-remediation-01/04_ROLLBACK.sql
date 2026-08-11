-- TEAM-TOURNAMENT-RPC-OVERLOAD-REMEDIATION-01
-- 04_ROLLBACK.sql
-- Recreates the stale 2-arg get_setup ONLY if Owner explicitly requests rollback.
-- WARNING: Restoring this overload reintroduces PostgREST PGRST203 ambiguity.
-- Prefer fixing callers to always pass p_schema_version instead of rolling back.

-- This rollback intentionally does NOT restore the full legacy TT body from
-- dreambreaker 40_RANDOMIZE_LINEUP_PARITY.sql (large). It only restores a
-- thin wrapper that delegates to the canonical 4-arg with schema_version null
-- (legacy v6 read path inside the canonical function).

begin;

create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language sql
security definer
set search_path = public
as $$
  select public.team_tournament_get_setup(
    p_tournament_id,
    p_viewer_team_id,
    null::integer,
    false
  );
$$;

grant execute on function public.team_tournament_get_setup(text, text) to authenticated;
revoke all on function public.team_tournament_get_setup(text, text) from anon, public;

commit;

-- After rollback, get_setup_overload_count returns to 2 (ambiguous again).

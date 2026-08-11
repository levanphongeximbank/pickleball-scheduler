-- TEAM-TOURNAMENT-RPC-OVERLOAD-REMEDIATION-01
-- 02_REMEDIATE.sql
-- Owner GO required. Staging only first. DO NOT APPLY TO PRODUCTION without separate GO.
--
-- Proven issue:
--   Stale 2-arg team_tournament_get_setup was reintroduced by
--   team_tournament_dreambreaker_advancement_01_*_40_randomize_lineup_parity
--   AFTER P1.3 dropped it. PostgREST cannot uniquely resolve calls that only
--   send p_tournament_id + p_viewer_team_id (defaults make 4-arg also match).
--
-- Live captain-confirm path fails inside applyAiGeneratedTeamsToTournament →
-- cloudGetTeamTournamentSetup → team_tournament_get_setup (no schemaVersion),
-- BEFORE team_tournament_replace_groups is invoked.
--
-- Minimal fix: DROP only the stale 2-arg signature. Keep canonical 4-arg.

begin;

-- Safety: refuse if canonical 4-arg is missing
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_get_setup'
      and pg_get_function_identity_arguments(p.oid) =
        'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean'
  ) then
    raise exception 'CANONICAL get_setup(text,text,integer,boolean) missing — abort';
  end if;
end $$;

-- Drop stale overload only (exact signature)
drop function if exists public.team_tournament_get_setup(text, text);

-- Re-assert authenticated execute on canonical signature (no grant broaden)
grant execute on function public.team_tournament_get_setup(text, text, integer, boolean)
  to authenticated;

revoke all on function public.team_tournament_get_setup(text, text, integer, boolean)
  from anon, public;

commit;

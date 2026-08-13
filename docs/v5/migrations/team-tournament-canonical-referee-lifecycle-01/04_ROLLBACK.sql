-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-canonical-referee-lifecycle-01
-- Emergency only. Does NOT restore every prior function body.
-- Do NOT apply on Production. Do NOT re-run prior packages.
-- ═══════════════════════════════════════════════════════════════════

drop trigger if exists trg_tt_matchup_ensure_referee_runtime on public.team_tournament_matchups;
drop trigger if exists trg_tt_sub_match_ensure_referee_runtime on public.team_tournament_sub_matches;
drop function if exists public.team_tournament_trg_matchup_ensure_runtime();
drop function if exists public.team_tournament_trg_sub_match_ensure_runtime();
drop function if exists public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments, team_tournament_matchups, text);
drop function if exists public.team_tournament_result_write_guard(team_tournaments, team_tournament_matchups, team_tournament_sub_matches);
drop function if exists public.team_tournament_resolve_effective_referee_assignment(team_tournaments, team_tournament_matchups, team_tournament_sub_matches);

-- Restore eligibility Dreambreaker block + child-only assignment match.
-- Full create/start/confirm/draft/record bodies live in prior local packages:
--   team-tournament-scenario-b-final-progression-referee-01
--   team-tournament-dreambreaker-referee-start-canonical-01
--   team-tournament-submatch-score-revision-cas-01
--   team-tournament-dreambreaker-scoring-cas-01
-- Re-apply those CREATE OR REPLACE statements from the local files if emergency
-- restore is required. Do not re-run their one-time data steps.

select 'ROLLBACK_HELPERS_DROPPED' as status;

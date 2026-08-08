-- =============================================================================
-- TOURNAMENT-CREATE-AND-TEAM-SCHEMA-REMEDIATION-01
-- Minimal TT4 schema required by already-live public.team_tournament_get_setup
--
-- Provenance (schema section only — NOT the full forfeit workflow file):
--   docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/85_TT4_FORFEIT_WITHDRAWAL.sql
--
-- Scope: public.team_tournament_teams columns only
--   - withdrawn boolean not null default false
--   - withdrawn_at timestamptz
--   - withdrawal_reason text
--
-- Idempotent. Staging rehearsal authorized; Production requires separate Owner GO.
-- =============================================================================

alter table public.team_tournament_teams
  add column if not exists withdrawn boolean not null default false;

alter table public.team_tournament_teams
  add column if not exists withdrawn_at timestamptz;

alter table public.team_tournament_teams
  add column if not exists withdrawal_reason text;

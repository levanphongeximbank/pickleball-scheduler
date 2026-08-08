-- Rollback package — DO NOT execute unless Owner explicitly authorizes.
-- Drops only the three TT4 withdrawal columns added by 10_TT4_TEAM_WITHDRAWAL_COLUMNS.sql.
-- WARNING: drops data in those columns if any rows were written.

alter table public.team_tournament_teams
  drop column if exists withdrawal_reason;

alter table public.team_tournament_teams
  drop column if exists withdrawn_at;

alter table public.team_tournament_teams
  drop column if exists withdrawn;

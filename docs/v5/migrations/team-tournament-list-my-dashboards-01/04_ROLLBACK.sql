-- team-tournament-list-my-dashboards-01 / 04_ROLLBACK
-- Drops the new list RPC only. Does not touch get_dashboard / list_mine.

drop function if exists public.team_tournament_list_my_dashboards();

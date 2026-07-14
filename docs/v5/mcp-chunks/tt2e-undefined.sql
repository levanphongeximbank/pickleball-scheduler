-- ─── Grants ───
revoke all on function public.team_tournament_matchup_publish_ops(public.team_tournaments, public.team_tournament_matchups, timestamptz) from public;
revoke all on function public.team_tournament_publish_matchup(text, text, integer, integer, integer, text) from public;
revoke all on function public.team_tournament_publish_matchup(text, text, integer, text) from public;

grant execute on function public.team_tournament_matchup_publish_ops(public.team_tournaments, public.team_tournament_matchups, timestamptz) to authenticated;
grant execute on function public.team_tournament_publish_matchup(text, text, integer, integer, integer, text) to authenticated;
grant execute on function public.team_tournament_publish_matchup(text, text, integer, text) to authenticated;
grant execute on function public.team_tournament_get_visible_lineups(text, text, text) to authenticated;
grant execute on function public.team_tournament_get_setup(text, text) to authenticated;

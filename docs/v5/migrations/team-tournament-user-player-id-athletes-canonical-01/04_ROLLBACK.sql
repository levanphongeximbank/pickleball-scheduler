-- team-tournament-user-player-id-athletes-canonical-01 / 04_ROLLBACK
-- Restores pre-package legacy profiles.player_id helper body.

create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.player_id), ''), '')
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.team_tournament_user_player_id() from public;
revoke all on function public.team_tournament_user_player_id() from anon;
grant execute on function public.team_tournament_user_player_id() to authenticated;

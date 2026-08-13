-- team-tournament-user-player-id-athletes-canonical-01 / 02_APPLY
-- LOCAL ONLY. Do not apply without Owner GO.
-- Replaces legacy profiles.player_id helper with athletes.id canonical authority.

create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.id::text
      from public.athletes a
      where a.user_id = auth.uid()
      order by a.updated_at desc nulls last, a.created_at desc nulls last
      limit 1
    ),
    ''
  );
$$;

revoke all on function public.team_tournament_user_player_id() from public;
revoke all on function public.team_tournament_user_player_id() from anon;
grant execute on function public.team_tournament_user_player_id() to authenticated;

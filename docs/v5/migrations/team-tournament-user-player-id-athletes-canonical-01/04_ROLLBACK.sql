-- team-tournament-user-player-id-athletes-canonical-01 / 04_ROLLBACK
-- Restores exact prior Staging helper body (profiles.player_id).
-- Function source uses CRLF line endings so md5(pg_get_functiondef(...))
-- returns c168c14f87ad03a2a246150cd47afcf3. CRLF is injected via E'' so this
-- file itself can stay LF-normalized in git.

do $$
declare
  v_body text := E'\r\n  select coalesce(nullif(trim(p.player_id), ''''), '''')\r\n  from public.profiles p\r\n  where p.id = auth.uid();\r\n';
begin
  execute format(
    $sql$
create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $function$%s$function$
$sql$,
    v_body
  );
end $$;

revoke all on function public.team_tournament_user_player_id() from public;
revoke all on function public.team_tournament_user_player_id() from anon;
grant execute on function public.team_tournament_user_player_id() to authenticated;

do $$
declare
  v_md5 text;
begin
  v_md5 := md5(pg_get_functiondef('public.team_tournament_user_player_id()'::regprocedure));
  if v_md5 is distinct from 'c168c14f87ad03a2a246150cd47afcf3' then
    raise exception 'ROLLBACK_FAIL: helper fingerprint % (expected c168c14f87ad03a2a246150cd47afcf3)', v_md5;
  end if;
  raise notice 'ROLLBACK_PASS: legacy profiles.player_id helper restored';
end $$;

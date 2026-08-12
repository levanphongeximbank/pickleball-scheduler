-- team-tournament-user-player-id-athletes-canonical-01 / 03_VERIFY
-- LOCAL ONLY. Do not apply without Owner GO.

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.team_tournament_user_player_id()'::regprocedure);

  if position('from public.athletes' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: helper must read public.athletes';
  end if;

  if position('a.user_id = auth.uid()' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: helper must resolve athletes.user_id = auth.uid()';
  end if;

  if position('p.player_id' in lower(v_def)) > 0
     or position('profiles p' in lower(v_def)) > 0 then
    raise exception 'VERIFY_FAIL: legacy profiles.player_id authority still present';
  end if;

  raise notice 'VERIFY_PASS: team_tournament_user_player_id athletes-canonical';
end $$;

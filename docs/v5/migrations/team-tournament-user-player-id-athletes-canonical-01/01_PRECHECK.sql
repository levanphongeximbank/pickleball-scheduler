-- team-tournament-user-player-id-athletes-canonical-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.

do $$
declare
  v_helper_md5 text;
  v_athletes_ok boolean;
begin
  if to_regprocedure('public.team_tournament_user_player_id()') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_user_player_id() missing';
  end if;

  if to_regclass('public.athletes') is null then
    raise exception 'PRECHECK_FAIL: public.athletes missing';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'athletes'
      and column_name = 'user_id'
  ) into v_athletes_ok;
  if not v_athletes_ok then
    raise exception 'PRECHECK_FAIL: athletes.user_id missing';
  end if;

  v_helper_md5 := md5(pg_get_functiondef('public.team_tournament_user_player_id()'::regprocedure));
  if v_helper_md5 is distinct from 'c168c14f87ad03a2a246150cd47afcf3' then
    raise exception 'PRECHECK_FAIL: unexpected team_tournament_user_player_id fingerprint %', v_helper_md5;
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-user-player-id-athletes-canonical-01';
end $$;

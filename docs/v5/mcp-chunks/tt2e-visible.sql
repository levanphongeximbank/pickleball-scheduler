-- ─── TT-1B 4-param overload: delegate to atomic with DB-side lineup version enforcement ───
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
begin
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_b_id;

  return public.team_tournament_publish_matchup(
    p_tournament_id,
    p_matchup_id,
    p_expected_version,
    v_lineup_a.version,
    v_lineup_b.version,
    p_idempotency_key
  );
end;
$$;


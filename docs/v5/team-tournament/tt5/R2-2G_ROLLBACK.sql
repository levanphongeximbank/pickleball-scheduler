-- R2-2G Rollback — disable Rally mapping; restore Side-Out-centric shell from TT5-B.
-- Non-destructive: does not delete links, outbox, or finalized results.
-- Staging only.

create or replace function public.team_tournament_build_v5_state_shell(
  p_match_id text,
  p_team_a_id text,
  p_team_b_id text,
  p_players_a text[],
  p_players_b text[],
  p_match_type text,
  p_scoring_format jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_points int := coalesce((p_scoring_format->>'pointsToWin')::int, 11);
  v_win_by int := coalesce((p_scoring_format->>'winBy')::int, 2);
  v_format text := coalesce(nullif(p_scoring_format->>'scoringFormat', ''), 'side_out');
  v_players_a jsonb := '[]'::jsonb;
  v_players_b jsonb := '[]'::jsonb;
  v_first_server text;
  v_sides text[] := array['RIGHT_SERVICE_COURT', 'LEFT_SERVICE_COURT'];
  i int;
begin
  -- Force Side-Out path when rolling back Rally provision mapping.
  if lower(coalesce(p_scoring_format->>'scoringSystem', '')) = 'rally' then
    v_format := 'side_out';
    v_points := coalesce((p_scoring_format->>'targetScore')::int, (p_scoring_format->>'pointsToWin')::int, 21);
  end if;

  if p_match_type = 'singles' then
    v_players_a := jsonb_build_array(jsonb_build_object(
      'playerId', coalesce(p_players_a[1], 'A1'),
      'logicalServiceSide', 'RIGHT_SERVICE_COURT'
    ));
    v_players_b := jsonb_build_array(jsonb_build_object(
      'playerId', coalesce(p_players_b[1], 'B1'),
      'logicalServiceSide', 'LEFT_SERVICE_COURT'
    ));
    v_first_server := coalesce(p_players_a[1], 'A1');
  else
    for i in 1..2 loop
      v_players_a := v_players_a || jsonb_build_array(jsonb_build_object(
        'playerId', coalesce(p_players_a[i], 'A' || i::text),
        'logicalServiceSide', v_sides[((i - 1) % 2) + 1]
      ));
      v_players_b := v_players_b || jsonb_build_array(jsonb_build_object(
        'playerId', coalesce(p_players_b[i], 'B' || i::text),
        'logicalServiceSide', v_sides[(i % 2) + 1]
      ));
    end loop;
    v_first_server := coalesce(p_players_a[1], 'A1');
  end if;

  return jsonb_build_object(
    'matchId', p_match_id,
    'matchType', p_match_type,
    'status', 'not_started',
    'version', 0,
    'teams', jsonb_build_object(
      'teamA', jsonb_build_object(
        'teamId', p_team_a_id,
        'courtEnd', 'NEAR_END',
        'score', 0,
        'players', v_players_a
      ),
      'teamB', jsonb_build_object(
        'teamId', p_team_b_id,
        'courtEnd', 'FAR_END',
        'score', 0,
        'players', v_players_b
      )
    ),
    'servingTeamId', p_team_a_id,
    'servingPlayerId', v_first_server,
    'serverNumber', case when p_match_type = 'singles' then null else 1 end,
    'scoringFormat', v_format,
    'pointsToWin', v_points,
    'winBy', v_win_by,
    'maximumScore', null,
    'bestOf', 1
  );
end;
$$;

comment on function public.team_tournament_resolve_v5_scoring_map(jsonb, text) is
  'R2-2G rollback: leave function installed but unused by reverted shell; set VITE_TT5_REFEREE_V5_RALLY_ENABLED=false.';

-- Phase TT-5C — Standings recompute contract (uses TT-4 canonical path)
-- Staging only | Production impact: NONE
--
-- TT-5C consumer MUST use:
--   1. team_tournament_recompute_matchup_result(matchup_id)
--   2. team_tournament_recompute_standings_cache(team_tournament_id)
--
-- Do NOT call team_tournament_upsert_standings or client refreshStandings for V5-linked results.

create or replace function public.team_tournament_referee_v5_recompute_after_result(
  p_team_tournament_id uuid,
  p_matchup_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_matchup_result jsonb;
begin
  v_matchup_result := public.team_tournament_recompute_matchup_result(p_matchup_id);

  update public.team_tournament_matchups set
    status = case when (v_matchup_result->>'matchupCompleted')::boolean then 'completed' else 'in_progress' end,
    result = v_matchup_result - 'ok' - 'matchupCompleted',
    updated_at = now()
  where id = p_matchup_id;

  perform public.team_tournament_recompute_standings_cache(p_team_tournament_id);

  return jsonb_build_object(
    'ok', true,
    'matchupResult', v_matchup_result,
    'standingsPath', 'team_tournament_recompute_standings_cache'
  );
end;
$$;

grant execute on function public.team_tournament_referee_v5_recompute_after_result(uuid, uuid) to service_role;

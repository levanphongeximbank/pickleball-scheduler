-- ─── Visible lineups: opponent only after matchup published ───
create or replace function public.team_tournament_get_visible_lineups(
  p_tournament_id text,
  p_matchup_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_is_manage boolean;
  v_can_results boolean;
  v_lineups json;
  v_player_id text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  v_is_manage := public.team_tournament_can_manage();
  v_can_results := public.team_tournament_can_manage_results();
  v_player_id := public.team_tournament_user_player_id();

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(p_viewer_team_id, '') then l.selections
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and (
      v_is_manage
      or l.team_external_id = coalesce(p_viewer_team_id, '')
      or (
        v_can_results
        and v_matchup.status in ('published','in_progress','completed')
      )
      or v_matchup.status in ('published','in_progress','completed')
    );

  return json_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'matchupStatus', v_matchup.status,
    'serverTime', now(),
    'lineups', v_lineups
  );
end;
$$;


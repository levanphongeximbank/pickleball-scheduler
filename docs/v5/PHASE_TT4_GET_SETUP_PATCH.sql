-- TT-4 get_setup patch — TT-3 base + forfeitOps, withdrawn teams, forfeitCount
create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_is_manage boolean;
  v_can_results boolean;
  v_viewer_team_id text;
  v_teams json;
  v_disciplines json;
  v_matchups json;
  v_lineups json;
  v_standings json;
  v_server_time timestamptz := now();
  v_summary jsonb;
  v_lineup_deadline timestamptz;
  v_can_save_draft boolean := false;
  v_can_submit boolean := false;
  v_deadline_status text := 'locked';
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải.');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_player_id := public.team_tournament_user_player_id();
  v_is_manage := public.team_tournament_can_manage();
  v_can_results := public.team_tournament_can_manage_results();

  v_viewer_team_id := nullif(trim(coalesce(p_viewer_team_id, '')), '');
  if v_viewer_team_id is null and v_player_id is not null then
    select t.external_team_id
    into v_viewer_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    order by t.created_at
    limit 1;
  end if;

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'logoUrl', t.logo_url,
    'captainPlayerId', t.captain_player_id,
    'deputyPlayerIds', t.deputy_player_ids,
    'playerIds', coalesce((
      select json_agg(m.player_id order by m.role desc, m.created_at)
      from public.team_tournament_team_members m where m.team_id = t.id
    ), '[]'::json),
    'absentPlayerIds', t.absent_player_ids,
    'lockedPlayerIds', t.locked_player_ids,
    'withdrawn', coalesce(t.withdrawn, false),
    'withdrawnAt', t.withdrawn_at,
    'withdrawalReason', t.withdrawal_reason
  )), '[]'::json)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'scoringFormat', d.scoring_format,
    'countsTowardResult', d.counts_toward_result
  ) order by d.sort_order), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select coalesce(json_agg(
    json_build_object(
      'id', m.external_matchup_id,
      'teamAId', m.team_a_id,
      'teamBId', m.team_b_id,
      'scheduledAt', m.scheduled_at,
      'lineupLockAt', m.lineup_lock_at,
      'lineupDeadline', m.lineup_lock_at,
      'courtLabel', m.court_label,
      'status', m.status,
      'result', m.result,
      'version', m.version,
      'requiresRepublish', coalesce(m.requires_republish, false),
      'standingsRecalcRequired', coalesce(m.standings_recalc_required, false),
      'canSaveDraft', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSaveDraft')::boolean
        else null
      end,
      'canSubmit', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSubmit')::boolean
        else null
      end,
      'deadlineStatus', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'deadlineStatus'
        else null
      end,
      'lineupOps', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time) else null end,
      'canLock', case when v_is_manage then (public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->>'canLock')::boolean else null end,
      'missingTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'missingTeamIds' else null end,
      'canRandomizeTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'canRandomizeTeamIds' else null end,
      'publishOps', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time) else null end,
      'canPublish', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'canPublish')::boolean else null end,
      'publishBlockCode', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'blockCode' else null end,
      'publishBlockMessage', case when v_is_manage then public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'blockMessage' else null end,
      'lineupAVersion', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'lineupAVersion')::int else null end,
      'lineupBVersion', case when v_is_manage then (public.team_tournament_matchup_publish_ops(v_header, m, v_server_time)->>'lineupBVersion')::int else null end,
      'publishedAt', case when m.status in ('published','in_progress','completed') then m.updated_at else null end,
      'missingLineupPolicy', public.team_tournament_normalize_missing_lineup_policy(v_header.settings->>'missingLineupPolicy'),
      'technicalScoreDefaults', public.team_tournament_technical_score_defaults(v_header.settings),
      'subMatches', coalesce((
        select json_agg(json_build_object(
          'id', sm.external_sub_match_id,
          'disciplineId', sm.discipline_external_id,
          'sortOrder', sm.sort_order,
          'status', sm.status,
          'score', sm.score,
          'winnerTeamId', sm.winner_team_id,
          'resultConfirmedAt', sm.result_confirmed_at,
          'version', sm.version,
          'forfeitOps', case
            when v_is_manage or v_can_results then
              public.team_tournament_sub_match_forfeit_ops(v_header, m, sm)
            else null
          end
        ) order by sm.sort_order)
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = m.id
      ), '[]'::json)
    )
    order by m.scheduled_at nulls last, m.external_matchup_id
  ), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  left join public.team_tournament_lineups vl
    on vl.matchup_id = m.id
   and vl.team_external_id = v_viewer_team_id
  where m.team_tournament_id = v_header.id;

  select coalesce(json_object_agg(
    m.external_matchup_id || '::' || l.team_external_id,
    json_build_object(
      'matchupId', m.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(v_viewer_team_id, '') then l.selections
        when coalesce(m.requires_republish, false) then null
        when m.status in ('published','in_progress','completed') then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'overriddenAt', l.overridden_at,
      'overrideReason', case
        when v_is_manage or l.team_external_id = coalesce(v_viewer_team_id, '') then l.override_reason
        else null
      end,
      'previousLineupVersion', l.previous_lineup_version,
      'source', l.source,
      'auditNote', l.audit_note,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.view')
      or public.user_has_permission('team.standings.view')
      or v_can_results
      or l.team_external_id = coalesce(v_viewer_team_id, '')
      or (
        not coalesce(m.requires_republish, false)
        and m.status in ('published','in_progress','completed')
      )
    );

  select coalesce(json_agg(json_build_object(
    'teamId', s.team_external_id,
    'rank', s.rank,
    'played', s.played,
    'wins', s.wins,
    'losses', s.losses,
    'subMatchWins', s.sub_match_wins,
    'subMatchLosses', s.sub_match_losses,
    'subMatchDiff', s.sub_match_diff,
    'pointsScored', s.points_scored,
    'pointsConceded', s.points_conceded,
    'rankingPoints', s.ranking_points,
    'forfeitCount', coalesce(s.forfeit_count, 0)
  ) order by s.rank), '[]'::json)
  into v_standings
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.standings.view')
      or v_header.status in ('active','completed')
    );

  if v_viewer_team_id is not null then
    select public.team_tournament_lineup_deadline_fields(
      m.lineup_lock_at,
      m.status,
      coalesce(l.status, 'not_submitted'),
      l.locked_at
    )
    into v_summary
    from public.team_tournament_matchups m
    left join public.team_tournament_lineups l
      on l.matchup_id = m.id
     and l.team_external_id = v_viewer_team_id
    where m.team_tournament_id = v_header.id
      and v_viewer_team_id in (m.team_a_id, m.team_b_id)
      and m.status not in ('completed')
    order by
      case
        when m.lineup_lock_at is null then 1
        when now() < m.lineup_lock_at then 0
        else 2
      end,
      m.lineup_lock_at nulls last,
      m.scheduled_at nulls last
    limit 1;

    if v_summary is not null then
      v_lineup_deadline := (v_summary->>'lineupDeadline')::timestamptz;
      v_can_save_draft := coalesce((v_summary->>'canSaveDraft')::boolean, false);
      v_can_submit := coalesce((v_summary->>'canSubmit')::boolean, false);
      v_deadline_status := coalesce(v_summary->>'deadlineStatus', 'locked');
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'serverTime', v_server_time,
    'lineupDeadline', v_lineup_deadline,
    'canSaveDraft', v_can_save_draft,
    'canSubmit', v_can_submit,
    'deadlineStatus', v_deadline_status,
    'viewerTeamId', v_viewer_team_id,
    'technicalScoreDefaults', public.team_tournament_technical_score_defaults(v_header.settings),
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', v_header.settings,
      'teamData', json_build_object(
        'disciplines', v_disciplines,
        'teams', v_teams,
        'matchups', v_matchups,
        'lineups', v_lineups,
        'standings', v_standings,
        'settings', v_header.settings
      )
    )
  );
end;
$$;

grant execute on function public.team_tournament_get_setup(text, text) to authenticated;

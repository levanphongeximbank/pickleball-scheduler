-- Phase P1.2 S1-C — team_tournament_get_setup schemaVersion 7 read contract
-- AUTHORING ONLY in this phase. Staging apply after pre-commit approval.
-- Production: DO NOT APPLY.
-- Prerequisite: TT-5B get_setup, PHASE_P1_2_S1B_SNAPSHOT_SCHEMA (staging applied).
--
-- Behavior:
--   p_schema_version omitted/null → legacy v6 TT-5B response (unchanged)
--   p_schema_version = 6 → same as omitted
--   p_schema_version = 7 → v7 contract (snapshot + diagnostic + flat read model)
--   other → VALIDATION_ERROR
-- Read-only: never inserts setup snapshots; never mutates domain rows.

drop function if exists public.team_tournament_get_setup(text, text);

create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null,
  p_schema_version integer default null,
  p_diagnostic boolean default false
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $ttsetup$

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

  v_schema_version integer;
  v_snapshot record;
  v_snapshot_json json;
  v_diagnostic json;
  v_dreambreaker json;
  v_groups json := '[]'::json;
  v_schedule json;
  v_captain json;
  v_deputies json;
  v_awards json;
  v_closing json;
  v_schedule_publish json;
  v_matchups_v7 json;
  v_disciplines_v7 json;
  v_viewer json;
  v_permissions json;
  v_operations json;
  v_norm_projection jsonb;
  v_current_norm_hash text;
  v_is_captain boolean := false;
  v_is_deputy boolean := false;
begin
  v_schema_version := p_schema_version;
  if v_schema_version is not null and v_schema_version not in (6, 7) then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'error', 'Unsupported schemaVersion. Use omit/null for v6 or 7 for v7.'
    );
  end if;

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
          end,
          'scoreOps', case
            when v_is_manage or v_can_results then
              public.team_tournament_sub_match_score_ops(v_header, m, sm)
            else null
          end,
          'refereeLinkOps', case
            when v_is_manage or v_can_results then
              public.team_tournament_sub_match_referee_link_ops(v_header, m, sm)
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

  -- ─── V6 compatibility return (unchanged TT-5B shape) ───
  if v_schema_version is null or v_schema_version = 6 then
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
  end if;

  -- ─── V7 read contract ───
  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'scoringFormat', d.scoring_format,
    'countsTowardResult', d.counts_toward_result,
    'disciplineKind', null,
    'activationRule', null
  ) order by d.sort_order), '[]'::json)
  into v_disciplines_v7
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select coalesce(json_agg(
    json_build_object(
      'id', m.external_matchup_id,
      'teamAId', m.team_a_id,
      'teamBId', m.team_b_id,
      'status', m.status,
      'version', m.version,
      'scheduledAt', m.scheduled_at,
      'lineupLockAt', m.lineup_lock_at,
      'courtLabel', m.court_label,
      'scheduleMeta', coalesce(m.schedule_meta, '{}'::jsonb),
      'groupId', nullif(m.schedule_meta->>'groupId', ''),
      'roundNumber', case
        when (m.schedule_meta ? 'roundNumber') and (m.schedule_meta->>'roundNumber') ~ '^-?[0-9]+$'
        then (m.schedule_meta->>'roundNumber')::int else null end,
      'matchNumberInRound', case
        when (m.schedule_meta ? 'matchNumberInRound') and (m.schedule_meta->>'matchNumberInRound') ~ '^-?[0-9]+$'
        then (m.schedule_meta->>'matchNumberInRound')::int else null end,
      'stage', nullif(m.schedule_meta->>'stage', ''),
      'nextMatchupId', nullif(m.schedule_meta->>'nextMatchupId', ''),
      'result', m.result,
      'resultType', m.result_type,
      'requiresRepublish', coalesce(m.requires_republish, false),
      'standingsRecalcRequired', coalesce(m.standings_recalc_required, false),
      'subMatches', coalesce((
        select json_agg(json_build_object(
          'id', sm.external_sub_match_id,
          'matchupId', m.external_matchup_id,
          'disciplineId', sm.discipline_external_id,
          'sortOrder', sm.sort_order,
          'status', sm.status,
          'score', sm.score,
          'winnerTeamId', sm.winner_team_id,
          'resultConfirmedAt', sm.result_confirmed_at,
          'version', sm.version
        ) order by sm.sort_order)
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = m.id
      ), '[]'::json)
    )
    order by m.scheduled_at nulls last, m.external_matchup_id
  ), '[]'::json)
  into v_matchups_v7
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id;

  select coalesce(json_agg(
    json_build_object(
      'matchupId', elem->>'id',
      'scheduledAt', elem->>'scheduledAt',
      'courtLabel', elem->>'courtLabel',
      'groupId', elem->>'groupId',
      'roundNumber', elem->'roundNumber',
      'matchNumberInRound', elem->'matchNumberInRound',
      'stage', elem->>'stage'
    )
    order by
      case when elem->>'scheduledAt' is null then 1 else 0 end,
      elem->>'scheduledAt' nulls last,
      elem->>'id'
  ), '[]'::json)
  into v_schedule
  from json_array_elements(v_matchups_v7) elem;

  v_groups := '[]'::json;

  select coalesce(json_agg(json_build_object(
    'teamId', t.external_team_id,
    'playerId', t.captain_player_id
  ) order by t.external_team_id), '[]'::json)
  into v_captain
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id
    and nullif(trim(coalesce(t.captain_player_id, '')), '') is not null;

  select coalesce(json_agg(json_build_object(
    'teamId', t.external_team_id,
    'playerIds', coalesce(to_json(t.deputy_player_ids), '[]'::json)
  ) order by t.external_team_id), '[]'::json)
  into v_deputies
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  select coalesce(json_object_agg(
    mu.external_matchup_id,
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'status', db.status,
      'teamAOrder', db.team_a_order,
      'teamBOrder', db.team_b_order,
      'teamAScore', db.team_a_score,
      'teamBScore', db.team_b_score,
      'winnerTeamId', db.winner_team_id,
      'version', db.version,
      'ordersLockedAt', db.orders_locked_at
    )
  ), '{}'::json)
  into v_dreambreaker
  from public.team_tournament_dreambreaker_states db
  join public.team_tournament_matchups mu on mu.id = db.matchup_id
  where db.tenant_id = v_header.tenant_id
    and db.tournament_id = v_header.tournament_id;

  v_awards := coalesce(v_header.settings->'awards', v_header.settings->'awardsSheet', '{}'::jsonb)::json;

  v_closing := json_build_object(
    'closed', coalesce((v_header.settings->>'closed')::boolean, v_header.status in ('completed','cancelled')),
    'closedAt', v_header.settings->>'closedAt',
    'closedBy', coalesce(v_header.settings->>'closedBy', ''),
    'resultsLocked', coalesce((v_header.settings->>'resultsLocked')::boolean, false)
  );

  v_schedule_publish := coalesce(
    v_header.settings->'schedulePublish',
    jsonb_build_object(
      'status', 'draft',
      'publishedAt', null,
      'lockedAt', null,
      'publishedBy', '',
      'lockedBy', ''
    )
  )::json;

  select s.*
  into v_snapshot
  from public.team_tournament_setup_snapshots s
  where s.tenant_id = v_header.tenant_id
    and s.tournament_id = v_header.tournament_id
    and s.retention_class = 'active'
  order by s.tournament_version desc, s.created_at desc
  limit 1;

  if found then
    v_snapshot_json := json_build_object(
      'snapshotId', v_snapshot.id,
      'snapshotVersion', v_snapshot.tournament_version,
      'snapshotHash', v_snapshot.snapshot_hash,
      'normalizedReadHash', v_snapshot.normalized_read_hash,
      'engineInputHash', v_snapshot.engine_input_hash,
      'engineOutputHash', v_snapshot.engine_output_hash,
      'engineVersion', v_snapshot.engine_version,
      'rulesVersion', v_snapshot.rules_version,
      'commandName', v_snapshot.command_name,
      'createdAt', v_snapshot.created_at
    );
  else
    v_snapshot_json := null;
  end if;

  if v_viewer_team_id is not null and v_player_id is not null then
    select
      exists(
        select 1 from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = v_viewer_team_id
          and t.captain_player_id = v_player_id
      ),
      exists(
        select 1 from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = v_viewer_team_id
          and v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    into v_is_captain, v_is_deputy;
  end if;

  v_viewer := json_build_object(
    'userId', auth.uid(),
    'role', (select role from public.profiles where id = auth.uid()),
    'viewerTeamId', v_viewer_team_id,
    'captain', v_is_captain,
    'deputy', v_is_deputy,
    'refereeScope', null
  );

  v_permissions := json_build_object(
    'canManageTournament', v_is_manage,
    'canViewTeams', v_is_manage or public.user_has_permission('team.view') or v_viewer_team_id is not null,
    'canViewSchedule', true,
    'canSubmitLineup', v_can_submit,
    'canReferee', v_can_results,
    'canViewStandings', v_is_manage or public.user_has_permission('team.standings.view') or v_header.status in ('active','completed'),
    'canViewDiagnostics', v_is_manage or public.is_super_admin()
  );

  v_operations := json_build_object(
    'scheduleOps', case when v_is_manage then json_build_object('canUpdate', true, 'canPublish', true, 'canLock', true) else json_build_object('canUpdate', false, 'canPublish', false, 'canLock', false) end,
    'lineupOps', json_build_object('canSaveDraft', v_can_save_draft, 'canSubmit', v_can_submit),
    'awardsOps', case when v_is_manage then json_build_object('canUpdate', true, 'canAssign', true) else json_build_object('canUpdate', false, 'canAssign', false) end,
    'closeOps', case when v_is_manage then json_build_object('canClose', true) else json_build_object('canClose', false) end,
    'driftOps', case when v_is_manage or public.is_super_admin() then json_build_object('canView', true) else json_build_object('canView', false) end
  );

  v_diagnostic := null;
  if coalesce(p_diagnostic, false) and (v_is_manage or public.is_super_admin()) then
    v_norm_projection := jsonb_build_object(
      'schemaVersion', 7,
      'tournamentId', v_header.tournament_id,
      'tournamentVersion', v_header.version,
      'teams', v_teams::jsonb,
      'disciplines', v_disciplines_v7::jsonb,
      'groups', v_groups::jsonb,
      'matchups', v_matchups_v7::jsonb,
      'schedule', v_schedule::jsonb,
      'schedulePublish', v_schedule_publish::jsonb,
      'dreambreaker', v_dreambreaker::jsonb,
      'awards', v_awards::jsonb,
      'closing', v_closing::jsonb
    );
    v_current_norm_hash := public.team_tournament_normalized_read_hash(v_norm_projection);

    if v_snapshot_json is null then
      v_diagnostic := json_build_object(
        'driftDetected', false,
        'driftCode', 'SNAPSHOT_NOT_INITIALIZED',
        'latestSnapshotHash', null,
        'latestNormalizedReadHash', null,
        'currentNormalizedHash', v_current_norm_hash,
        'engineVersionMismatch', false,
        'rulesVersionMismatch', false
      );
    else
      v_diagnostic := json_build_object(
        'driftDetected', coalesce(v_snapshot.normalized_read_hash, '') <> coalesce(v_current_norm_hash, ''),
        'driftCode', case
          when coalesce(v_snapshot.normalized_read_hash, '') <> coalesce(v_current_norm_hash, '')
          then 'NORMALIZED_READ_DRIFT'
          else null
        end,
        'latestSnapshotHash', v_snapshot.snapshot_hash,
        'latestNormalizedReadHash', v_snapshot.normalized_read_hash,
        'currentNormalizedHash', v_current_norm_hash,
        'engineVersionMismatch', false,
        'rulesVersionMismatch', false
      );
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'schemaVersion', 7,
    'serverTime', v_server_time,
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', v_header.settings,
      'teams', v_teams,
      'captain', v_captain,
      'deputies', v_deputies,
      'disciplines', v_disciplines_v7,
      'groups', v_groups,
      'matchups', v_matchups_v7,
      'subMatches', (
        select coalesce(json_agg(sm), '[]'::json)
        from (
          select json_array_elements(m->'subMatches') as sm
          from json_array_elements(v_matchups_v7) m
        ) q
      ),
      'schedule', v_schedule,
      'schedulePublish', v_schedule_publish,
      'lineups', v_lineups,
      'standings', v_standings,
      'dreambreaker', v_dreambreaker,
      'awards', v_awards,
      'closing', v_closing,
      'formatPreset', coalesce(v_header.settings->>'formatPreset', 'custom'),
      'rosterRules', coalesce(v_header.settings->'rosterRules', '{}'::jsonb),
      'engineVersion', case when v_snapshot_json is not null then v_snapshot.engine_version else null end,
      'rulesVersion', case when v_snapshot_json is not null then v_snapshot.rules_version else null end,
      'teamData', json_build_object(
        'disciplines', v_disciplines_v7,
        'teams', v_teams,
        'matchups', v_matchups_v7,
        'lineups', v_lineups,
        'standings', v_standings,
        'groups', v_groups,
        'settings', v_header.settings
      )
    ),
    'viewer', v_viewer,
    'permissions', v_permissions,
    'operations', v_operations,
    'snapshot', v_snapshot_json,
    'diagnostic', v_diagnostic,
    'lineupDeadline', v_lineup_deadline,
    'canSaveDraft', v_can_save_draft,
    'canSubmit', v_can_submit,
    'deadlineStatus', v_deadline_status,
    'viewerTeamId', v_viewer_team_id,
    'technicalScoreDefaults', public.team_tournament_technical_score_defaults(v_header.settings)
  );
end;

$ttsetup$;

comment on function public.team_tournament_get_setup(text, text, integer, boolean) is
  'Team Tournament get_setup — omit schemaVersion for v6; pass 7 for v7 read contract. Read-only.';

grant execute on function public.team_tournament_get_setup(text, text, integer, boolean) to authenticated;

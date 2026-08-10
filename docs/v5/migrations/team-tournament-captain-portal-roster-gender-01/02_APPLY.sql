-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-captain-portal-roster-gender-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-PORTAL-ROSTER-GENDER-AND-MLP4-OPTION-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Extends team_tournament_get_captain_portal own-team roster with:
--   athleteId, displayName, gender
-- SECURITY DEFINER may join profiles for scoped own-team members only.
-- Does NOT change profiles RLS. Does NOT broaden grants.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_get_captain_portal(
  p_tournament_id text,
  p_schema_version integer default 7
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assert json;
  v_header public.team_tournaments;
  v_viewer_team_id text;
  v_player_id text;
  v_teams json;
  v_my_team json;
  v_opponent_teams json;
  v_matchups json;
  v_lineups json;
  v_disciplines json;
  v_is_captain boolean := false;
  v_is_deputy boolean := false;
begin
  if p_schema_version is distinct from null and p_schema_version is distinct from 7 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'schemaVersion phải là 7.');
  end if;

  v_assert := public.team_tournament_assert_captain_portal_access(p_tournament_id, null);
  if not coalesce((v_assert->>'ok')::boolean, false) then
    return v_assert;
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  v_viewer_team_id := v_assert->>'viewerTeamId';
  v_player_id := v_assert->>'viewerPlayerId';

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and t.captain_player_id = v_player_id
  ) into v_is_captain;

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
  ) into v_is_deputy;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement
  ) order by d.sort_order, d.created_at), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select row_to_json(x)
  into v_my_team
  from (
    select
      t.external_team_id as id,
      t.name,
      t.captain_player_id as "captainPlayerId",
      coalesce(t.deputy_player_ids, '{}'::text[]) as "deputyPlayerIds",
      coalesce((
        select json_agg(m.player_id order by m.created_at)
        from public.team_tournament_team_members m
        where m.team_id = t.id
      ), '[]'::json) as "playerIds",
      coalesce((
        select json_agg(
          json_build_object(
            'athleteId', m.player_id,
            'displayName', coalesce(nullif(trim(a.display_name), ''), m.player_id),
            'gender', case
              when lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'nam') then 'male'
              when lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'nu', 'nữ') then 'female'
              when nullif(trim(coalesce(p.gender, '')), '') is null then null
              else lower(trim(p.gender))
            end
          )
          order by m.created_at
        )
        from public.team_tournament_team_members m
        left join public.athletes a
          on a.id::text = m.player_id
         and a.tenant_id = v_header.tenant_id
        left join public.profiles p
          on p.id = a.user_id
        where m.team_id = t.id
      ), '[]'::json) as "rosterAthletes"
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
  ) x;

  select coalesce(json_agg(json_build_object(
    'id', m.external_matchup_id,
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'status', m.status,
    'scheduledAt', m.scheduled_at,
    'courtLabel', m.court_label,
    'lineupLockAt', m.lineup_lock_at,
    'roundNumber', m.schedule_meta->>'roundNumber',
    'stage', m.schedule_meta->>'stage',
    'groupId', m.schedule_meta->>'groupId'
  ) order by m.scheduled_at nulls last, m.created_at), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id);

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name
  ) order by t.name), '[]'::json)
  into v_opponent_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id
    and t.external_team_id <> v_viewer_team_id
    and exists (
      select 1
      from public.team_tournament_matchups m
      where m.team_tournament_id = v_header.id
        and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id)
        and (m.team_a_id = t.external_team_id or m.team_b_id = t.external_team_id)
    );

  select coalesce(json_object_agg(
    l.team_external_id || '::' || mu.external_matchup_id,
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when l.team_external_id = v_viewer_team_id then l.selections
        when mu.status in ('published', 'in_progress', 'completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups mu on mu.id = l.matchup_id
  where mu.team_tournament_id = v_header.id
    and (mu.team_a_id = v_viewer_team_id or mu.team_b_id = v_viewer_team_id)
    and (
      l.team_external_id = v_viewer_team_id
      or mu.status in ('published', 'in_progress', 'completed')
      or l.published_at is not null
    );

  v_teams := json_build_array(v_my_team);

  return json_build_object(
    'ok', true,
    'schemaVersion', 7,
    'serverTime', now(),
    'viewerTeamId', v_viewer_team_id,
    'captainAccessEnabled', true,
    'viewer', json_build_object(
      'userId', auth.uid(),
      'viewerTeamId', v_viewer_team_id,
      'captain', v_is_captain,
      'deputy', v_is_deputy
    ),
    'permissions', json_build_object(
      'canViewTeams', true,
      'canViewSchedule', true,
      'canSubmitLineup', true,
      'canManageTournament', false
    ),
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', jsonb_build_object(
        'captainAccessEnabled', true,
        'lineupLockLeadMinutes', v_header.settings->'lineupLockLeadMinutes',
        'rosterRules', v_header.settings->'rosterRules',
        'schedulePublish', v_header.settings->'schedulePublish',
        'formatPreset', v_header.settings->'formatPreset',
        'allowPlayerReusePerMatchup', v_header.settings->'allowPlayerReusePerMatchup'
      ),
      'disciplines', v_disciplines,
      'myTeam', v_my_team,
      'opponentTeams', v_opponent_teams,
      'teams', v_teams,
      'matchups', v_matchups,
      'lineups', v_lineups
    )
  );
end;
$$;

revoke all on function public.team_tournament_get_captain_portal(text, integer) from public;
revoke all on function public.team_tournament_get_captain_portal(text, integer) from anon;
grant execute on function public.team_tournament_get_captain_portal(text, integer) to authenticated;

comment on function public.team_tournament_get_captain_portal(text, integer) is
  'Scoped captain portal reader. Own-team rosterAthletes carry athleteId/displayName/gender only; no profiles RLS broadening.';

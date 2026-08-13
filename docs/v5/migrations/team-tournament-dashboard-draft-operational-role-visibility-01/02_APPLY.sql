-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-dashboard-draft-operational-role-visibility-01
-- Role-scoped draft Dashboard visibility (Owner-approved).
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

-- Pure visibility decision (server authority inputs only).
create or replace function public.team_tournament_can_view_dashboard(
  p_status text,
  p_can_manage boolean,
  p_is_captain_or_deputy boolean,
  p_is_assigned_referee boolean
)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_can_manage, false)
    or public.team_tournament_status_is_athlete_visible(p_status)
    or (
      lower(coalesce(nullif(trim(p_status), ''), 'draft')) = 'draft'
      and (
        coalesce(p_is_captain_or_deputy, false)
        or coalesce(p_is_assigned_referee, false)
      )
    );
$$;

create or replace function public.team_tournament_get_dashboard(
  p_tournament_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_canonical public.canonical_tournaments%rowtype;
  v_player_id text;
  v_can_manage boolean;
  v_is_draft boolean := false;
  v_is_participant boolean := false;
  v_is_captain_or_deputy boolean := false;
  v_is_assigned_referee boolean := false;
  v_can_view boolean := false;
  v_captain_team_id text := null;
  v_my_team_id text := null;
  v_my_team jsonb := null;
  v_teams jsonb := '[]'::jsonb;
  v_matchups jsonb := '[]'::jsonb;
  v_standings jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_policy jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    select * into v_canonical
    from public.canonical_tournaments t
    where t.id::text = p_tournament_id
       or t.external_key = p_tournament_id
    limit 1;
    if found then
      v_header := public.team_tournament_resolve_header(
        coalesce(v_canonical.payload->>'teamDomainId', v_canonical.external_key, v_canonical.id::text)
      );
    end if;
  end if;

  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  v_can_manage := public.team_tournament_can_manage();
  v_is_draft := lower(coalesce(v_header.status, 'draft')) = 'draft';

  -- Canonical player identity: athletes.id first, profiles.player_id fallback.
  select a.id::text
    into v_player_id
  from public.athletes a
  where a.user_id = auth.uid()
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;
  if v_player_id is null then
    v_player_id := nullif(trim(coalesce(public.team_tournament_user_player_id(), '')), '');
  end if;

  -- Role resolution BEFORE visibility decision (server authority only).
  if v_player_id is not null then
    select t.external_team_id
      into v_captain_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
      )
    limit 1;
  end if;
  v_is_captain_or_deputy := v_captain_team_id is not null;

  if to_regclass('public.referee_assignments') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'assignmentId', ra.id,
      'refereeUserId', ra.referee_user_id,
      'matchId', ra.match_id,
      'matchupId', ra.external_matchup_id
    )), '[]'::jsonb)
    into v_assignments
    from public.referee_assignments ra
    where ra.tenant_id = v_header.tenant_id
      and ra.tournament_id = v_header.tournament_id
      and ra.referee_user_id = auth.uid()
      and ra.revoked_at is null;
  end if;
  v_is_assigned_referee := jsonb_array_length(coalesce(v_assignments, '[]'::jsonb)) > 0;

  v_can_view := public.team_tournament_can_view_dashboard(
    v_header.status,
    v_can_manage,
    v_is_captain_or_deputy,
    v_is_assigned_referee
  );

  if not v_can_view then
    if v_is_draft then
      return jsonb_build_object('ok', false, 'code', 'DRAFT_NOT_VISIBLE');
    end if;
    return jsonb_build_object('ok', false, 'code', 'NOT_VISIBLE');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'withdrawn', coalesce(t.withdrawn, false)
  ) order by t.created_at), '[]'::jsonb)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  if v_player_id is not null then
    select t.external_team_id into v_my_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
        or exists (
          select 1
          from public.team_tournament_team_members m
          where m.team_id = t.id
            and m.player_id = v_player_id
        )
      )
    limit 1;

    v_is_participant := v_my_team_id is not null;
    if v_captain_team_id is not null then
      v_is_participant := true;
      if v_my_team_id is null then
        v_my_team_id := v_captain_team_id;
      end if;
    end if;

    if v_my_team_id is not null then
      select jsonb_build_object(
        'id', t.external_team_id,
        'name', t.name,
        'roster', coalesce((
          select jsonb_agg(jsonb_build_object('playerId', m.player_id, 'name', null))
          from public.team_tournament_team_members m
          where m.team_id = t.id
        ), '[]'::jsonb)
      )
      into v_my_team
      from public.team_tournament_teams t
      where t.team_tournament_id = v_header.id
        and t.external_team_id = v_my_team_id
      limit 1;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.external_matchup_id,
    'stage', coalesce(m.schedule_meta->>'stage', null),
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'scheduledAt', m.scheduled_at,
    'courtLabel', m.court_label,
    'status', m.status,
    'result', jsonb_build_object(
      'teamAWins', m.result->'teamAWins',
      'teamBWins', m.result->'teamBWins',
      'teamAPoints', m.result->'teamAPoints',
      'teamBPoints', m.result->'teamBPoints',
      'winnerTeamId', m.result->>'winnerTeamId',
      'tieBreakPolicy', m.result->>'tieBreakPolicy',
      'tieBreakStatus', m.result->>'tieBreakStatus',
      'needsDreambreaker', coalesce((m.result->>'needsDreambreaker')::boolean, false)
    )
  ) order by m.scheduled_at nulls last), '[]'::jsonb)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id;

  if to_regclass('public.team_tournament_lineups') is not null then
    select coalesce(jsonb_agg(
      elem || jsonb_build_object(
        'lineups', coalesce((
          select jsonb_object_agg(
            l.team_external_id,
            jsonb_build_object('status', l.status)
          )
          from public.team_tournament_lineups l
          join public.team_tournament_matchups mu
            on mu.id = l.matchup_id
           and mu.team_tournament_id = v_header.id
          where mu.external_matchup_id = elem->>'id'
        ), '{}'::jsonb)
      )
    ), v_matchups)
    into v_matchups
    from jsonb_array_elements(coalesce(v_matchups, '[]'::jsonb)) elem;
  end if;

  if to_regclass('public.team_tournament_dreambreaker_states') is not null then
    select coalesce(jsonb_agg(
      elem || jsonb_build_object(
        'dreambreaker', coalesce((
          select jsonb_build_object('status', d.status)
          from public.team_tournament_dreambreaker_states d
          join public.team_tournament_matchups mu
            on mu.id = d.matchup_id
           and mu.team_tournament_id = v_header.id
          where mu.external_matchup_id = elem->>'id'
          limit 1
        ), '{}'::jsonb)
      )
    ), v_matchups)
    into v_matchups
    from jsonb_array_elements(coalesce(v_matchups, '[]'::jsonb)) elem;
  end if;

  if to_regclass('public.team_tournament_standings') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'teamId', s.team_external_id,
      'rank', s.rank,
      'played', s.played,
      'wins', s.wins,
      'losses', s.losses,
      'pointsScored', s.points_scored
    ) order by s.rank), '[]'::jsonb)
    into v_standings
    from public.team_tournament_standings s
    where s.team_tournament_id = v_header.id;
  end if;

  v_policy := coalesce(v_header.settings->'stageTieBreakPolicy', '{}'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'view', jsonb_build_object(
      'overview', jsonb_build_object(
        'id', v_header.tournament_id,
        'name', v_header.name,
        'status', v_header.status,
        'clubId', v_header.club_id,
        'tenantId', v_header.tenant_id,
        'mode', 'team_tournament',
        'isDraft', v_is_draft,
        'registrationFoundationReady', lower(coalesce(v_header.status, 'draft')) in ('draft', 'registration'),
        'registrationFullUiImplemented', false
      ),
      'stageTieBreakPolicy', v_policy,
      'teams', v_teams,
      'matchups', v_matchups,
      'standings', v_standings,
      'capabilities', jsonb_build_object(
        'canOrganize', v_can_manage,
        'isParticipant', v_is_participant,
        'isCaptain', v_is_captain_or_deputy,
        'isReferee', v_is_assigned_referee,
        'myTeamId', v_my_team_id,
        'captainTeamId', v_captain_team_id
      ),
      'myTeam', v_my_team,
      'refereeAssignments', v_assignments
    )
  );
exception
  when others then
    if sqlerrm like 'access_denied%' then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED');
    end if;
    raise;
end;
$$;

revoke all on function public.team_tournament_can_view_dashboard(text, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.team_tournament_can_view_dashboard(text, boolean, boolean, boolean)
  to authenticated, service_role;

revoke all on function public.team_tournament_get_dashboard(text) from public, anon;
grant execute on function public.team_tournament_get_dashboard(text) to authenticated;

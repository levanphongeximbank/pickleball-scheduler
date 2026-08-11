-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-canonical-dashboard-lifecycle-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_status_is_athlete_visible(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(nullif(trim(p_status), ''), 'draft')) in (
    'registration', 'ready', 'active', 'completed'
  );
$$;

create or replace function public.team_tournament_create(
  p_tenant_id text,
  p_club_id text,
  p_name text,
  p_season_id text default null,
  p_league_id text default null,
  p_created_by text default null,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(nullif(trim(p_name), ''), 'Giải đồng đội');
  v_created_by text := nullif(trim(coalesce(p_created_by, '')), '');
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_idempotency text := nullif(trim(coalesce(p_settings->>'idempotencyKey', '')), '');
  v_row public.canonical_tournaments%rowtype;
  v_header_exists boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_idempotency is not null then
    perform pg_advisory_xact_lock(
      hashtext(p_tenant_id || ':' || p_club_id),
      hashtext(v_idempotency)
    );
    select * into v_row
    from public.canonical_tournaments t
    where t.tenant_id = p_tenant_id
      and t.club_id = p_club_id
      and t.payload->>'idempotencyKey' = v_idempotency
    limit 1;
    if found then
      select exists (
        select 1
        from public.team_tournaments tt
        where tt.tenant_id = p_tenant_id
          and tt.club_id = p_club_id
          and tt.tournament_id = v_row.id::text
      ) into v_header_exists;
      if not v_header_exists then
        return jsonb_build_object('ok', false, 'code', 'CREATE_INCONSISTENT');
      end if;
      return jsonb_build_object(
        'ok', true,
        'replayed', true,
        'tournament', jsonb_build_object(
          'id', v_row.id::text,
          'canonicalId', v_row.id::text,
          'teamDomainId', coalesce(v_row.payload->>'teamDomainId', v_row.id::text),
          'clubId', v_row.club_id,
          'tenantId', v_row.tenant_id,
          'name', v_row.name,
          'mode', 'team_tournament',
          'status', v_row.status,
          'createdBy', v_row.payload->>'createdBy',
          'ownerPlayerId', v_row.payload->>'ownerPlayerId',
          'settings', coalesce(v_row.payload->'settings', v_settings)
        )
      );
    end if;
  end if;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload, engine_v4
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'team_tournament',
    'draft',
    nullif(trim(coalesce(p_season_id, '')), ''),
    nullif(trim(coalesce(p_league_id, '')), ''),
    jsonb_build_object(
      'id', v_id::text,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'teamDomainId', v_id::text,
      'idempotencyKey', v_idempotency,
      'settings', v_settings
    ),
    '{}'::jsonb
  )
  returning * into v_row;

  insert into public.team_tournaments (
    tenant_id, club_id, tournament_id, name, status, settings, created_by, updated_by
  ) values (
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'draft',
    v_settings,
    auth.uid(),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'tournament', jsonb_build_object(
      'id', v_id::text,
      'canonicalId', v_id::text,
      'teamDomainId', v_id::text,
      'clubId', p_club_id,
      'tenantId', p_tenant_id,
      'name', v_name,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'settings', v_settings
    )
  );
exception
  when others then
    if sqlerrm in ('access_denied: cross-tenant', 'TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', sqlerrm);
    end if;
    raise;
end;
$$;

create or replace function public.team_tournament_ensure_canonical(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id text,
  p_name text default null,
  p_created_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_existing public.canonical_tournaments%rowtype;
  v_id uuid;
  v_domain text := nullif(trim(coalesce(p_tournament_id, '')), '');
  v_created_by text := nullif(trim(coalesce(p_created_by, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_domain is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  v_header := public.team_tournament_resolve_header(v_domain);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_existing
  from public.canonical_tournaments t
  where t.tenant_id = p_tenant_id
    and t.club_id = p_club_id
    and (
      t.id::text = v_domain
      or t.external_key = v_domain
      or coalesce(t.payload->>'teamDomainId', '') = v_domain
    )
  limit 1;

  if found then
    return jsonb_build_object('ok', true, 'already', true, 'tournament', to_jsonb(v_existing));
  end if;

  begin
    v_id := v_domain::uuid;
  exception
    when others then
      v_id := gen_random_uuid();
  end;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_header.tournament_id,
    coalesce(nullif(trim(p_name), ''), v_header.name, 'Giải đồng đội'),
    'team_tournament',
    coalesce(v_header.status, 'draft'),
    jsonb_build_object(
      'id', v_id::text,
      'mode', 'team_tournament',
      'status', coalesce(v_header.status, 'draft'),
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'teamDomainId', v_header.tournament_id
    )
  )
  returning * into v_existing;

  return jsonb_build_object('ok', true, 'already', false, 'tournament', to_jsonb(v_existing));
end;
$$;

create or replace function public.team_tournament_list_my_referee_assignments(
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
  v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  if to_regclass('public.referee_assignments') is null then
    return jsonb_build_object('ok', true, 'assignments', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', ra.id,
    'refereeUserId', ra.referee_user_id,
    'matchId', ra.match_id,
    'externalMatchupId', ra.external_matchup_id,
    'matchupId', ra.external_matchup_id,
    'status', ra.status
  ) order by ra.assigned_at desc), '[]'::jsonb)
  into v_items
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.referee_user_id = auth.uid()
    and ra.revoked_at is null;

  return jsonb_build_object('ok', true, 'assignments', v_items);
end;
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
  v_is_participant boolean := false;
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
  v_player_id := nullif(trim(coalesce(public.team_tournament_user_player_id(), '')), '');

  if lower(coalesce(v_header.status, 'draft')) = 'draft' and not v_can_manage then
    return jsonb_build_object('ok', false, 'code', 'DRAFT_NOT_VISIBLE');
  end if;
  if not v_can_manage and not public.team_tournament_status_is_athlete_visible(v_header.status) then
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
    select t.external_team_id into v_captain_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
      )
    limit 1;

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
        'isDraft', lower(coalesce(v_header.status, 'draft')) = 'draft',
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
        'isCaptain', v_captain_team_id is not null,
        'isReferee', jsonb_array_length(coalesce(v_assignments, '[]'::jsonb)) > 0,
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

create or replace function public.canonical_tournament_list(
  p_tenant_id text,
  p_club_id text,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rows jsonb;
begin
  perform public.canonical_tournament_assert_tenant(p_tenant_id);
  perform public.canonical_tournament_assert_permission('tournament.view');

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc), '[]'::jsonb)
    into rows
  from public.canonical_tournaments t
  where t.tenant_id = p_tenant_id
    and t.club_id = p_club_id
    and (
      public.team_tournament_can_manage()
      or lower(coalesce(t.status, 'draft')) <> 'draft'
    );

  return jsonb_build_object('ok', true, 'tournaments', rows);
exception
  when insufficient_privilege then
    return jsonb_build_object('ok', false, 'code', sqlerrm, 'tournaments', '[]'::jsonb);
  when others then
    if sqlerrm in ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', sqlerrm, 'tournaments', '[]'::jsonb);
    end if;
    raise;
end;
$$;

create or replace function public.canonical_tournament_list_mine(
  p_tenant_id text,
  p_club_id text,
  p_player_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rows jsonb;
  pid text := nullif(trim(coalesce(p_player_id, '')), '');
begin
  perform public.canonical_tournament_assert_tenant(p_tenant_id);
  perform public.canonical_tournament_assert_permission('tournament.view');
  if pid is null then
    return jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN', 'tournaments', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc), '[]'::jsonb)
    into rows
  from public.canonical_tournaments t
  where t.tenant_id = p_tenant_id
    and t.club_id = p_club_id
    and (
      public.team_tournament_can_manage()
      or lower(coalesce(t.status, 'draft')) <> 'draft'
    )
    and (
      public.canonical_tournament_is_mine(t.payload, pid)
      or exists (
        select 1
        from public.team_tournaments tt
        join public.team_tournament_teams tm on tm.team_tournament_id = tt.id
        left join public.team_tournament_team_members mb on mb.team_id = tm.id
        where tt.tenant_id = t.tenant_id
          and tt.club_id = t.club_id
          and (
            tt.tournament_id = t.id::text
            or tt.tournament_id = t.external_key
            or tt.tournament_id = coalesce(t.payload->>'teamDomainId', '')
          )
          and (
            mb.player_id = pid
            or tm.captain_player_id = pid
            or coalesce(tm.deputy_player_ids, '{}'::text[]) @> array[pid]
          )
      )
    );

  return jsonb_build_object('ok', true, 'tournaments', rows);
exception
  when others then
    if sqlerrm in ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', sqlerrm, 'tournaments', '[]'::jsonb);
    end if;
    raise;
end;
$$;

revoke all on function public.team_tournament_status_is_athlete_visible(text) from public, anon;
grant execute on function public.team_tournament_status_is_athlete_visible(text) to authenticated, service_role;

revoke all on function public.team_tournament_create(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.team_tournament_create(text, text, text, text, text, text, jsonb) to authenticated;

revoke all on function public.team_tournament_ensure_canonical(text, text, text, text, text) from public, anon;
grant execute on function public.team_tournament_ensure_canonical(text, text, text, text, text) to authenticated;

revoke all on function public.team_tournament_list_my_referee_assignments(text) from public, anon;
grant execute on function public.team_tournament_list_my_referee_assignments(text) to authenticated;

revoke all on function public.team_tournament_get_dashboard(text) from public, anon;
grant execute on function public.team_tournament_get_dashboard(text) to authenticated;

revoke all on function public.canonical_tournament_list(text, text, jsonb) from public, anon;
grant execute on function public.canonical_tournament_list(text, text, jsonb) to authenticated;

revoke all on function public.canonical_tournament_list_mine(text, text, text) from public, anon;
grant execute on function public.canonical_tournament_list_mine(text, text, text) to authenticated;

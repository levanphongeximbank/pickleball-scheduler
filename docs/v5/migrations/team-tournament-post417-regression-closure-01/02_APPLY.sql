-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-post417-regression-closure-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Seeds canonical MLP_4 disciplines on create.
-- Adds atomic team+captain+group commit pairing RPC.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_merge_mlp_initial_settings(p_settings jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'formatPreset', 'mlp_4',
    'rosterRules', jsonb_build_object(
      'teamSize', 4,
      'minPlayers', 4,
      'maxPlayers', 4,
      'requiredMales', 2,
      'requiredFemales', 2
    ),
    'allowPlayerReusePerMatchup', true,
    'allowPlayerCrossTeam', false,
    'dreambreakerEnabled', true,
    'lineupLockLeadMinutes', 15,
    'groupMode', 'single_pool',
    'groupCount', 1,
    'qualificationCount', 2,
    'knockoutFormat', 'top_n',
    'selectedCourtIds', '[]'::jsonb,
    'missingLineupPolicy', 'random',
    'tiebreakOrder', '["wins","subMatchDiff","pointsScored","manual"]'::jsonb
  ) || coalesce(p_settings, '{}'::jsonb);
$$;

create or replace function public.team_tournament_seed_mlp_disciplines(p_header public.team_tournaments)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rally jsonb := jsonb_build_object(
    'scoringSystem', 'rally',
    'matchFormat', 'rally_single',
    'targetScore', 21,
    'winBy', 2,
    'freezeAt', 20,
    'sideSwitchAt', 11,
    'winPoints', 1
  );
  v_dream jsonb;
begin
  if p_header.id is null then
    return;
  end if;
  if exists (
    select 1
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
  ) then
    return;
  end if;

  v_dream := v_rally || jsonb_build_object('sideSwitchAt', 20, 'rotationPoints', 4);

  insert into public.team_tournament_disciplines (
    tenant_id, tournament_id, team_tournament_id, external_discipline_id,
    name, category_type, gender_requirement, player_count, sort_order,
    scoring_format, counts_toward_result, discipline_kind, activation_rule, enabled, updated_at
  ) values
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-wd',
     'Đôi nữ', 'doubles', 'female', 2, 1, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-md',
     'Đôi nam', 'doubles', 'male', 2, 2, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-xd1',
     'Đôi nam nữ 1', 'mixed', 'mixed_pair', 2, 3, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-xd2',
     'Đôi nam nữ 2', 'mixed', 'mixed_pair', 2, 4, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'dreambreaker',
     'Dreambreaker', 'singles', 'any', 1, 5, v_dream, true, 'dreambreaker', 'tie_at_2_2', true, now())
  on conflict (team_tournament_id, external_discipline_id) do nothing;
end;
$$;

create or replace function public.team_tournament_initial_setup_team_data(p_header public.team_tournaments)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'settings', coalesce(p_header.settings, '{}'::jsonb),
    'disciplines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.external_discipline_id,
        'name', d.name,
        'categoryType', d.category_type,
        'genderRequirement', d.gender_requirement,
        'playerCount', d.player_count,
        'sortOrder', d.sort_order,
        'scoringFormat', d.scoring_format,
        'countsTowardResult', d.counts_toward_result,
        'disciplineKind', d.discipline_kind,
        'activationRule', d.activation_rule,
        'enabled', d.enabled
      ) order by d.sort_order, d.external_discipline_id)
      from public.team_tournament_disciplines d
      where d.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.external_team_id,
        'name', t.name,
        'captainPlayerId', t.captain_player_id,
        'color', t.color
      ) order by t.name, t.external_team_id)
      from public.team_tournament_teams t
      where t.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.external_group_id,
        'name', g.name,
        'sortOrder', g.sort_order,
        'teamIds', to_jsonb(g.team_ids)
      ) order by g.sort_order, g.external_group_id)
      from public.team_tournament_groups g
      where g.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.external_matchup_id,
        'teamAId', m.team_a_id,
        'teamBId', m.team_b_id
      ) order by m.external_matchup_id)
      from public.team_tournament_matchups m
      where m.team_tournament_id = p_header.id
    ), '[]'::jsonb)
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
  v_header public.team_tournaments%rowtype;
  v_header_exists boolean := false;
  v_preset text;
  v_team_data jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_preset := lower(coalesce(nullif(trim(v_settings->>'formatPreset'), ''), 'mlp_4'));
  if v_preset = 'mlp_4' then
    v_settings := public.team_tournament_merge_mlp_initial_settings(v_settings);
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
      select * into v_header
      from public.team_tournaments tt
      where tt.tenant_id = p_tenant_id
        and tt.club_id = p_club_id
        and tt.tournament_id = v_row.id::text;
      v_header_exists := found;
      if not v_header_exists then
        return jsonb_build_object('ok', false, 'code', 'CREATE_INCONSISTENT');
      end if;
      if v_preset = 'mlp_4' then
        perform public.team_tournament_seed_mlp_disciplines(v_header);
        select * into v_header
        from public.team_tournaments tt
        where tt.id = v_header.id;
      end if;
      v_team_data := public.team_tournament_initial_setup_team_data(v_header);
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
          'settings', coalesce(v_header.settings, v_row.payload->'settings', v_settings),
          'teamData', v_team_data
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
  )
  returning * into v_header;

  if v_preset = 'mlp_4' then
    perform public.team_tournament_seed_mlp_disciplines(v_header);
  end if;

  v_team_data := public.team_tournament_initial_setup_team_data(v_header);

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
      'settings', v_settings,
      'teamData', v_team_data
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

create or replace function public.team_tournament_commit_pairing(
  p_tournament_id text,
  p_teams jsonb default '[]'::jsonb,
  p_groups jsonb default '[]'::jsonb,
  p_settings_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team jsonb;
  v_group jsonb;
  v_external_id text;
  v_team_id uuid;
  v_player_id text;
  v_team_count integer;
  v_input_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  if jsonb_typeof(coalesce(p_teams, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_teams, '[]'::jsonb)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'EMPTY_TEAMS');
  end if;

  for v_team in select value from jsonb_array_elements(p_teams) loop
    v_external_id := coalesce(nullif(v_team->>'id', ''), nullif(v_team->>'externalTeamId', ''));
    if v_external_id is null then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu team id.');
    end if;

    select t.id into v_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id and t.external_team_id = v_external_id;

    if v_team_id is null then
      insert into public.team_tournament_teams (
        tenant_id, tournament_id, team_tournament_id, external_team_id,
        name, color, logo_url, captain_player_id, deputy_player_ids,
        absent_player_ids, locked_player_ids, created_by, updated_by
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_header.id, v_external_id,
        coalesce(v_team->>'name', 'Đội mới'),
        v_team->>'color', v_team->>'logoUrl',
        nullif(v_team->>'captainPlayerId', ''),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'deputyPlayerIds','[]'::jsonb)) x), '{}'),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'absentPlayerIds','[]'::jsonb)) x), '{}'),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'lockedPlayerIds','[]'::jsonb)) x), '{}'),
        auth.uid(), auth.uid()
      ) returning id into v_team_id;
    else
      update public.team_tournament_teams set
        name = coalesce(v_team->>'name', name),
        color = coalesce(v_team->>'color', color),
        logo_url = coalesce(v_team->>'logoUrl', logo_url),
        captain_player_id = coalesce(nullif(v_team->>'captainPlayerId', ''), captain_player_id),
        updated_at = now(),
        updated_by = auth.uid()
      where id = v_team_id;
    end if;

    delete from public.team_tournament_team_members
    where team_id = v_team_id;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_team->'playerIds', '[]'::jsonb))
    loop
      insert into public.team_tournament_team_members (
        tenant_id, tournament_id, team_id, player_id, role, created_by
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_team_id, v_player_id, 'member', auth.uid()
      )
      on conflict (team_id, player_id) do nothing;
    end loop;
  end loop;

  if jsonb_typeof(coalesce(p_groups, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_groups, '[]'::jsonb)) > 0 then
    select count(*) into v_input_count from jsonb_array_elements(p_groups);
    select count(distinct x.value) into v_team_count
    from jsonb_array_elements(p_groups) g,
         jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb)) x(value);
    if (
      select count(*)
      from jsonb_array_elements(p_groups) g,
           jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb))
    ) <> v_team_count then
      return jsonb_build_object('ok', false, 'code', 'DUPLICATE_GROUP_TEAM');
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_groups) g,
           jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb)) x(value)
      where not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id and t.external_team_id = x.value
      )
    ) then
      return jsonb_build_object('ok', false, 'code', 'UNKNOWN_TEAM');
    end if;

    delete from public.team_tournament_groups where team_tournament_id = v_header.id;
    for v_group in select value from jsonb_array_elements(p_groups) loop
      insert into public.team_tournament_groups (
        tenant_id, tournament_id, team_tournament_id, external_group_id, name, sort_order, team_ids
      ) values (
        v_header.tenant_id,
        v_header.tournament_id,
        v_header.id,
        coalesce(nullif(v_group->>'id', ''), gen_random_uuid()::text),
        coalesce(v_group->>'name', ''),
        coalesce((v_group->>'sortOrder')::int, 1),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_group->'teamIds', '[]'::jsonb))), '{}'::text[])
      );
    end loop;
  end if;

  if p_settings_patch is not null and p_settings_patch <> '{}'::jsonb then
    update public.team_tournaments
    set settings = coalesce(settings, '{}'::jsonb) || p_settings_patch,
        version = coalesce(version, 1) + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_header.id
    returning * into v_header;
  else
    update public.team_tournaments
    set version = coalesce(version, 1) + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_header.id
    returning * into v_header;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tournamentId', v_header.tournament_id,
    'version', v_header.version,
    'teamData', public.team_tournament_initial_setup_team_data(v_header)
  );
exception
  when others then
    if sqlerrm in ('access_denied: cross-tenant', 'TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', sqlerrm);
    end if;
    raise;
end;
$$;

revoke all on function public.team_tournament_merge_mlp_initial_settings(jsonb) from public, anon;
grant execute on function public.team_tournament_merge_mlp_initial_settings(jsonb) to authenticated;

revoke all on function public.team_tournament_seed_mlp_disciplines(public.team_tournaments) from public, anon;
grant execute on function public.team_tournament_seed_mlp_disciplines(public.team_tournaments) to authenticated;

revoke all on function public.team_tournament_initial_setup_team_data(public.team_tournaments) from public, anon;
grant execute on function public.team_tournament_initial_setup_team_data(public.team_tournaments) to authenticated;

revoke all on function public.team_tournament_create(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.team_tournament_create(text, text, text, text, text, text, jsonb) to authenticated;

revoke all on function public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb) to authenticated;

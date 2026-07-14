-- ─── Atomic publish core (TT-2E) ───
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_matchup_version integer,
  p_expected_lineup_a_version integer,
  p_expected_lineup_b_version integer,
  p_idempotency_key text
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
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_ops jsonb;
  v_pub timestamptz := now();
  v_before jsonb;
  v_actor_role text;
  v_replayed boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.publish')) then
    return json_build_object('ok', false, 'code', 'publish_forbidden', 'message', 'Không có quyền công bố đội hình.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupAVersion', p_expected_lineup_a_version,
      'expectedLineupBVersion', p_expected_lineup_b_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then
    v_replayed := true;
    return v_cmd->'result';
  end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status in ('published', 'in_progress', 'completed') then
    return json_build_object(
      'ok', false,
      'code', 'already_published',
      'message', 'Matchup đã được công bố.',
      'matchupVersion', v_matchup.version
    );
  end if;

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  if v_matchup.status <> 'locked' then
    return json_build_object(
      'ok', false,
      'code', 'matchup_not_locked',
      'message', 'Matchup chưa khóa.',
      'matchupVersion', v_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_a_id
  for update;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = v_matchup.team_b_id
  for update;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return json_build_object('ok', false, 'code', 'lineup_missing', 'message', 'Thiếu đội hình.');
  end if;

  if p_expected_lineup_a_version is not null and v_lineup_a.version <> p_expected_lineup_a_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_a_version, v_lineup_a.version
    );
  end if;

  if p_expected_lineup_b_version is not null and v_lineup_b.version <> p_expected_lineup_b_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_b_version, v_lineup_b.version
    );
  end if;

  v_ops := public.team_tournament_matchup_publish_ops(v_header, v_matchup, v_pub);

  if not coalesce((v_ops->>'canPublish')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'CANNOT_PUBLISH'),
      'message', coalesce(v_ops->>'blockMessage', 'Chưa đủ điều kiện công bố.'),
      'publishOps', v_ops
    );
  end if;

  v_before := jsonb_build_object(
    'matchupStatus', v_matchup.status,
    'matchupVersion', v_matchup.version,
    'lineupA', jsonb_build_object('status', v_lineup_a.status, 'version', v_lineup_a.version),
    'lineupB', jsonb_build_object('status', v_lineup_b.status, 'version', v_lineup_b.version)
  );

  update public.team_tournament_lineups l
  set status = 'published',
      published_at = v_pub,
      version = l.version + 1,
      updated_at = v_pub,
      updated_by = auth.uid()
  where l.id in (v_lineup_a.id, v_lineup_b.id)
    and l.status = 'locked';

  if (
    select count(*)::int from public.team_tournament_lineups
    where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
  ) <> 2 then
    raise exception 'TT2E publish partial lineup update blocked';
  end if;

  update public.team_tournament_matchups m
  set status = 'published',
      version = m.version + 1,
      updated_at = v_pub,
      updated_by = auth.uid()
  where m.id = v_matchup.id
    and m.status = 'locked'
    and (p_expected_matchup_version is null or m.version = p_expected_matchup_version);

  if not found then
    raise exception 'TT2E publish partial matchup update blocked';
  end if;

  select l.version into v_lineup_a.version from public.team_tournament_lineups l where l.id = v_lineup_a.id;
  select l.version into v_lineup_b.version from public.team_tournament_lineups l where l.id = v_lineup_b.id;
  select m.version into v_matchup.version from public.team_tournament_matchups m where m.id = v_matchup.id;

  v_actor_role := case
    when public.team_tournament_can_manage() then 'btc'
    when public.user_has_permission('team.lineup.publish') then 'organizer'
    else 'unknown'
  end;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.publish', p_matchup_id,
    jsonb_build_object(
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'tenantId', v_header.tenant_id,
      'tournamentId', p_tournament_id,
      'matchupId', p_matchup_id,
      'teamAId', v_matchup.team_a_id,
      'teamBId', v_matchup.team_b_id,
      'before', v_before,
      'after', jsonb_build_object(
        'matchupStatus', 'published',
        'matchupVersion', v_matchup.version,
        'lineupA', jsonb_build_object('status', 'published', 'version', v_lineup_a.version),
        'lineupB', jsonb_build_object('status', 'published', 'version', v_lineup_b.version),
        'publishedAt', v_pub
      ),
      'requestId', p_idempotency_key,
      'idempotencyKey', p_idempotency_key,
      'serverTime', v_pub
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'published',
    'matchupVersion', v_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'version', v_matchup.version,
    'publishedAt', v_pub,
    'replayed', v_replayed,
    'requestId', p_idempotency_key
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;


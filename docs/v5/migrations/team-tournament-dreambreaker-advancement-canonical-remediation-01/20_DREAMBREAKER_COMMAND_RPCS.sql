-- ═══════════════════════════════════════════════════════════════════
-- Dreambreaker command RPCs
-- Package: team-tournament-dreambreaker-advancement-canonical-remediation-01
-- Depends on: 10_RECOMPUTE_AND_DREAMBREAKER_ACTIVATE.sql
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_submit_dreambreaker_order(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_order jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_team public.team_tournament_teams;
  v_db public.team_tournament_dreambreaker_states;
  v_cmd json; v_hash text; v_order text[]; v_unique int; v_member_count int;
  v_result jsonb; v_is_a boolean;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  select * into v_team from public.team_tournament_teams
  where team_tournament_id = v_header.id and external_team_id = p_team_id;
  if v_team.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  if not (
    public.team_tournament_can_manage()
    or public.team_tournament_can_manage_results()
    or public.team_tournament_is_captain(v_header.id, p_team_id, public.team_tournament_user_player_id())
  ) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED', 'error', 'Dreambreaker chưa kích hoạt.'); end if;
  if v_db.status <> 'lineup_open' then return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Dreambreaker không nhận order.'); end if;
  if v_db.orders_locked_at is not null then return json_build_object('ok', false, 'code', 'LOCKED'); end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'submit_dreambreaker_order', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'teamId', p_team_id, 'order', p_order, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select coalesce(array_agg(x), '{}') into v_order
  from jsonb_array_elements_text(coalesce(p_order, '[]'::jsonb)) as t(x);
  if coalesce(array_length(v_order, 1), 0) <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Cần đúng 4 VĐV.');
  end if;
  select count(distinct u) into v_unique from unnest(v_order) u;
  if v_unique <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thứ tự không được trùng.');
  end if;
  select count(*) into v_member_count
  from unnest(v_order) u
  join public.team_tournament_team_members m
    on m.team_id = v_team.id and m.player_id = u;
  if v_member_count <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'VĐV phải thuộc đội.');
  end if;

  v_is_a := p_team_id = v_matchup.team_a_id;
  update public.team_tournament_dreambreaker_states set
    team_a_order = case when v_is_a then to_jsonb(v_order) else team_a_order end,
    team_b_order = case when v_is_a then team_b_order else to_jsonb(v_order) end,
    order_source_a = case when v_is_a then 'captain' else order_source_a end,
    order_source_b = case when v_is_a then order_source_b else 'captain' end,
    status = case
      when jsonb_array_length(case when v_is_a then to_jsonb(v_order) else team_a_order end) = 4
       and jsonb_array_length(case when v_is_a then team_b_order else to_jsonb(v_order) end) = 4
      then 'ready' else 'lineup_open' end,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_db.id
  returning * into v_db;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'status', v_db.status,
    'teamAOrder', v_db.team_a_order, 'teamBOrder', v_db.team_b_order);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.order_submit', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'submit_dreambreaker_order', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_lock_dreambreaker_order(
  p_tournament_id text, p_matchup_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_cmd json; v_hash text; v_result jsonb;
  v_order_a jsonb; v_order_b jsonb; v_src_a text; v_src_b text; v_tmp text[];
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not (public.team_tournament_can_manage() or public.team_tournament_can_manage_results()) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED'); end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'lock_dreambreaker_order', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  v_order_a := v_db.team_a_order; v_order_b := v_db.team_b_order;
  v_src_a := v_db.order_source_a; v_src_b := v_db.order_source_b;
  if jsonb_array_length(coalesce(v_order_a, '[]'::jsonb)) <> 4 then
    select coalesce(array_agg(m.player_id order by random()), '{}') into v_tmp
    from public.team_tournament_teams t
    join public.team_tournament_team_members m on m.team_id = t.id
    where t.team_tournament_id = v_header.id and t.external_team_id = v_matchup.team_a_id;
    if coalesce(array_length(v_tmp, 1), 0) < 4 then
      return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Đội A thiếu VĐV.');
    end if;
    v_order_a := to_jsonb(v_tmp[1:4]); v_src_a := 'random';
  end if;
  if jsonb_array_length(coalesce(v_order_b, '[]'::jsonb)) <> 4 then
    select coalesce(array_agg(m.player_id order by random()), '{}') into v_tmp
    from public.team_tournament_teams t
    join public.team_tournament_team_members m on m.team_id = t.id
    where t.team_tournament_id = v_header.id and t.external_team_id = v_matchup.team_b_id;
    if coalesce(array_length(v_tmp, 1), 0) < 4 then
      return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Đội B thiếu VĐV.');
    end if;
    v_order_b := to_jsonb(v_tmp[1:4]); v_src_b := 'random';
  end if;

  update public.team_tournament_dreambreaker_states set
    team_a_order = v_order_a, team_b_order = v_order_b,
    order_source_a = v_src_a, order_source_b = v_src_b,
    orders_locked_at = coalesce(orders_locked_at, now()),
    status = 'ready', version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'status', v_db.status,
    'teamAOrder', v_db.team_a_order, 'teamBOrder', v_db.team_b_order, 'ordersLockedAt', v_db.orders_locked_at);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.order_lock', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'lock_dreambreaker_order', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_start_dreambreaker(
  p_tournament_id text, p_matchup_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_disc public.team_tournament_disciplines;
  v_cmd json; v_hash text; v_result jsonb; v_sub_ext text; v_sub_id uuid;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage_results() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED'); end if;
  if jsonb_array_length(coalesce(v_db.team_a_order,'[]'::jsonb)) <> 4
     or jsonb_array_length(coalesce(v_db.team_b_order,'[]'::jsonb)) <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Hai đội phải có thứ tự 4 VĐV.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'start_dreambreaker', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select * into v_disc from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id
    and (lower(coalesce(d.name,'')) like '%dreambreaker%'
      or lower(coalesce(d.external_discipline_id,'')) like '%dreambreaker%'
      or lower(coalesce(d.discipline_kind,'')) like '%dreambreaker%'
      or lower(coalesce(d.activation_rule,'')) = 'dreambreaker')
  order by d.sort_order nulls last limit 1;
  if v_disc.id is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu nội dung Dreambreaker.');
  end if;

  v_sub_ext := coalesce(nullif(trim(v_db.sub_match_external_id), ''), 'db-' || p_matchup_id);
  select id into v_sub_id from public.team_tournament_sub_matches
  where matchup_id = v_matchup.id and external_sub_match_id = v_sub_ext;
  if v_sub_id is null then
    insert into public.team_tournament_sub_matches (
      tenant_id, tournament_id, matchup_id, discipline_external_id, external_sub_match_id,
      sort_order, status, score, winner_team_id, version, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, v_disc.external_discipline_id, v_sub_ext,
      coalesce(v_disc.sort_order, 99), 'playing',
      jsonb_build_object('teamA', 0, 'teamB', 0, 'games', '[]'::jsonb),
      null, 1, auth.uid()
    ) returning id into v_sub_id;
  end if;

  update public.team_tournament_dreambreaker_states set
    status = 'in_progress', sub_match_external_id = v_sub_ext,
    team_a_score = 0, team_b_score = 0, winner_team_id = null,
    rotation = jsonb_build_object(
      'segmentIndex', 0, 'pointsInSegment', 0, 'pointHistory', '[]'::jsonb,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    orders_locked_at = coalesce(orders_locked_at, now()),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  update public.team_tournament_matchups set status = 'in_progress', updated_at = now(), updated_by = auth.uid()
  where id = v_matchup.id;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'status', v_db.status,
    'subMatchId', v_sub_ext);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.start', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'start_dreambreaker', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_record_dreambreaker_point(
  p_tournament_id text, p_matchup_id text, p_scoring_team_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_disc public.team_tournament_disciplines;
  v_cmd json; v_hash text; v_result jsonb;
  v_a int; v_b int; v_hist jsonb; v_seg int; v_pts int; v_rot int; v_target int; v_win_by int;
  v_winner text := null; v_completed boolean := false;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage_results() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null or v_db.status <> 'in_progress' then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Dreambreaker chưa bắt đầu.');
  end if;
  if p_scoring_team_id not in (v_matchup.team_a_id, v_matchup.team_b_id) then
    return json_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'record_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'scoringTeamId', p_scoring_team_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  select * into v_disc from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id
    and (lower(coalesce(d.name,'')) like '%dreambreaker%' or lower(coalesce(d.discipline_kind,'')) like '%dreambreaker%')
  limit 1;
  v_rot := coalesce((v_disc.scoring_format->>'rotationPoints')::int, 4);
  v_target := coalesce((v_disc.scoring_format->>'targetScore')::int, 11);
  v_win_by := coalesce((v_disc.scoring_format->>'winBy')::int, 2);

  v_a := v_db.team_a_score + case when p_scoring_team_id = v_matchup.team_a_id then 1 else 0 end;
  v_b := v_db.team_b_score + case when p_scoring_team_id = v_matchup.team_b_id then 1 else 0 end;
  v_seg := coalesce((v_db.rotation->>'segmentIndex')::int, 0);
  v_pts := coalesce((v_db.rotation->>'pointsInSegment')::int, 0) + 1;
  v_hist := coalesce(v_db.rotation->'pointHistory', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('teamId', p_scoring_team_id, 'segmentIndex', v_seg, 'teamAScore', v_a, 'teamBScore', v_b)
  );
  if v_pts >= v_rot then v_seg := v_seg + 1; v_pts := 0; end if;

  if greatest(v_a, v_b) >= v_target and abs(v_a - v_b) >= v_win_by then
    v_winner := case when v_a > v_b then v_matchup.team_a_id else v_matchup.team_b_id end;
    v_completed := true;
  end if;

  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a, team_b_score = v_b, winner_team_id = v_winner,
    status = case when v_completed then 'completed' else 'in_progress' end,
    rotation = jsonb_build_object(
      'segmentIndex', v_seg, 'pointsInSegment', v_pts, 'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  if v_db.sub_match_external_id is not null then
    update public.team_tournament_sub_matches set
      score = jsonb_build_object('teamA', v_a, 'teamB', v_b, 'games', '[]'::jsonb),
      status = case when v_completed then 'completed' else 'playing' end,
      winner_team_id = v_winner,
      result_confirmed_at = case when v_completed then now() else result_confirmed_at end,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
    where matchup_id = v_matchup.id and external_sub_match_id = v_db.sub_match_external_id;
  end if;

  if v_completed then
    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
  end if;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'teamAScore', v_a, 'teamBScore', v_b,
    'completed', v_completed, 'winnerTeamId', v_winner, 'status', v_db.status);
  perform public.team_tournament_write_audit(v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.point', p_matchup_id, v_result);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'record_dreambreaker_point', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_undo_dreambreaker_point(
  p_tournament_id text, p_matchup_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_cmd json; v_hash text; v_result jsonb;
  v_hist jsonb; v_last jsonb; v_a int := 0; v_b int := 0; v_seg int := 0; v_pts int := 0; v_len int;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage_results() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED'); end if;
  v_hist := coalesce(v_db.rotation->'pointHistory', '[]'::jsonb);
  v_len := jsonb_array_length(v_hist);
  if v_len = 0 then return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Không có điểm để hoàn tác.'); end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'undo_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  v_hist := v_hist - (v_len - 1);
  if jsonb_array_length(v_hist) > 0 then
    v_last := v_hist -> (jsonb_array_length(v_hist) - 1);
    v_a := coalesce((v_last->>'teamAScore')::int, 0);
    v_b := coalesce((v_last->>'teamBScore')::int, 0);
    v_seg := coalesce((v_last->>'segmentIndex')::int, 0);
    select count(*)::int into v_pts from jsonb_array_elements(v_hist) e where (e->>'segmentIndex')::int = v_seg;
  end if;

  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a, team_b_score = v_b, winner_team_id = null, status = 'in_progress',
    rotation = jsonb_build_object('segmentIndex', v_seg, 'pointsInSegment', v_pts, 'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  if v_db.sub_match_external_id is not null then
    update public.team_tournament_sub_matches set
      score = jsonb_build_object('teamA', v_a, 'teamB', v_b, 'games', '[]'::jsonb),
      status = 'playing', winner_team_id = null, result_confirmed_at = null,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
    where matchup_id = v_matchup.id and external_sub_match_id = v_db.sub_match_external_id;
  end if;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'teamAScore', v_a, 'teamBScore', v_b, 'status', v_db.status);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'undo_dreambreaker_point', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_dreambreaker_injury(
  p_tournament_id text, p_matchup_id text, p_team_id text, p_player_id text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_db public.team_tournament_dreambreaker_states; v_cmd json; v_hash text; v_result jsonb;
  v_skips jsonb; v_seg int;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage_results() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then return json_build_object('ok', false, 'code', 'NOT_ACTIVATED'); end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'dreambreaker_injury', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'teamId', p_team_id, 'playerId', p_player_id, 'expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict('team_tournament_dreambreaker_states', p_expected_version, v_db.version);
  end if;

  v_seg := coalesce((v_db.rotation->>'segmentIndex')::int, 0);
  v_skips := coalesce(v_db.rotation->'injurySkips', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('teamId', p_team_id, 'skippedPlayerId', p_player_id, 'atSegment', v_seg)
  );
  update public.team_tournament_dreambreaker_states set
    rotation = jsonb_set(coalesce(rotation, '{}'::jsonb), '{injurySkips}', v_skips, true),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id returning * into v_db;

  v_result := jsonb_build_object('ok', true, 'version', v_db.version, 'injurySkips', v_skips);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'dreambreaker_injury', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

create or replace function public.team_tournament_sync_dreambreaker(
  p_tournament_id text,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_header public.team_tournaments; v_matchup public.team_tournament_matchups;
  v_cmd json; v_hash text; v_result jsonb; v_act jsonb; v_count int := 0;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  if not public.team_tournament_can_manage() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'sync_dreambreaker', p_idempotency_key,
    jsonb_build_object('expectedVersion', p_expected_version));
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  for v_matchup in
    select * from public.team_tournament_matchups where team_tournament_id = v_header.id
  loop
    v_act := public.team_tournament_maybe_activate_dreambreaker(v_header, v_matchup);
    if coalesce((v_act->>'activated')::boolean, false)
       or coalesce(v_act->>'code', '') = 'DREAMBREAKER_REQUIRED' then
      v_count := v_count + 1;
    end if;
  end loop;

  v_result := jsonb_build_object('ok', true, 'activatedCount', v_count, 'changed', v_count > 0);
  perform public.team_tournament_finish_command(v_header.tenant_id, p_tournament_id,
    'sync_dreambreaker', p_idempotency_key, v_hash, v_result);
  return v_result;
end;
$$;

grant execute on function public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text) to authenticated;
grant execute on function public.team_tournament_lock_dreambreaker_order(text,text,integer,text) to authenticated;
grant execute on function public.team_tournament_start_dreambreaker(text,text,integer,text) to authenticated;
grant execute on function public.team_tournament_record_dreambreaker_point(text,text,text,integer,text) to authenticated;
grant execute on function public.team_tournament_undo_dreambreaker_point(text,text,integer,text) to authenticated;
grant execute on function public.team_tournament_dreambreaker_injury(text,text,text,text,integer,text) to authenticated;
grant execute on function public.team_tournament_sync_dreambreaker(text,integer,text) to authenticated;

revoke all on function public.team_tournament_submit_dreambreaker_order(text,text,text,jsonb,integer,text) from anon, public;
revoke all on function public.team_tournament_lock_dreambreaker_order(text,text,integer,text) from anon, public;
revoke all on function public.team_tournament_start_dreambreaker(text,text,integer,text) from anon, public;
revoke all on function public.team_tournament_record_dreambreaker_point(text,text,text,integer,text) from anon, public;
revoke all on function public.team_tournament_undo_dreambreaker_point(text,text,integer,text) from anon, public;
revoke all on function public.team_tournament_dreambreaker_injury(text,text,text,text,integer,text) from anon, public;
revoke all on function public.team_tournament_sync_dreambreaker(text,integer,text) from anon, public;

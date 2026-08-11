-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-dreambreaker-submit-auth-privacy-01
-- Workstream: TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-SUBMIT-CANONICAL-AUTH-PRIVACY-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Hardens public.team_tournament_submit_dreambreaker_order only:
--   * p_team_id must be matchup team A or team B (zero write otherwise)
--   * captain/deputy + captainAccessEnabled remain via guard_captain_portal_write
--   * CAS on dreambreaker_states.version before write
--   * viewer-safe result: ownOrder + opponentOrderSubmitted boolean
--   * no teamAOrder / teamBOrder in response
-- Signature, grants, RLS, RBAC unchanged.
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
  v_cmd json;
  v_hash text;
  v_order text[];
  v_unique int;
  v_member_count int;
  v_result jsonb;
  v_is_a boolean;
  v_gate json;
  v_own jsonb;
  v_opp jsonb;
  v_replay jsonb;
begin
  -- 1. auth
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  -- 2. resolve tournament / matchup / team
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups
  where team_tournament_id = v_header.id
    and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_team
  from public.team_tournament_teams
  where team_tournament_id = v_header.id
    and external_team_id = p_team_id;
  if v_team.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- 3. MATCHUP_PARTICIPANT_ASSERTION — zero write if team is not in this matchup
  if p_team_id is distinct from v_matchup.team_a_id
     and p_team_id is distinct from v_matchup.team_b_id then
    return json_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'error', 'Đội không thuộc lượt đối đầu này.'
    );
  end if;
  v_is_a := p_team_id is not distinct from v_matchup.team_a_id;

  -- 4+5. captain/deputy of p_team_id + captainAccessEnabled
  -- Existing BTC manage/results path unchanged (not a Super Admin bypass).
  if public.team_tournament_can_manage() or public.team_tournament_can_manage_results() then
    null;
  else
    v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
    if not coalesce((v_gate->>'ok')::boolean, false) then
      return v_gate;
    end if;
  end if;

  if to_regclass('public.team_tournament_dreambreaker_states') is null then
    return json_build_object('ok', false, 'code', 'NOT_ACTIVATED', 'error', 'Dreambreaker chưa sẵn sàng.');
  end if;

  select * into v_db
  from public.team_tournament_dreambreaker_states
  where matchup_id = v_matchup.id;
  if v_db.id is null then
    return json_build_object('ok', false, 'code', 'NOT_ACTIVATED', 'error', 'Dreambreaker chưa kích hoạt.');
  end if;
  if v_db.status <> 'lineup_open' then
    return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Dreambreaker không nhận order.');
  end if;
  if v_db.orders_locked_at is not null then
    return json_build_object('ok', false, 'code', 'LOCKED');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id,
    p_tournament_id,
    'submit_dreambreaker_order',
    p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'teamId', p_team_id,
      'order', p_order,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then
    return v_cmd;
  end if;
  if (v_cmd->>'replay')::boolean then
    v_replay := coalesce(v_cmd->'result', '{}'::json)::jsonb;
    return json_build_object(
      'ok', coalesce((v_replay->>'ok')::boolean, true),
      'status', v_replay->>'status',
      'version', (v_replay->>'version')::integer,
      'canSubmitOwnOrder', coalesce((v_replay->>'canSubmitOwnOrder')::boolean, false),
      'ownOrder', coalesce(v_replay->'ownOrder', '[]'::jsonb),
      'opponentOrderSubmitted', coalesce((v_replay->>'opponentOrderSubmitted')::boolean, false)
    );
  end if;
  v_hash := v_cmd->>'payload_hash';

  -- 6. validate own-team 4-athlete order
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
    on m.team_id = v_team.id
   and m.player_id = u;
  if v_member_count <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'VĐV phải thuộc đội.');
  end if;

  -- 7. DREAMBREAKER_CAS_BEFORE_WRITE — stale version is zero-write
  if p_expected_version is not null and v_db.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states',
      p_expected_version,
      v_db.version
    );
  end if;

  -- 8. write own order only
  update public.team_tournament_dreambreaker_states set
    team_a_order = case when v_is_a then to_jsonb(v_order) else team_a_order end,
    team_b_order = case when v_is_a then team_b_order else to_jsonb(v_order) end,
    order_source_a = case when v_is_a then 'captain' else order_source_a end,
    order_source_b = case when v_is_a then order_source_b else 'captain' end,
    status = case
      when jsonb_array_length(case when v_is_a then to_jsonb(v_order) else team_a_order end) = 4
       and jsonb_array_length(case when v_is_a then team_b_order else to_jsonb(v_order) end) = 4
      then 'ready'
      else 'lineup_open'
    end,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_db.id
  returning * into v_db;

  v_own := case when v_is_a then v_db.team_a_order else v_db.team_b_order end;
  v_opp := case when v_is_a then v_db.team_b_order else v_db.team_a_order end;
  v_result := jsonb_build_object(
    'ok', true,
    'status', v_db.status,
    'version', v_db.version,
    'canSubmitOwnOrder', false,
    'ownOrder', coalesce(v_own, '[]'::jsonb),
    'opponentOrderSubmitted', jsonb_array_length(coalesce(v_opp, '[]'::jsonb)) = 4
  );
  perform public.team_tournament_write_audit(
    v_header.tenant_id,
    v_header.tournament_id,
    'team.match.dreambreaker.order_submit',
    p_matchup_id,
    v_result
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id,
    p_tournament_id,
    'submit_dreambreaker_order',
    p_idempotency_key,
    v_hash,
    v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) from public;
revoke all on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) from anon;
grant execute on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) to authenticated;

comment on function public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text) is
  'Captain Dreambreaker order submit. Matchup participant + captain/deputy. Viewer-safe ownOrder only.';

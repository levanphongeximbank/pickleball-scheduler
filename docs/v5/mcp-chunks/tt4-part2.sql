-- ─── 6. Forfeit ops helper ────────────────────────────────────────
create or replace function public.team_tournament_sub_match_forfeit_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_can_manage boolean := public.team_tournament_can_manage();
  v_can_results boolean := public.team_tournament_can_manage_results();
  v_can_apply boolean := false;
begin
  if p_sub_match.id is null then
    return jsonb_build_object(
      'canApplyForfeit', false,
      'blockCode', 'NOT_FOUND',
      'blockMessage', 'Không tìm thấy trận con.'
    );
  end if;

  if public.team_tournament_sub_match_is_confirmed_normal(p_sub_match) then
    return jsonb_build_object(
      'canApplyForfeit', false,
      'blockCode', 'forfeit_blocked_confirmed_result',
      'blockMessage', 'Trận con đã xác nhận — không thể apply forfeit trực tiếp.',
      'subMatchVersion', p_sub_match.version,
      'subMatchStatus', p_sub_match.status
    );
  end if;

  v_can_apply := v_can_manage or v_can_results;

  if not v_can_apply then
    return jsonb_build_object(
      'canApplyForfeit', false,
      'blockCode', 'forfeit_forbidden',
      'blockMessage', 'Không có quyền xử thua kỹ thuật.',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  if p_matchup.status not in ('published', 'in_progress', 'completed', 'locked') then
    return jsonb_build_object(
      'canApplyForfeit', false,
      'blockCode', 'matchup_not_ready',
      'blockMessage', 'Matchup chưa sẵn sàng cho forfeit.',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  return jsonb_build_object(
    'canApplyForfeit', true,
    'blockCode', null,
    'blockMessage', null,
    'subMatchVersion', p_sub_match.version,
    'subMatchStatus', p_sub_match.status,
    'canManageWithdrawal', v_can_manage,
    'technicalScoreDefaults', public.team_tournament_technical_score_defaults(p_header.settings)
  );
end;
$$;

-- ─── 7. Apply forfeit (TT-4 enhanced) ─────────────────────────────
create or replace function public.team_tournament_apply_forfeit(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text default null,
  p_forfeiting_team_id text default null,
  p_scope text default 'sub_match',
  p_result_type text default 'forfeit',
  p_forfeit_reason text default '',
  p_technical_score jsonb default '{}'::jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null,
  p_reason_code text default '',
  p_request_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_winner text;
  v_score jsonb;
  v_defaults jsonb;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_actor_role text;
  v_matchup_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.team_tournament_can_manage() or public.team_tournament_can_manage_results()) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if coalesce(trim(p_forfeit_reason), '') = '' then
    return json_build_object('ok', false, 'code', 'forfeit_reason_required', 'error', 'Lý do bắt buộc.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'apply_forfeit', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'forfeitingTeamId', p_forfeiting_team_id, 'scope', p_scope,
      'resultType', p_result_type, 'reason', p_forfeit_reason,
      'reasonCode', p_reason_code, 'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Matchup không tồn tại.');
  end if;

  if p_scope <> 'sub_match' or p_sub_match_id is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'TT-4 pilot: chỉ hỗ trợ scope sub_match qua RPC này.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Sub-match không tồn tại.');
  end if;

  if public.team_tournament_sub_match_is_confirmed_normal(v_sub_match) then
    return json_build_object(
      'ok', false,
      'code', 'forfeit_blocked_confirmed_result',
      'error', 'Trận con đã xác nhận — không thể apply forfeit trực tiếp.'
    );
  end if;

  if p_forfeiting_team_id not in (v_matchup.team_a_id, v_matchup.team_b_id) then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Đội forfeit không hợp lệ.');
  end if;

  if p_expected_version is not null and v_sub_match.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_winner := case
    when p_forfeiting_team_id = v_matchup.team_a_id then v_matchup.team_b_id
    else v_matchup.team_a_id
  end;

  v_defaults := public.team_tournament_technical_score_defaults(v_header.settings);
  v_score := public.team_tournament_resolve_technical_score(
    v_header.settings, v_matchup.team_a_id, v_matchup.team_b_id,
    p_forfeiting_team_id, p_technical_score
  );

  v_before := jsonb_build_object(
    'status', v_sub_match.status,
    'score', v_sub_match.score,
    'winnerTeamId', v_sub_match.winner_team_id,
    'version', v_sub_match.version
  );

  v_actor_role := case
    when public.team_tournament_can_manage() then 'btc'
    else 'referee'
  end;

  update public.team_tournament_sub_matches set
    status = 'forfeit',
    winner_team_id = v_winner,
    score = v_score,
    result_confirmed_at = now(),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    select version into v_sub_match.version from public.team_tournament_sub_matches where id = v_sub_match.id;
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_after := jsonb_build_object(
    'status', 'forfeit',
    'score', v_score,
    'winnerTeamId', v_winner,
    'version', v_sub_match.version + 1
  );

  insert into public.team_tournament_forfeit_events (
    tenant_id, tournament_id, matchup_id, sub_match_id, scope,
    result_type, reason_code, forfeit_reason, forfeiting_team_id,
    awarded_winner_team_id, technical_score,
    affects_standings, affects_point_difference, affects_elo,
    approved_by, approved_at, idempotency_key, request_id, actor_role,
    before_data, after_data
  ) values (
    v_header.tenant_id, p_tournament_id, v_matchup.id, v_sub_match.id, p_scope,
    coalesce(nullif(p_result_type, ''), 'forfeit'),
    coalesce(p_reason_code, ''),
    coalesce(p_forfeit_reason, ''),
    p_forfeiting_team_id, v_winner, v_score,
    coalesce((v_defaults->>'affectsStandings')::boolean, true),
    coalesce((v_defaults->>'affectsPointDifference')::boolean, true),
    coalesce((v_defaults->>'affectsElo')::boolean, false),
    auth.uid(), now(), p_idempotency_key, p_request_id, v_actor_role,
    v_before, v_after
  )
  returning id into v_event_id;

  v_matchup_result := public.team_tournament_recompute_matchup_result(v_matchup.id);
  perform public.team_tournament_recompute_standings_cache(v_header.id);

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.match.forfeit', p_sub_match_id,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'reason', p_forfeit_reason,
      'reasonCode', p_reason_code,
      'resultType', p_result_type,
      'scope', p_scope,
      'forfeitingTeamId', p_forfeiting_team_id,
      'winnerTeamId', v_winner,
      'eventId', v_event_id,
      'requestId', p_request_id,
      'before', v_before,
      'after', v_after
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'winnerTeamId', v_winner,
    'score', v_score,
    'version', v_sub_match.version + 1,
    'eventId', v_event_id,
    'matchupResult', v_matchup_result,
    'affectsElo', coalesce((v_defaults->>'affectsElo')::boolean, false)
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'apply_forfeit', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ─── 8. Team withdrawal ───────────────────────────────────────────
create or replace function public.team_tournament_withdraw_team(
  p_tournament_id text,
  p_team_id text,
  p_reason text default '',
  p_reason_code text default 'team_withdrawal',
  p_idempotency_key text default null,
  p_request_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team public.team_tournament_teams;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_matchup record;
  v_sub record;
  v_forfeit_count int := 0;
  v_skipped_confirmed int := 0;
  v_event_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if coalesce(trim(p_reason), '') = '' then
    return json_build_object('ok', false, 'code', 'withdrawal_reason_required', 'error', 'Lý do rút giải bắt buộc.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'withdraw_team', p_idempotency_key,
    jsonb_build_object('teamId', p_team_id, 'reason', p_reason, 'reasonCode', p_reason_code)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_team
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id and t.external_team_id = p_team_id;

  if v_team.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Đội không tồn tại.');
  end if;
  if v_team.withdrawn then
    return json_build_object('ok', false, 'code', 'ALREADY_WITHDRAWN', 'error', 'Đội đã rút giải.');
  end if;

  update public.team_tournament_teams set
    withdrawn = true,
    withdrawn_at = now(),
    withdrawal_reason = p_reason,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_team.id;

  for v_matchup in
    select m.*
    from public.team_tournament_matchups m
    where m.team_tournament_id = v_header.id
      and p_team_id in (m.team_a_id, m.team_b_id)
      and m.status <> 'completed'
  loop
    for v_sub in
      select sm.*
      from public.team_tournament_sub_matches sm
      where sm.matchup_id = v_matchup.id
        and sm.status not in ('completed', 'forfeit')
    loop
      if public.team_tournament_sub_match_is_confirmed_normal(v_sub) then
        v_skipped_confirmed := v_skipped_confirmed + 1;
        continue;
      end if;

      update public.team_tournament_sub_matches set
        status = 'forfeit',
        winner_team_id = case
          when p_team_id = v_matchup.team_a_id then v_matchup.team_b_id
          else v_matchup.team_a_id
        end,
        score = public.team_tournament_resolve_technical_score(
          v_header.settings, v_matchup.team_a_id, v_matchup.team_b_id, p_team_id, '{}'::jsonb
        ),
        result_confirmed_at = now(),
        version = version + 1,
        updated_at = now(),
        updated_by = auth.uid()
      where id = v_sub.id;

      insert into public.team_tournament_forfeit_events (
        tenant_id, tournament_id, matchup_id, sub_match_id, scope,
        result_type, reason_code, forfeit_reason, forfeiting_team_id,
        awarded_winner_team_id, technical_score,
        affects_standings, affects_point_difference, affects_elo,
        approved_by, approved_at, idempotency_key, request_id, actor_role
      ) values (
        v_header.tenant_id, p_tournament_id, v_matchup.id, v_sub.id, 'sub_match',
        'team_withdrawal', coalesce(p_reason_code, 'team_withdrawal'), p_reason, p_team_id,
        case when p_team_id = v_matchup.team_a_id then v_matchup.team_b_id else v_matchup.team_a_id end,
        public.team_tournament_resolve_technical_score(
          v_header.settings, v_matchup.team_a_id, v_matchup.team_b_id, p_team_id, '{}'::jsonb
        ),
        true, true, false,
        auth.uid(), now(),
        coalesce(p_idempotency_key, gen_random_uuid()::text) || ':wd:' || v_sub.external_sub_match_id,
        p_request_id, 'btc'
      );

      v_forfeit_count := v_forfeit_count + 1;
    end loop;

    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
  end loop;

  perform public.team_tournament_recompute_standings_cache(v_header.id);

  insert into public.team_tournament_forfeit_events (
    tenant_id, tournament_id, scope, result_type, reason_code,
    forfeit_reason, forfeiting_team_id, awarded_winner_team_id,
    affects_standings, affects_point_difference, affects_elo,
    approved_by, approved_at, idempotency_key, request_id, actor_role,
    after_data
  ) values (
    v_header.tenant_id, p_tournament_id, 'team_withdrawal', 'team_withdrawal',
    coalesce(p_reason_code, 'team_withdrawal'), p_reason, p_team_id, null,
    true, false, false,
    auth.uid(), now(), p_idempotency_key, p_request_id, 'btc',
    jsonb_build_object('forfeitedSubMatches', v_forfeit_count, 'skippedConfirmed', v_skipped_confirmed)
  )
  returning id into v_event_id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.withdraw', p_team_id,
    jsonb_build_object(
      'reason', p_reason,
      'reasonCode', p_reason_code,
      'forfeitedSubMatches', v_forfeit_count,
      'skippedConfirmed', v_skipped_confirmed,
      'eventId', v_event_id
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'teamId', p_team_id,
    'forfeitedSubMatches', v_forfeit_count,
    'skippedConfirmed', v_skipped_confirmed,
    'eventId', v_event_id
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'withdraw_team', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ─── 9. Grants ────────────────────────────────────────────────────
revoke all on function public.team_tournament_apply_forfeit(text, text, text, text, text, text, text, jsonb, integer, text, text, text) from public, anon;
grant execute on function public.team_tournament_apply_forfeit(text, text, text, text, text, text, text, jsonb, integer, text, text, text) to authenticated;

revoke all on function public.team_tournament_withdraw_team(text, text, text, text, text, text) from public, anon;
grant execute on function public.team_tournament_withdraw_team(text, text, text, text, text, text) to authenticated;

revoke all on function public.team_tournament_sub_match_forfeit_ops(public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches) from public, anon;
grant execute on function public.team_tournament_sub_match_forfeit_ops(public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches) to authenticated;

comment on function public.team_tournament_apply_forfeit is 'TT-4 atomic sub-match forfeit with standings + audit';
comment on function public.team_tournament_withdraw_team is 'TT-4 team withdrawal — forfeits unplayed sub-matches, preserves confirmed results';

-- Phase TT-5B — Legacy score lock + get_setup ops exposure
-- Staging only | patches draft/confirm RPCs

-- ═══════════════════════════════════════════════════════════════════
-- 1. Score ops helper (mirror forfeitOps)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_sub_match_score_ops(
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
  v_link public.team_sub_match_referee_links;
  v_can_results boolean := public.team_tournament_can_manage_results();
  v_can_manage boolean := public.team_tournament_can_manage();
begin
  if p_sub_match.id is null then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'NOT_FOUND'
    );
  end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is not null and public.team_tournament_referee_link_blocks_legacy(v_link.status) then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', case
        when v_link.status = 'finalized' then 'referee_v5_result_finalized'
        when v_link.status in ('active', 'sync_error') then 'referee_v5_match_active'
        else 'referee_v5_linked_legacy_write_blocked'
      end,
      'blockMessage', case
        when v_link.status = 'finalized' then 'Kết quả đã chốt qua Referee V5.'
        else 'Trận con đang dùng Referee V5 — legacy score entry bị khóa.'
      end,
      'linkId', v_link.id,
      'linkStatus', v_link.status,
      'refereeMatchId', v_link.referee_match_id,
      'refereeRoute', '/referee/match/' || v_link.referee_match_id,
      'subMatchVersion', p_sub_match.version
    );
  end if;

  if not (v_can_results or v_can_manage) then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'FORBIDDEN',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  if p_sub_match.result_confirmed_at is not null and p_sub_match.status = 'completed' then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'result_already_confirmed',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  return jsonb_build_object(
    'canSaveDraft', true,
    'canConfirm', true,
    'blockCode', null,
    'blockMessage', null,
    'linkId', v_link.id,
    'linkStatus', v_link.status,
    'refereeRoute', case when v_link.id is not null then '/referee/match/' || v_link.referee_match_id else null end,
    'subMatchVersion', p_sub_match.version
  );
end;
$$;

create or replace function public.team_tournament_sub_match_referee_link_ops(
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
  v_link public.team_sub_match_referee_links;
  v_elig jsonb;
  v_can_manage boolean := public.team_tournament_can_manage();
begin
  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is not null then
    return jsonb_build_object(
      'hasLink', true,
      'linkId', v_link.id,
      'status', v_link.status,
      'refereeMatchId', v_link.referee_match_id,
      'refereeAssignmentId', v_link.referee_assignment_id,
      'provisionedAt', v_link.provisioned_at,
      'route', '/referee/match/' || v_link.referee_match_id,
      'canProvision', false,
      'canRevoke', v_can_manage and v_link.status in ('provisioned', 'assigned'),
      'canOpenWorkspace', v_link.status in ('provisioned', 'assigned', 'active', 'finalized'),
      'version', v_link.version,
      'snapshot', v_link.snapshot
    );
  end if;

  v_elig := public.team_tournament_provision_eligibility(
    p_header, p_matchup, p_sub_match, null
  );

  return jsonb_build_object(
    'hasLink', false,
    'status', 'none',
    'canProvision', v_can_manage and coalesce((v_elig->>'eligible')::boolean, false),
    'canRevoke', false,
    'canOpenWorkspace', false,
    'blockCode', v_elig->>'blockCode',
    'blockMessage', v_elig->>'blockMessage',
    'eligibility', v_elig
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Patch save_sub_match_draft — legacy lock
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb
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
  v_score_ops jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status not in ('published','in_progress','completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_score_ops := public.team_tournament_sub_match_score_ops(v_header, v_matchup, v_sub_match);
  if not coalesce((v_score_ops->>'canSaveDraft')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_score_ops->>'blockCode', 'referee_v5_linked_legacy_write_blocked'),
      'error', coalesce(v_score_ops->>'blockMessage', 'Legacy draft bị khóa.')
    );
  end if;

  if v_sub_match.result_confirmed_at is not null
     and not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Kết quả đã xác nhận.');
  end if;

  update public.team_tournament_sub_matches set
    status = 'playing',
    score = p_score,
    winner_team_id = null,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id;

  if v_matchup.status = 'published' then
    update public.team_tournament_matchups set
      status = 'in_progress', updated_at = now(), updated_by = auth.uid()
    where id = v_matchup.id;
  end if;

  return json_build_object('ok', true);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Patch confirm_sub_match — append legacy lock to TT-1B body
--    (re-run TT-1B confirm with guard at top via wrapper pattern)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null,
  p_expected_version integer default null,
  p_idempotency_key text default null
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
  v_score_ops jsonb;
  v_cmd json;
  v_hash text;
  v_winner text;
  v_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  v_score_ops := public.team_tournament_sub_match_score_ops(v_header, v_matchup, v_sub_match);
  if not coalesce((v_score_ops->>'canConfirm')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_score_ops->>'blockCode', 'referee_v5_linked_legacy_write_blocked'),
      'error', coalesce(v_score_ops->>'blockMessage', 'Legacy confirm bị khóa.')
    );
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'score', p_score, 'winnerTeamId', p_winner_team_id,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if p_expected_version is not null and v_sub_match.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_winner := coalesce(nullif(p_winner_team_id, ''), case
    when coalesce((p_score->>'teamA')::int, 0) > coalesce((p_score->>'teamB')::int, 0) then v_matchup.team_a_id
    when coalesce((p_score->>'teamB')::int, 0) > coalesce((p_score->>'teamA')::int, 0) then v_matchup.team_b_id
    else null
  end);

  update public.team_tournament_sub_matches set
    score = p_score,
    status = 'completed',
    winner_team_id = v_winner,
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

  v_result := public.team_tournament_recompute_matchup_result(v_matchup.id);

  update public.team_tournament_matchups set
    status = case when (v_result->>'matchupCompleted')::boolean then 'completed' else 'in_progress' end,
    result = v_result - 'ok' - 'matchupCompleted',
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_matchup.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.match.confirm_sub_match', p_sub_match_id,
    jsonb_build_object('winnerTeamId', v_winner, 'score', p_score)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'winnerTeamId', v_winner,
    'version', v_sub_match.version + 1,
    'matchupResult', v_result
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

grant execute on function public.team_tournament_sub_match_score_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches
) to authenticated;

grant execute on function public.team_tournament_sub_match_referee_link_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches
) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-submatch-score-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-SUBMATCH-SCORE-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Restores pre-remediation save (4-arg, no CAS) + confirm overloads.
-- ═══════════════════════════════════════════════════════════════════

-- Drop canonical versioned save
drop function if exists public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text);

-- Restore legacy 4-arg save (no CAS / no version bump)
create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

grant execute on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb)
  to authenticated;
revoke all on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb)
  from public, anon;

-- Restore versioned confirm body (nullable expectedVersion allowed — pre-remediation)
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
set search_path to 'public'
as $function$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_cmd json;
  v_hash text;
  v_winner text;
  v_result jsonb;
  v_db jsonb;
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

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
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
  select * into v_matchup from public.team_tournament_matchups where id = v_matchup.id;
  v_db := public.team_tournament_maybe_activate_dreambreaker(v_header, v_matchup);
  select * into v_matchup from public.team_tournament_matchups where id = v_matchup.id;
  v_result := coalesce(v_matchup.result, v_result) || jsonb_build_object(
    'matchupCompleted', v_matchup.status = 'completed',
    'ok', true
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.match.confirm_sub_match', p_sub_match_id,
    jsonb_build_object('winnerTeamId', v_winner, 'score', p_score, 'dreambreaker', v_db)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'winnerTeamId', v_winner,
    'version', v_sub_match.version + 1,
    'matchupResult', v_result,
    'dreambreaker', v_db,
    'code', case
      when coalesce(v_db->>'code', '') = 'DREAMBREAKER_REQUIRED' then 'DREAMBREAKER_REQUIRED'
      else null
    end
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$function$;

-- Restore legacy 5-arg confirm wrapper (delegates with null version — pre-remediation)
create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return public.team_tournament_confirm_sub_match(
    p_tournament_id, p_matchup_id, p_sub_match_id, p_score, p_winner_team_id, null, null
  );
end;
$function$;

grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  to authenticated;
grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text)
  to authenticated;
revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  from public, anon;
revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text)
  from public, anon;

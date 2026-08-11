-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-submatch-score-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-SUBMATCH-SCORE-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Remediate sub-match score revision CAS:
--   p_expected_version = team_tournament_sub_matches.version ONLY
--   CAS BEFORE score write
--   version bump exactly once on success
--   finish_command only after successful write
--   drop versionless save + confirm overloads (no CAS bypass)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Canonical versioned SAVE DRAFT ─────────────────────────────
create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_expected_version integer,
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
  v_sub_match public.team_tournament_sub_matches;
  v_score_ops jsonb;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_new_version integer;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_expected_version is null then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_EXPECTED_VERSION',
      'error', 'p_expected_version (subMatch.version) is required.'
    );
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_IDEMPOTENCY_KEY',
      'error', 'p_idempotency_key is required.'
    );
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

  if v_matchup.status not in ('published', 'in_progress', 'completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'score', p_score,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  -- CAS BEFORE write — subMatch.version only (never tournament/matchup.version)
  if v_sub_match.version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_score_ops := public.team_tournament_sub_match_score_ops(v_header, v_matchup, v_sub_match);
  if not coalesce((v_score_ops->>'canSaveDraft')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_score_ops->>'blockCode', 'referee_v5_linked_legacy_write_blocked'),
      'error', coalesce(v_score_ops->>'blockMessage', 'Legacy draft bị khóa.')
    );
  end if;

  -- Confirmed/finalized results cannot use normal draft writer
  if v_sub_match.result_confirmed_at is not null then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION',
      'error', 'Kết quả đã xác nhận — không lưu nháp qua draft path.'
    );
  end if;
  if v_sub_match.status = 'completed' then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION',
      'error', 'Trận con đã hoàn thành — không lưu nháp qua draft path.'
    );
  end if;

  update public.team_tournament_sub_matches set
    status = 'playing',
    score = p_score,
    winner_team_id = null,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id
    and version = p_expected_version;

  if not found then
    select version into v_sub_match.version
    from public.team_tournament_sub_matches
    where id = v_sub_match.id;
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_new_version := p_expected_version + 1;

  if v_matchup.status = 'published' then
    update public.team_tournament_matchups set
      status = 'in_progress', updated_at = now(), updated_by = auth.uid()
    where id = v_matchup.id;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'version', v_new_version,
    'subMatchId', p_sub_match_id,
    'matchupId', p_matchup_id
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- Drop legacy versionless save (CAS bypass)
drop function if exists public.team_tournament_save_sub_match_draft(text, text, text, jsonb);

grant execute on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text)
  to authenticated;
revoke all on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text)
  from public, anon;

-- ─── 2. Canonical CONFIRM — require expectedVersion; keep CAS ──────
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

  if p_expected_version is null then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_EXPECTED_VERSION',
      'error', 'p_expected_version (subMatch.version) is required.'
    );
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_IDEMPOTENCY_KEY',
      'error', 'p_idempotency_key is required.'
    );
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

  -- CAS BEFORE write — subMatch.version only
  if v_sub_match.version is distinct from p_expected_version then
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
    and version = p_expected_version;

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
    'version', p_expected_version + 1,
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
$$;

-- Drop versionless confirm overload (delegated with null expectedVersion = CAS bypass)
drop function if exists public.team_tournament_confirm_sub_match(text, text, text, jsonb, text);

grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  to authenticated;
revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  from public, anon;

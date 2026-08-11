-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-dreambreaker-final-closure-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-FINAL-CLOSURE-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Additive closure only:
--   * get_setup exposes persisted rotation + resolved scoringFormat + subMatchId
--   * undo requires dreambreaker.version CAS, wraps rotation, recomputes parent/standings
--   * record_point calls standings cache after completion
-- Does not replay scoring-cas. Does not mutate the live fixture.
-- ═══════════════════════════════════════════════════════════════════

do $apply_reader$
declare
  v_def text;
  v_old text := $old$
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'status', db.status,
      'teamAOrder', db.team_a_order,
      'teamBOrder', db.team_b_order,
      'teamAScore', db.team_a_score,
      'teamBScore', db.team_b_score,
      'winnerTeamId', db.winner_team_id,
      'version', db.version,
      'ordersLockedAt', db.orders_locked_at
    )
$old$;
  v_old_rotation text := $oldrot$
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'status', db.status,
      'teamAOrder', db.team_a_order,
      'teamBOrder', db.team_b_order,
      'teamAScore', db.team_a_score,
      'teamBScore', db.team_b_score,
      'winnerTeamId', db.winner_team_id,
      'version', db.version,
      'ordersLockedAt', db.orders_locked_at,
      -- DREAMBREAKER_ROTATION_READER_01
      -- persisted rotation only: segmentIndex, pointsInSegment, pointHistory, injurySkips
      'rotation', coalesce(db.rotation, '{}'::jsonb)
    )
$oldrot$;
  v_new text := $new$
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'status', db.status,
      'teamAOrder', db.team_a_order,
      'teamBOrder', db.team_b_order,
      'teamAScore', db.team_a_score,
      'teamBScore', db.team_b_score,
      'winnerTeamId', db.winner_team_id,
      'version', db.version,
      'ordersLockedAt', db.orders_locked_at,
      -- DREAMBREAKER_FINAL_CLOSURE_01
      -- DREAMBREAKER_ROTATION_READER_01
      -- persisted rotation: segmentIndex, pointsInSegment, pointHistory, injurySkips
      'rotation', coalesce(db.rotation, '{}'::jsonb),
      'subMatchId', db.sub_match_external_id,
      'scoringFormat', jsonb_build_object(
        'targetScore', coalesce(
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetScore}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetScore}')::int end,
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetPoints}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetPoints}')::int end,
          case when (mu.schedule_meta#>>'{dreambreaker,scoringFormat,targetScore}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreaker,scoringFormat,targetScore}')::int end,
          case when (mu.schedule_meta#>>'{dreambreaker,scoringFormat,targetPoints}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreaker,scoringFormat,targetPoints}')::int end,
          (
            select coalesce(
              case when (d.scoring_format->>'targetScore') ~ '^[1-9][0-9]*$' then (d.scoring_format->>'targetScore')::int end,
              case when (d.scoring_format->>'targetPoints') ~ '^[1-9][0-9]*$' then (d.scoring_format->>'targetPoints')::int end
            )
            from public.team_tournament_disciplines d
            where d.team_tournament_id = mu.team_tournament_id
              and (
                lower(coalesce(d.discipline_kind, '')) = 'dreambreaker'
                or lower(coalesce(d.activation_rule, '')) in ('tie_at_2_2', 'dreambreaker')
                or lower(coalesce(d.name, '')) like '%dreambreaker%'
              )
            order by case
              when lower(coalesce(d.discipline_kind, '')) = 'dreambreaker' then 1
              when lower(coalesce(d.activation_rule, '')) = 'tie_at_2_2' then 2
              else 4
            end
            limit 1
          ),
          21
        ),
        'targetPoints', coalesce(
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetPoints}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetPoints}')::int end,
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetScore}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,targetScore}')::int end,
          21
        ),
        'winBy', coalesce(
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,winBy}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,winBy}')::int end,
          case when (mu.schedule_meta#>>'{dreambreaker,scoringFormat,winBy}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreaker,scoringFormat,winBy}')::int end,
          2
        ),
        'rotationPoints', coalesce(
          case when (mu.schedule_meta#>>'{dreambreakerScoringFormat,rotationPoints}') ~ '^[1-9][0-9]*$'
            then (mu.schedule_meta#>>'{dreambreakerScoringFormat,rotationPoints}')::int end,
          4
        )
      )
    )
$new$;
  v_hits int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_get_setup'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean';

  if v_def is null then
    raise exception 'APPLY_FAIL: team_tournament_get_setup definition missing';
  end if;

  if position('DREAMBREAKER_FINAL_CLOSURE_01' in v_def) > 0 then
    raise notice 'APPLY_OK: final closure reader already present';
    return;
  end if;

  v_hits := (
    length(v_def) - length(replace(v_def, v_old, ''))
  ) / length(v_old);
  if v_hits = 1 then
    execute replace(v_def, v_old, v_new);
    return;
  end if;

  v_hits := (
    length(v_def) - length(replace(v_def, v_old_rotation, ''))
  ) / length(v_old_rotation);
  if v_hits = 1 then
    execute replace(v_def, v_old_rotation, v_new);
    return;
  end if;

  raise exception 'APPLY_FAIL: expected one dreambreaker reader object to patch, found %', v_hits;
end;
$apply_reader$;

do $apply_standings$
declare
  v_def text;
  v_old text := $old$
  if v_completed then
    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
  end if;
$old$;
  v_new text := $new$
  if v_completed then
    -- DREAMBREAKER_FINAL_CLOSURE_01 standings
    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
    perform public.team_tournament_recompute_standings_cache(v_header.id);
  end if;
$new$;
  v_hits int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_record_dreambreaker_point'
    and pg_get_function_identity_arguments(p.oid) =
      'p_tournament_id text, p_matchup_id text, p_scoring_team_id text, p_expected_version integer, p_idempotency_key text';

  if v_def is null then
    raise exception 'APPLY_FAIL: record_dreambreaker_point missing';
  end if;

  if position('DREAMBREAKER_FINAL_CLOSURE_01 standings' in v_def) > 0 then
    raise notice 'APPLY_OK: standings-on-complete already present';
    return;
  end if;

  v_hits := (
    length(v_def) - length(replace(v_def, v_old, ''))
  ) / length(v_old);
  if v_hits <> 1 then
    raise exception 'APPLY_FAIL: expected one completion recompute block, found %', v_hits;
  end if;

  execute replace(v_def, v_old, v_new);
end;
$apply_standings$;

create or replace function public.team_tournament_undo_dreambreaker_point(
  p_tournament_id text,
  p_matchup_id text,
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
  v_db public.team_tournament_dreambreaker_states;
  v_updated public.team_tournament_dreambreaker_states;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_hist jsonb;
  v_last jsonb;
  v_a int := 0;
  v_b int := 0;
  v_seg int := 0;
  v_pts int := 0;
  v_rot int := 4;
  v_len int;
begin
  -- DREAMBREAKER_FINAL_CLOSURE_01
  -- DREAMBREAKER_UNDO_CAS_ATOMIC
  -- DREAMBREAKER_UNDO_PARENT_RECOMPUTE
  -- DREAMBREAKER_UNDO_ROTATION_WRAP
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
  from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  select * into v_db
  from public.team_tournament_dreambreaker_states
  where matchup_id = v_matchup.id;
  if v_db.id is null then
    return json_build_object('ok', false, 'code', 'NOT_ACTIVATED');
  end if;
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu expectedVersion.');
  end if;
  v_hist := coalesce(v_db.rotation->'pointHistory', '[]'::jsonb);
  v_len := jsonb_array_length(v_hist);
  if v_len = 0 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Không có điểm để hoàn tác.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'undo_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then
    return v_cmd;
  end if;
  if (v_cmd->>'replay')::boolean then
    return v_cmd->'result';
  end if;
  v_hash := v_cmd->>'payload_hash';

  v_rot := coalesce(
    case when (v_matchup.schedule_meta#>>'{dreambreakerScoringFormat,rotationPoints}') ~ '^[1-9][0-9]*$'
      then (v_matchup.schedule_meta#>>'{dreambreakerScoringFormat,rotationPoints}')::int end,
    4
  );

  v_hist := v_hist - (v_len - 1);
  if jsonb_array_length(v_hist) > 0 then
    v_last := v_hist -> (jsonb_array_length(v_hist) - 1);
    v_a := coalesce((v_last->>'teamAScore')::int, 0);
    v_b := coalesce((v_last->>'teamBScore')::int, 0);
    v_seg := coalesce((v_last->>'segmentIndex')::int, 0);
    select count(*)::int into v_pts
    from jsonb_array_elements(v_hist) e
    where (e->>'segmentIndex')::int = v_seg;
    if v_pts >= v_rot then
      v_seg := v_seg + 1;
      v_pts := 0;
    end if;
  end if;

  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a,
    team_b_score = v_b,
    winner_team_id = null,
    status = 'in_progress',
    rotation = jsonb_build_object(
      'segmentIndex', v_seg,
      'pointsInSegment', v_pts,
      'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_db.id
    and version = p_expected_version
  returning * into v_updated;

  if v_updated.id is null then
    select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states', p_expected_version, v_db.version
    );
  end if;
  v_db := v_updated;

  if v_db.sub_match_external_id is not null then
    update public.team_tournament_sub_matches set
      score = jsonb_build_object('teamA', v_a, 'teamB', v_b, 'games', '[]'::jsonb),
      status = 'playing',
      winner_team_id = null,
      result_confirmed_at = null,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    where matchup_id = v_matchup.id
      and external_sub_match_id = v_db.sub_match_external_id;
  end if;

  perform public.team_tournament_recompute_matchup_result(v_matchup.id);
  perform public.team_tournament_recompute_standings_cache(v_header.id);

  v_result := jsonb_build_object(
    'ok', true,
    'version', v_db.version,
    'teamAScore', v_a,
    'teamBScore', v_b,
    'status', v_db.status,
    'rotation', v_db.rotation
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'undo_dreambreaker_point', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$function$;

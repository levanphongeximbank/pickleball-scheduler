-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-dreambreaker-rotation-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01
-- Restores get_setup dreambreaker reader without rotation.
-- DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

do $rollback$
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
      'ordersLockedAt', db.orders_locked_at,
      -- DREAMBREAKER_ROTATION_READER_01
      -- persisted rotation only: segmentIndex, pointsInSegment, pointHistory, injurySkips
      'rotation', coalesce(db.rotation, '{}'::jsonb)
    )
$old$;
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
      'ordersLockedAt', db.orders_locked_at
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
    raise exception 'ROLLBACK_FAIL: team_tournament_get_setup definition missing';
  end if;

  if position('DREAMBREAKER_ROTATION_READER_01' in v_def) = 0 then
    raise notice 'ROLLBACK_OK: rotation reader already absent';
    return;
  end if;

  v_hits := (
    length(v_def) - length(replace(v_def, v_old, ''))
  ) / length(v_old);

  if v_hits <> 1 then
    raise exception 'ROLLBACK_FAIL: expected exactly one patched dreambreaker object, found %', v_hits;
  end if;

  execute replace(v_def, v_old, v_new);
end;
$rollback$;

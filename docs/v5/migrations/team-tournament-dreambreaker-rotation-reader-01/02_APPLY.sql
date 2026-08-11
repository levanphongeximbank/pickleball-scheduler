-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-dreambreaker-rotation-reader-01
-- Workstream: TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Hardens public.team_tournament_get_setup only:
--   * DREAMBREAKER_ROTATION_READER_01
--     expose persisted dreambreaker_states.rotation on the v7
--     tournament.dreambreaker[matchupId] reader object
--   * no point RPC change
--   * no rotation recomputation
-- Signature, grants, RLS, RBAC, tenant assert unchanged.
-- ═══════════════════════════════════════════════════════════════════

do $apply$
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
      -- DREAMBREAKER_ROTATION_READER_01
      -- persisted rotation only: segmentIndex, pointsInSegment, pointHistory, injurySkips
      'rotation', coalesce(db.rotation, '{}'::jsonb)
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

  if position('DREAMBREAKER_ROTATION_READER_01' in v_def) > 0
     or position('''rotation'', coalesce(db.rotation' in v_def) > 0 then
    raise notice 'APPLY_OK: rotation reader already present';
    return;
  end if;

  v_hits := (
    length(v_def) - length(replace(v_def, v_old, ''))
  ) / length(v_old);

  if v_hits <> 1 then
    raise exception 'APPLY_FAIL: expected exactly one dreambreaker reader object, found %', v_hits;
  end if;

  execute replace(v_def, v_old, v_new);
end;
$apply$;

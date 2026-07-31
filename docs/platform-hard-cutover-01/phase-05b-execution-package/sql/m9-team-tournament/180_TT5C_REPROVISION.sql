-- Phase TT-5C — Reprovision / snapshot stale detection (Staging only)
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- 1. Snapshot stale check
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_referee_snapshot_stale(
  p_link public.team_sub_match_referee_links,
  p_matchup public.team_tournament_matchups
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_snap_a int;
  v_snap_b int;
  v_snap_matchup int;
  v_snap_sub int;
begin
  if p_link.id is null then
    return jsonb_build_object('stale', false);
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_b_id;

  v_snap_a := coalesce((p_link.snapshot->>'lineupAVersion')::int, 0);
  v_snap_b := coalesce((p_link.snapshot->>'lineupBVersion')::int, 0);
  v_snap_matchup := coalesce((p_link.snapshot->>'matchupVersion')::int, 0);
  v_snap_sub := coalesce((p_link.snapshot->>'subMatchVersion')::int, 0);

  if coalesce(p_matchup.requires_republish, false) then
    return jsonb_build_object(
      'stale', true,
      'reason', 'requires_republish',
      'blockCode', 'reprovision_required'
    );
  end if;

  if v_lineup_a.version <> v_snap_a or v_lineup_b.version <> v_snap_b then
    return jsonb_build_object(
      'stale', true,
      'reason', 'lineup_version_changed',
      'blockCode', 'reprovision_required',
      'currentLineupAVersion', v_lineup_a.version,
      'currentLineupBVersion', v_lineup_b.version,
      'snapshotLineupAVersion', v_snap_a,
      'snapshotLineupBVersion', v_snap_b
    );
  end if;

  if p_matchup.version <> v_snap_matchup then
    return jsonb_build_object(
      'stale', true,
      'reason', 'matchup_version_changed',
      'blockCode', 'reprovision_required'
    );
  end if;

  return jsonb_build_object('stale', false);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Patch referee_link_ops — expose resync + effective stale status
-- ═══════════════════════════════════════════════════════════════════
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
  v_stale jsonb;
  v_can_manage boolean := public.team_tournament_can_manage();
  v_effective_status text;
begin
  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is not null then
    v_stale := public.team_tournament_referee_snapshot_stale(v_link, p_matchup);
    v_effective_status := case
      when coalesce((v_stale->>'stale')::boolean, false) then 'reprovision_required'
      else v_link.status
    end;

    return jsonb_build_object(
      'hasLink', true,
      'linkId', v_link.id,
      'status', v_effective_status,
      'dbStatus', v_link.status,
      'refereeMatchId', v_link.referee_match_id,
      'refereeAssignmentId', v_link.referee_assignment_id,
      'provisionedAt', v_link.provisioned_at,
      'route', '/referee/match/' || v_link.referee_match_id,
      'canProvision', false,
      'canRevoke', v_can_manage and v_link.status in ('provisioned', 'assigned') and not coalesce((v_stale->>'stale')::boolean, false),
      'canOpenWorkspace', v_effective_status in ('provisioned', 'assigned', 'active', 'finalized') and not coalesce((v_stale->>'stale')::boolean, false),
      'canResync', v_can_manage and coalesce((v_stale->>'stale')::boolean, false) and v_link.status not in ('active', 'finalized'),
      'snapshotStale', coalesce((v_stale->>'stale')::boolean, false),
      'staleReason', v_stale->>'reason',
      'blockCode', case when coalesce((v_stale->>'stale')::boolean, false) then 'reprovision_required' else null end,
      'blockMessage', case when coalesce((v_stale->>'stale')::boolean, false) then 'Lineup đã thay đổi — cần resync/reprovision trước khi tiếp tục.' else null end,
      'version', v_link.version,
      'snapshot', v_link.snapshot,
      'lastResultRevisionId', v_link.last_result_revision_id
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
    'canResync', false,
    'suggestedAssignmentId', (
      select a.id
      from public.referee_assignments a
      where a.tenant_id = p_header.tenant_id
        and a.tournament_id = p_header.tournament_id
        and a.match_id = p_sub_match.external_sub_match_id
        and a.status = 'active'
      order by a.created_at desc
      limit 1
    ),
    'blockCode', v_elig->>'blockCode',
    'blockMessage', v_elig->>'blockMessage',
    'eligibility', v_elig
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Resync / reprovision snapshot (BTC manage)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_resync_referee_link(
  p_tournament_id text,
  p_sub_match_id text,
  p_expected_link_version integer default null,
  p_reason text default 'tt5c_resync'
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
  v_link public.team_sub_match_referee_links;
  v_stale jsonb;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_state_id text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select m.* into v_matchup
  from public.team_tournament_matchups m
  join public.team_tournament_sub_matches sm on sm.matchup_id = m.id
  where m.team_tournament_id = v_header.id
    and sm.external_sub_match_id = p_sub_match_id;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = v_sub_match.id and l.status <> 'revoked';

  if v_link.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_link_version is not null and v_link.version <> p_expected_link_version then
    return public.team_tournament_version_conflict('team_sub_match_referee_links', p_expected_link_version, v_link.version);
  end if;

  if v_link.status in ('active', 'finalized') then
    return json_build_object('ok', false, 'code', 'resync_blocked_active_or_finalized');
  end if;

  v_stale := public.team_tournament_referee_snapshot_stale(v_link, v_matchup);
  if not coalesce((v_stale->>'stale')::boolean, false) and v_link.status <> 'reprovision_required' then
    return json_build_object('ok', false, 'code', 'resync_not_required');
  end if;

  if coalesce(v_matchup.requires_republish, false) then
    return json_build_object('ok', false, 'code', 'requires_republish');
  end if;

  select * into v_lineup_a from public.team_tournament_lineups where matchup_id = v_matchup.id and team_external_id = v_matchup.team_a_id;
  select * into v_lineup_b from public.team_tournament_lineups where matchup_id = v_matchup.id and team_external_id = v_matchup.team_b_id;

  if v_lineup_a.status <> 'published' or v_lineup_b.status <> 'published' then
    return json_build_object('ok', false, 'code', 'lineup_not_published');
  end if;

  v_state_id := public.referee_v5_match_state_id(v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id);

  if exists (
    select 1 from public.match_live_states mls
    where mls.id = v_state_id and coalesce(mls.last_event_sequence, 0) > 0
  ) then
    return json_build_object('ok', false, 'code', 'referee_match_already_active');
  end if;

  update public.team_sub_match_referee_links set
    status = 'provisioned',
    snapshot = jsonb_build_object(
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'matchupVersion', v_matchup.version,
      'subMatchVersion', v_sub_match.version,
      'disciplineId', v_sub_match.discipline_external_id,
      'resyncReason', p_reason,
      'resyncedAt', v_now
    ),
    version = version + 1,
    updated_at = v_now
  where id = v_link.id
  returning * into v_link;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.resync', p_sub_match_id,
    jsonb_build_object('linkId', v_link.id, 'reason', p_reason)
  );

  return json_build_object(
    'ok', true,
    'linkId', v_link.id,
    'status', v_link.status,
    'version', v_link.version,
    'route', '/referee/match/' || v_link.referee_match_id
  );
end;
$$;

grant execute on function public.team_tournament_resync_referee_link(text, text, integer, text) to authenticated;
grant execute on function public.team_tournament_referee_snapshot_stale(
  public.team_sub_match_referee_links, public.team_tournament_matchups
) to authenticated;

-- Patch score_ops to block when snapshot stale (effective reprovision_required)
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
  v_stale jsonb;
  v_can_results boolean := public.team_tournament_can_manage_results();
  v_can_manage boolean := public.team_tournament_can_manage();
begin
  if p_sub_match.id is null then
    return jsonb_build_object('canSaveDraft', false, 'canConfirm', false, 'blockCode', 'NOT_FOUND');
  end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id and l.status <> 'revoked'
  limit 1;

  if v_link.id is not null then
    v_stale := public.team_tournament_referee_snapshot_stale(v_link, p_matchup);
    if coalesce((v_stale->>'stale')::boolean, false) then
      return jsonb_build_object(
        'canSaveDraft', false,
        'canConfirm', false,
        'blockCode', 'reprovision_required',
        'blockMessage', 'Lineup đã thay đổi — cần resync trước khi tiếp tục.',
        'linkId', v_link.id,
        'linkStatus', 'reprovision_required',
        'refereeMatchId', v_link.referee_match_id,
        'refereeRoute', '/referee/match/' || v_link.referee_match_id,
        'subMatchVersion', p_sub_match.version
      );
    end if;
  end if;

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
    return jsonb_build_object('canSaveDraft', false, 'canConfirm', false, 'blockCode', 'FORBIDDEN', 'subMatchVersion', p_sub_match.version);
  end if;

  if p_sub_match.result_confirmed_at is not null and p_sub_match.status = 'completed' then
    return jsonb_build_object('canSaveDraft', false, 'canConfirm', false, 'blockCode', 'result_already_confirmed', 'subMatchVersion', p_sub_match.version);
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

grant execute on function public.team_tournament_sub_match_referee_link_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches
) to authenticated;

grant execute on function public.team_tournament_sub_match_score_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches
) to authenticated;

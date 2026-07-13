-- Phase TT-5C — Apply Referee V5 official result to Team Tournament (Staging only)
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- 1. Map V5 revision → TT sub-match update payload
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_map_referee_v5_result(
  p_revision public.match_result_revisions,
  p_matchup public.team_tournament_matchups
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_score jsonb;
  v_winner text;
  v_status text;
  v_reopened boolean := false;
begin
  if p_revision.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_reopened := lower(coalesce(p_revision.status, '')) in ('cancelled', 'void');

  v_score := jsonb_build_object(
    'teamA', coalesce((p_revision.final_score->>'teamA')::int, 0),
    'teamB', coalesce((p_revision.final_score->>'teamB')::int, 0),
    'games', coalesce(p_revision.games, '[]'::jsonb)
  );

  v_winner := nullif(trim(coalesce(p_revision.winner_team_id, '')), '');

  if v_winner is not null
     and v_winner not in (p_matchup.team_a_id, p_matchup.team_b_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'winner_team_mismatch',
      'error', 'winner_team_id không khớp lineup snapshot.'
    );
  end if;

  if v_reopened then
    v_status := 'waiting';
    v_winner := null;
    v_score := jsonb_build_object('teamA', 0, 'teamB', 0, 'games', '[]'::jsonb);
  else
    v_status := 'completed';
    if v_winner is null then
      if coalesce((v_score->>'teamA')::int, 0) > coalesce((v_score->>'teamB')::int, 0) then
        v_winner := p_matchup.team_a_id;
      elsif coalesce((v_score->>'teamB')::int, 0) > coalesce((v_score->>'teamA')::int, 0) then
        v_winner := p_matchup.team_b_id;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'score', v_score,
    'winnerTeamId', v_winner,
    'status', v_status,
    'resultType', case when v_reopened then 'reopened' else 'normal' end,
    'source', 'referee_v5',
    'confirmedAt', coalesce(p_revision.finalized_at, p_revision.confirmed_at, now()),
    'revisionId', p_revision.id,
    'revisionNumber', p_revision.revision,
    'reopened', v_reopened
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Core apply (atomic sub-match + bridge + matchup + standings)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_apply_referee_v5_result(
  p_outbox public.match_integration_outbox,
  p_revision public.match_result_revisions,
  p_link public.team_sub_match_referee_links,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches,
  p_header public.team_tournaments,
  p_payload_hash text,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_mapped jsonb;
  v_matchup_result jsonb;
  v_inbox public.team_tournament_referee_event_inbox;
  v_existing_inbox public.team_tournament_referee_event_inbox;
  v_event_type text;
  v_before jsonb;
  v_after jsonb;
  v_applied_revision int;
begin
  if p_outbox.id is null or p_revision.id is null or p_link.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_existing_inbox
  from public.team_tournament_referee_event_inbox i
  where i.outbox_event_id = p_outbox.id;

  if v_existing_inbox.id is not null then
    if v_existing_inbox.payload_hash <> p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'payload_mismatch', 'inboxId', v_existing_inbox.id);
    end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'inboxId', v_existing_inbox.id,
      'subMatchId', p_sub_match.external_sub_match_id,
      'revisionId', v_existing_inbox.result_revision_id
    );
  end if;

  if p_link.last_result_revision_id is not null
     and p_link.last_result_revision_id = p_revision.id then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'code', 'revision_already_applied',
      'revisionId', p_revision.id
    );
  end if;

  if p_link.last_result_revision_id is not null then
    select r.revision into v_applied_revision
    from public.match_result_revisions r
    where r.id = p_link.last_result_revision_id;
    if coalesce(v_applied_revision, 0) > p_revision.revision then
      return jsonb_build_object(
        'ok', false,
        'code', 'stale_revision',
        'appliedRevision', v_applied_revision,
        'incomingRevision', p_revision.revision
      );
    end if;
  end if;

  v_mapped := public.team_tournament_map_referee_v5_result(p_revision, p_matchup);
  if not coalesce((v_mapped->>'ok')::boolean, false) then
    return v_mapped;
  end if;

  v_event_type := public.team_tournament_referee_normalize_event_type(
    p_outbox.event_type,
    p_revision.status
  );

  v_before := jsonb_build_object(
    'status', p_sub_match.status,
    'score', p_sub_match.score,
    'winnerTeamId', p_sub_match.winner_team_id,
    'resultConfirmedAt', p_sub_match.result_confirmed_at,
    'version', p_sub_match.version
  );

  if coalesce((v_mapped->>'reopened')::boolean, false) then
    update public.team_tournament_sub_matches set
      score = v_mapped->'score',
      status = 'waiting',
      winner_team_id = null,
      result_confirmed_at = null,
      version = version + 1,
      updated_at = now()
    where id = p_sub_match.id;
  else
    update public.team_tournament_sub_matches set
      score = v_mapped->'score',
      status = 'completed',
      winner_team_id = v_mapped->>'winnerTeamId',
      result_confirmed_at = coalesce((v_mapped->>'confirmedAt')::timestamptz, now()),
      version = version + 1,
      updated_at = now()
    where id = p_sub_match.id;
  end if;

  v_matchup_result := public.team_tournament_recompute_matchup_result(p_matchup.id);

  update public.team_tournament_matchups set
    status = case when (v_matchup_result->>'matchupCompleted')::boolean then 'completed' else 'in_progress' end,
    result = v_matchup_result - 'ok' - 'matchupCompleted',
    updated_at = now()
  where id = p_matchup.id;

  perform public.team_tournament_recompute_standings_cache(p_header.id);

  update public.team_sub_match_referee_links set
    status = case
      when coalesce((v_mapped->>'reopened')::boolean, false) then 'active'
      else 'finalized'
    end,
    last_result_revision_id = p_revision.id,
    last_outbox_event_id = p_outbox.id,
    locked_at = case when coalesce((v_mapped->>'reopened')::boolean, false) then null else coalesce(locked_at, now()) end,
    version = version + 1,
    updated_at = now()
  where id = p_link.id;

  select jsonb_build_object(
    'status', sm.status,
    'score', sm.score,
    'winnerTeamId', sm.winner_team_id,
    'resultConfirmedAt', sm.result_confirmed_at,
    'version', sm.version
  ) into v_after
  from public.team_tournament_sub_matches sm
  where sm.id = p_sub_match.id;

  perform public.team_tournament_write_audit(
    p_header.tenant_id,
    p_header.tournament_id,
    case when coalesce((v_mapped->>'reopened')::boolean, false)
      then 'team.referee_v5.result_reopened'
      else 'team.referee_v5.result_applied'
    end,
    p_sub_match.external_sub_match_id,
    jsonb_build_object(
      'before', v_before,
      'after', v_after,
      'revisionId', p_revision.id,
      'revisionNumber', p_revision.revision,
      'outboxEventId', p_outbox.id,
      'eventType', v_event_type,
      'source', 'referee_v5'
    )
  );

  insert into public.team_tournament_referee_event_inbox (
    outbox_event_id, event_type, tenant_id, tournament_id,
    matchup_id, sub_match_id, external_sub_match_id, referee_match_id,
    result_revision_id, result_version, payload_hash, payload,
    source, correlation_id, status
  ) values (
    p_outbox.id,
    v_event_type,
    p_outbox.tenant_id,
    p_outbox.tournament_id,
    p_matchup.id,
    p_sub_match.id,
    p_sub_match.external_sub_match_id,
    p_link.referee_match_id,
    p_revision.id,
    p_revision.revision,
    p_payload_hash,
    coalesce(p_outbox.payload, '{}'::jsonb),
    'referee_v5',
    p_correlation_id,
    'processed'
  )
  returning * into v_inbox;

  update public.match_integration_outbox set
    status = 'completed',
    processed_at = now()
  where id = p_outbox.id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'inboxId', v_inbox.id,
    'eventType', v_event_type,
    'subMatchId', p_sub_match.external_sub_match_id,
    'revisionId', p_revision.id,
    'revisionNumber', p_revision.revision,
    'bridgeStatus', case when coalesce((v_mapped->>'reopened')::boolean, false) then 'active' else 'finalized' end,
    'matchupResult', v_matchup_result,
    'before', v_before,
    'after', v_after
  );
exception when others then
  update public.team_sub_match_referee_links set
    status = 'sync_error',
    version = version + 1,
    updated_at = now()
  where id = p_link.id;

  update public.match_integration_outbox set
    status = 'failed',
    processed_at = now()
  where id = p_outbox.id;

  return jsonb_build_object('ok', false, 'code', 'consumer_failed', 'error', SQLERRM);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Consume single outbox row (service_role)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_consume_referee_v5_outbox(
  p_outbox_id uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox public.match_integration_outbox;
  v_revision public.match_result_revisions;
  v_link public.team_sub_match_referee_links;
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_payload_hash text;
begin
  select * into v_outbox
  from public.match_integration_outbox o
  where o.id = p_outbox_id
  for update;

  if v_outbox.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_outbox.tenant_id is null or v_outbox.match_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_OUTBOX');
  end if;

  if not public.team_tournament_referee_outbox_is_consumable(v_outbox.event_type) then
    return jsonb_build_object('ok', false, 'code', 'EVENT_NOT_CONSUMABLE', 'eventType', v_outbox.event_type);
  end if;

  if v_outbox.status = 'completed' then
    return jsonb_build_object('ok', true, 'replayed', true, 'code', 'OUTBOX_ALREADY_COMPLETED');
  end if;

  v_payload_hash := public.team_tournament_referee_event_payload_hash(v_outbox.payload);

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.tenant_id = v_outbox.tenant_id
    and l.referee_match_id = v_outbox.match_id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is null then
    update public.match_integration_outbox set status = 'failed', processed_at = now() where id = v_outbox.id;
    return jsonb_build_object('ok', false, 'code', 'bridge_missing');
  end if;

  if v_link.status = 'reprovision_required' then
    return jsonb_build_object('ok', false, 'code', 'reprovision_required');
  end if;

  select * into v_header
  from public.team_tournaments t
  where t.id = v_link.team_tournament_id;

  if v_header.tenant_id <> v_outbox.tenant_id
     or v_header.tournament_id <> v_outbox.tournament_id then
    return jsonb_build_object('ok', false, 'code', 'cross_tenant_denied');
  end if;

  select * into v_matchup from public.team_tournament_matchups where id = v_link.matchup_id;
  select * into v_sub_match from public.team_tournament_sub_matches where id = v_link.sub_match_id;

  select * into v_revision
  from public.match_result_revisions r
  where r.tenant_id = v_outbox.tenant_id
    and r.tournament_id = v_outbox.tournament_id
    and r.match_id = v_outbox.match_id
  order by r.revision desc, r.finalized_at desc nulls last, r.created_at desc
  limit 1;

  if v_revision.id is null then
    update public.match_integration_outbox set status = 'failed', processed_at = now() where id = v_outbox.id;
    return jsonb_build_object('ok', false, 'code', 'revision_missing');
  end if;

  update public.match_integration_outbox set status = 'processing' where id = v_outbox.id;

  return public.team_tournament_apply_referee_v5_result(
    v_outbox,
    v_revision,
    v_link,
    v_matchup,
    v_sub_match,
    v_header,
    v_payload_hash,
    p_correlation_id
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Drain pending outbox (service_role batch worker)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_drain_referee_v5_outbox(
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_count int := 0;
begin
  for v_row in
    select o.id
    from public.match_integration_outbox o
    where o.status = 'pending'
      and public.team_tournament_referee_outbox_is_consumable(o.event_type)
    order by o.created_at
    limit greatest(coalesce(p_limit, 10), 1)
    for update skip locked
  loop
    v_result := public.team_tournament_consume_referee_v5_outbox(v_row.id, 'drain_worker');
    v_results := v_results || jsonb_build_array(jsonb_build_object('outboxId', v_row.id, 'result', v_result));
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'processed', v_count, 'results', v_results);
end;
$$;

revoke all on function public.team_tournament_consume_referee_v5_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.team_tournament_consume_referee_v5_outbox(uuid, text) to service_role;

revoke all on function public.team_tournament_drain_referee_v5_outbox(integer) from public, anon, authenticated;
grant execute on function public.team_tournament_drain_referee_v5_outbox(integer) to service_role;

grant execute on function public.team_tournament_map_referee_v5_result(
  public.match_result_revisions, public.team_tournament_matchups
) to authenticated;

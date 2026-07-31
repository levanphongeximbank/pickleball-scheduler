-- Phase TT-5D — Reopen + admin revision producer (Staging only)
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- Internal: apply admin revision (correction / reopen) — service_role + definer
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.referee_v5_apply_admin_result_revision(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_actor_id uuid,
  p_revision_status text,
  p_proposed_score jsonb,
  p_proposed_winner text,
  p_reason text,
  p_idempotency_key text,
  p_expected_result_revision_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
  v_current public.match_result_revisions;
  v_next_revision int;
  v_revision_id uuid;
  v_outbox_id uuid;
  v_status text := lower(coalesce(p_revision_status, 'overridden'));
  v_finalize_key text;
  v_cached public.match_sync_mutations%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  end if;

  if v_status not in ('overridden', 'void', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REVISION_STATUS');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);
  v_finalize_key := 'admin_revision::' || p_idempotency_key;

  select * into v_cached
  from public.match_sync_mutations
  where match_state_id = v_match_state_id
    and idempotency_key = v_finalize_key;

  if found and v_cached.response_payload is not null then
    return v_cached.response_payload || jsonb_build_object('duplicate', true);
  end if;

  select * into v_current
  from public.match_result_revisions r
  where r.tenant_id = p_tenant_id
    and r.tournament_id = p_tournament_id
    and r.match_id = p_match_id
  order by r.revision desc
  limit 1
  for update;

  if v_current.id is null then
    return jsonb_build_object('ok', false, 'code', 'REVISION_NOT_FOUND');
  end if;

  if p_expected_result_revision_id is not null and v_current.id <> p_expected_result_revision_id then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'currentRevisionId', v_current.id);
  end if;

  v_next_revision := coalesce(v_current.revision, 0) + 1;

  select * into v_live
  from public.match_live_states
  where id = v_match_state_id
  for update;

  insert into public.match_result_revisions (
    tenant_id, tournament_id, match_id, revision, status,
    team_a_id, team_b_id, winner_team_id, final_score,
    idempotency_key, override_reason, supersedes_revision,
    created_by, finalized_by, confirmed_at
  ) values (
    p_tenant_id, p_tournament_id, p_match_id, v_next_revision, v_status,
    v_current.team_a_id, v_current.team_b_id,
    case when v_status in ('void', 'cancelled') then null else p_proposed_winner end,
    case when v_status in ('void', 'cancelled') then '{}'::jsonb else coalesce(p_proposed_score, v_current.final_score) end,
    p_idempotency_key, p_reason, v_current.revision,
    p_actor_id, p_actor_id, now()
  )
  returning id into v_revision_id;

  if v_status in ('void', 'cancelled') then
    update public.match_live_states set
      status = 'in_progress',
      locked_at = null,
      locked_by = null,
      updated_at = now()
    where id = v_match_state_id;
  else
    update public.match_live_states set
      status = 'locked',
      locked_at = now(),
      locked_by = p_actor_id,
      updated_at = now()
    where id = v_match_state_id;
  end if;

  insert into public.match_integration_outbox (
    tenant_id, tournament_id, match_id, match_state_id,
    event_type, payload, idempotency_key
  ) values (
    p_tenant_id, p_tournament_id, p_match_id, v_match_state_id,
    'STANDINGS_RECALC_REQUESTED',
    jsonb_build_object(
      'matchId', p_match_id,
      'revision', v_next_revision,
      'revisionId', v_revision_id,
      'status', v_status,
      'source', 'tt5d_admin_revision'
    ),
    v_finalize_key || '::standings'
  )
  returning id into v_outbox_id;

  insert into public.match_sync_mutations (
    tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
    mutation_type, response_payload, status, completed_at
  ) values (
    p_tenant_id, v_match_state_id, p_match_id, p_idempotency_key, v_finalize_key,
    'ADMIN_REVISION',
    jsonb_build_object(
      'ok', true,
      'revisionId', v_revision_id,
      'revision', v_next_revision,
      'outboxId', v_outbox_id,
      'status', v_status
    ),
    'applied', now()
  )
  on conflict (match_state_id, idempotency_key) do nothing;

  perform public.team_tournament_write_audit(
    p_tenant_id, p_tournament_id,
    case when v_status in ('void', 'cancelled')
      then 'team.referee_v5.match_reopened'
      else 'team.referee_v5.revision_propagated'
    end,
    p_match_id,
    jsonb_build_object(
      'revisionId', v_revision_id,
      'revision', v_next_revision,
      'status', v_status,
      'outboxId', v_outbox_id,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'ok', true,
    'revisionId', v_revision_id,
    'revision', v_next_revision,
    'outboxId', v_outbox_id,
    'status', v_status
  );
exception when others then
  return jsonb_build_object('ok', false, 'code', 'ADMIN_REVISION_FAILED', 'error', SQLERRM);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- BTC: reopen match (void revision + TT consumer)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_reopen_referee_match(
  p_tournament_id text,
  p_sub_match_id text,
  p_reason text,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_link public.team_sub_match_referee_links;
  v_apply jsonb;
  v_consume jsonb;
  v_outbox_id uuid;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'code', 'REOPEN_REASON_REQUIRED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'reopen_referee_match', p_idempotency_key,
    jsonb_build_object('subMatchId', p_sub_match_id, 'reason', p_reason)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  join public.team_tournament_sub_matches sm on sm.id = l.sub_match_id
  where l.tenant_id = v_header.tenant_id
    and l.tournament_id = v_header.tournament_id
    and sm.external_sub_match_id = p_sub_match_id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is null then
    return json_build_object('ok', false, 'code', 'bridge_not_found');
  end if;

  v_apply := public.referee_v5_apply_admin_result_revision(
    v_header.tenant_id,
    v_header.tournament_id,
    v_link.external_sub_match_id,
    auth.uid(),
    'void',
    '{}'::jsonb,
    null,
    p_reason,
    coalesce(p_idempotency_key, 'reopen::' || p_sub_match_id),
    v_link.last_result_revision_id
  );

  if not coalesce((v_apply->>'ok')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_apply->>'code', 'reopen_failed'),
      'detail', v_apply
    );
  end if;

  v_outbox_id := (v_apply->>'outboxId')::uuid;
  if v_outbox_id is not null then
    v_consume := public.team_tournament_consume_referee_v5_outbox(v_outbox_id, 'reopen_' || p_sub_match_id);
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.result_reopened', p_sub_match_id,
    jsonb_build_object(
      'linkId', v_link.id,
      'revisionId', v_apply->>'revisionId',
      'propagation', v_consume
    )
  );

  return json_build_object(
    'ok', true,
    'subMatchId', p_sub_match_id,
    'revisionId', v_apply->>'revisionId',
    'outboxId', v_outbox_id,
    'propagation', v_consume,
    'linkStatus', 'active'
  );
end;
$$;

revoke all on function public.referee_v5_apply_admin_result_revision(
  text, text, text, uuid, text, jsonb, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.referee_v5_apply_admin_result_revision(
  text, text, text, uuid, text, jsonb, text, text, text, uuid
) to service_role;

revoke all on function public.team_tournament_reopen_referee_match(text, text, text, text) from public, anon;
grant execute on function public.team_tournament_reopen_referee_match(text, text, text, text) to authenticated;

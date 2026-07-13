-- Phase V5-D.4 — Finalize atomic rollback fault injection (STAGING ONLY)
-- Prerequisite: V5A + V5D + V5D1 + V5D3.2 on staging
-- Fault values (test namespace REFEREE_V5_TEST_* only):
--   after_result_revision — after INSERT match_result_revisions
--   after_state_lock      — after UPDATE match_live_states lock
--   after_outbox          — after outbox inserts, before idempotency row

begin;

drop function if exists public.referee_v5_commit_match_finalization(
  text, text, text, uuid, integer, text, text, jsonb, jsonb, text
);

create or replace function public.referee_v5_commit_match_finalization(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_actor_id uuid,
  p_expected_state_version integer,
  p_idempotency_key text,
  p_request_hash text,
  p_revision jsonb,
  p_outbox_events jsonb default '[]'::jsonb,
  p_override_reason text default null,
  p_staging_fault text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
  v_finalize_key text;
  v_cached public.match_sync_mutations%rowtype;
  v_outbox jsonb;
  v_item jsonb;
begin
  if p_staging_fault is not null and p_match_id not like 'REFEREE_V5_TEST_%' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION_FAILED', 'error', 'fault_test_scope');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);
  v_finalize_key := 'finalize::' || p_idempotency_key;

  select * into v_cached
  from public.match_sync_mutations
  where match_state_id = v_match_state_id
    and idempotency_key = v_finalize_key;

  if found and v_cached.request_hash is not null and v_cached.request_hash <> p_request_hash then
    return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSE_MISMATCH');
  end if;

  if found and v_cached.response_payload is not null then
    return v_cached.response_payload || jsonb_build_object('duplicate', true);
  end if;

  select * into v_live
  from public.match_live_states
  where id = v_match_state_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  end if;

  if p_expected_state_version <> coalesce(v_live.state_version, v_live.version, 0) then
    return jsonb_build_object('ok', false, 'code', 'MATCH_STATE_CONFLICT');
  end if;

  if v_live.status = 'locked' then
    return jsonb_build_object('ok', false, 'code', 'MATCH_LOCKED');
  end if;

  if p_override_reason is null and (p_revision->>'status') = 'OVERRIDDEN' then
    return jsonb_build_object('ok', false, 'code', 'OVERRIDE_REASON_REQUIRED');
  end if;

  insert into public.match_result_revisions (
    tenant_id, tournament_id, match_id, revision, status,
    team_a_id, team_b_id, winner_team_id, final_score, idempotency_key, override_reason,
    created_by, finalized_by
  ) values (
    p_tenant_id, p_tournament_id, p_match_id,
    coalesce((p_revision->>'revision')::integer, 1),
    lower(coalesce(p_revision->>'status', 'confirmed')),
    coalesce(p_revision->>'teamAId', v_live.team_a_id),
    coalesce(p_revision->>'teamBId', v_live.team_b_id),
    p_revision->>'winnerId',
    coalesce(p_revision->'officialScore', '{}'::jsonb),
    p_idempotency_key, p_override_reason,
    p_actor_id, p_actor_id
  );

  if p_staging_fault = 'after_result_revision' then
    raise exception 'STAGING_FAULT_AFTER_RESULT_REVISION';
  end if;

  update public.match_live_states
  set status = 'locked', locked_at = now(), locked_by = p_actor_id, updated_at = now()
  where id = v_match_state_id;

  if p_staging_fault = 'after_state_lock' then
    raise exception 'STAGING_FAULT_AFTER_STATE_LOCK';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_outbox_events, '[]'::jsonb))
  loop
    insert into public.match_integration_outbox (
      tenant_id, tournament_id, match_id, match_state_id,
      event_type, payload, idempotency_key
    ) values (
      p_tenant_id, p_tournament_id, p_match_id, v_match_state_id,
      v_item->>'eventType',
      coalesce(v_item->'payload', '{}'::jsonb),
      coalesce(v_item->>'idempotencyKey', v_finalize_key || '::' || (v_item->>'eventType'))
    )
    on conflict (match_state_id, idempotency_key) do nothing;
  end loop;

  if p_staging_fault = 'after_outbox' then
    raise exception 'STAGING_FAULT_AFTER_OUTBOX';
  end if;

  insert into public.match_sync_mutations (
    tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
    mutation_type, request_hash, response_payload, status, completed_at
  ) values (
    p_tenant_id, v_match_state_id, p_match_id, p_idempotency_key, v_finalize_key,
    'FINALIZE_MATCH', p_request_hash,
    jsonb_build_object('ok', true, 'locked', true),
    'applied', now()
  )
  on conflict (match_state_id, idempotency_key) do nothing;

  return jsonb_build_object('ok', true, 'locked', true);
exception when others then
  return jsonb_build_object('ok', false, 'code', 'FINALIZE_FAILED');
end;
$$;

revoke all on function public.referee_v5_commit_match_finalization(
  text, text, text, uuid, integer, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.referee_v5_commit_match_finalization(
  text, text, text, uuid, integer, text, text, jsonb, jsonb, text, text
) to service_role;

commit;

-- Phase V5-D.3.2 — Idempotency ordering + undo initial-state capture (STAGING ONLY)
-- Fixes:
--   1. Idempotency lookup AFTER row lock (C2 concurrent duplicate)
--   2. Full response_payload with state for cached retries
--   3. Store _initialState in first event command_payload for HTTP undo replay
-- Prerequisite: V5A + V5D + V5D1 + V5D3 fault injection already applied on staging

begin;

-- Replace prior overloads (15-param D1 + 16-param D3 fault injection)
drop function if exists public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text
);
drop function if exists public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text, text
);

create or replace function public.referee_v5_commit_match_transition(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_actor_id uuid,
  p_command_type text,
  p_command_payload jsonb,
  p_expected_state_version integer,
  p_expected_event_sequence bigint,
  p_client_mutation_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_next_state jsonb,
  p_generated_events jsonb,
  p_state_before_hash text,
  p_state_after_hash text,
  p_state_before jsonb default null,
  p_staging_fault text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
  v_cached public.match_sync_mutations%rowtype;
  v_schema_version integer;
  v_event_payload jsonb;
begin
  if p_staging_fault is not null and p_match_id not like 'REFEREE_V5_TEST_%' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION_FAILED', 'error', 'fault_test_scope');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);

  if p_actor_id is null or not exists (
    select 1 from public.referee_assignments ra
    where ra.tenant_id = p_tenant_id
      and ra.tournament_id = p_tournament_id
      and ra.match_id = p_match_id
      and ra.referee_user_id = p_actor_id
      and ra.status = 'active'
      and (ra.expires_at is null or ra.expires_at > now())
      and (ra.revoked_at is null)
  ) then
    return jsonb_build_object('ok', false, 'code', 'REFEREE_NOT_ASSIGNED');
  end if;

  -- 1. Lock current state first
  select * into v_live
  from public.match_live_states
  where id = v_match_state_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  end if;

  if v_live.status = 'locked' then
    return jsonb_build_object('ok', false, 'code', 'MATCH_LOCKED');
  end if;

  -- 2. Idempotency lookup after lock (before version conflict for new commands)
  select * into v_cached
  from public.match_sync_mutations
  where match_state_id = v_match_state_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_cached.request_hash is not null and v_cached.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSE_MISMATCH');
    end if;
    if v_cached.response_payload is not null then
      return v_cached.response_payload || jsonb_build_object('duplicate', true);
    end if;
  end if;

  -- 3. Version checks only for new commands
  if p_expected_state_version <> coalesce(v_live.state_version, v_live.version, 0) then
    return jsonb_build_object(
      'ok', false, 'code', 'MATCH_STATE_CONFLICT',
      'currentVersion', coalesce(v_live.state_version, v_live.version, 0),
      'currentSequence', v_live.last_event_sequence
    );
  end if;

  if p_expected_event_sequence <> v_live.last_event_sequence then
    return jsonb_build_object(
      'ok', false, 'code', 'EVENT_SEQUENCE_CONFLICT',
      'currentVersion', coalesce(v_live.state_version, v_live.version, 0),
      'currentSequence', v_live.last_event_sequence
    );
  end if;

  v_schema_version := nullif(p_next_state->>'stateSchemaVersion', '')::integer;
  if v_schema_version is null or v_schema_version <> 1 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  if (p_next_state->>'matchId') <> p_match_id then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  if nullif(p_next_state->>'version', '')::integer <> coalesce(v_live.state_version, v_live.version, 0) + 1 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  if nullif(p_next_state->>'lastEventSequence', '')::bigint <> v_live.last_event_sequence + 1 then
    return jsonb_build_object('ok', false, 'code', 'EVENT_SEQUENCE_CONFLICT');
  end if;

  v_event_payload := coalesce(p_command_payload, '{}'::jsonb);
  if p_expected_state_version = 0 and p_state_before is not null then
    v_event_payload := v_event_payload || jsonb_build_object('_initialState', p_state_before);
  end if;

  insert into public.match_events (
    tenant_id, tournament_id, match_id, match_state_id,
    event_sequence, event_type, command_type, command_payload,
    payload, state_version_before, state_version_after,
    state_before_hash, state_after_hash, generated_events,
    client_mutation_id, idempotency_key, actor_id
  ) values (
    p_tenant_id, p_tournament_id, p_match_id, v_match_state_id,
    p_expected_event_sequence + 1, p_command_type, p_command_type, v_event_payload,
    v_event_payload,
    p_expected_state_version, p_expected_state_version + 1,
    p_state_before_hash, p_state_after_hash, coalesce(p_generated_events, '[]'::jsonb),
    p_client_mutation_id, p_idempotency_key, p_actor_id
  );

  if p_staging_fault = 'after_event' then
    raise exception 'STAGING_FAULT_AFTER_EVENT';
  end if;

  update public.match_live_states set
    state_payload = p_next_state,
    state_version = p_expected_state_version + 1,
    version = p_expected_state_version + 1,
    last_event_sequence = p_expected_event_sequence + 1,
    state_hash = p_state_after_hash,
    status = coalesce(p_next_state->>'status', v_live.status),
    updated_by = p_actor_id,
    updated_at = now()
  where id = v_match_state_id;

  if p_staging_fault = 'after_snapshot' then
    raise exception 'STAGING_FAULT_AFTER_SNAPSHOT';
  end if;

  insert into public.match_sync_mutations (
    tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
    mutation_type, request_payload, request_hash, response_payload,
    status, resulting_event_sequence, resulting_state_version, completed_at
  ) values (
    p_tenant_id, v_match_state_id, p_match_id, p_client_mutation_id, p_idempotency_key,
    p_command_type, v_event_payload, p_request_hash,
    jsonb_build_object(
      'ok', true,
      'state', p_next_state,
      'stateVersion', p_expected_state_version + 1,
      'lastEventSequence', p_expected_event_sequence + 1,
      'stateHash', p_state_after_hash,
      'generatedEvents', coalesce(p_generated_events, '[]'::jsonb)
    ),
    'applied', p_expected_event_sequence + 1, p_expected_state_version + 1, now()
  )
  on conflict (match_state_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'state', p_next_state,
    'stateVersion', p_expected_state_version + 1,
    'lastEventSequence', p_expected_event_sequence + 1,
    'stateHash', p_state_after_hash,
    'generatedEvents', coalesce(p_generated_events, '[]'::jsonb)
  );
exception when others then
  return jsonb_build_object('ok', false, 'code', 'VALIDATION_FAILED', 'error', 'commit_failed');
end;
$$;

revoke all on function public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text, jsonb, text
) to service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- 10_APPLY.sql
-- Package: shared-referee-match-execution-init-capability-01
-- LOCAL AUTHORING ONLY. Do NOT execute on Staging/Production.
-- SQL_EXECUTED=NO  STAGING_MUTATIONS=0  PRODUCTION_MUTATIONS=0
--
-- Narrow trusted-server RPC for Shared Referee match execution
-- initialization. Does not create Tournament match identity.
-- Does not change CORE-13 assignment. Does not grant PUBLIC/anon.
-- NEW_SCHEMA=NO
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.referee_v5_initialize_match_execution_state(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_competition_mode text,
  p_actor_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_initial_state jsonb,
  p_team_a_id text,
  p_team_b_id text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id text;
  v_live public.match_live_states%rowtype;
  v_cached public.match_sync_mutations%rowtype;
  v_mode text;
  v_status text;
  v_version integer;
  v_sequence bigint;
  v_response jsonb;
begin
  if coalesce(trim(p_tenant_id), '') = ''
     or coalesce(trim(p_tournament_id), '') = ''
     or coalesce(trim(p_match_id), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or coalesce(trim(p_request_hash), '') = ''
     or coalesce(trim(p_actor_id), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION_DENIED');
  end if;

  v_mode := upper(trim(p_competition_mode));
  if v_mode not in ('DAILY_PLAY', 'INTERNAL', 'OFFICIAL', 'TEAM') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION_DENIED');
  end if;

  if p_initial_state is null
     or nullif(p_initial_state->>'stateSchemaVersion', '')::integer is distinct from 1
     or coalesce(p_initial_state->>'matchId', '') <> p_match_id
     or coalesce(p_initial_state->>'status', '') <> 'not_started'
     or coalesce(nullif(p_initial_state->>'version', '')::integer, 0) <> 0
     or coalesce(nullif(p_initial_state->>'lastEventSequence', '')::bigint, 0) <> 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  v_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);
  perform pg_advisory_xact_lock(hashtext('referee_v5_init:' || v_id));

  if exists (
    select 1
    from public.match_live_states mls
    where mls.match_id = p_match_id
      and (mls.tenant_id <> p_tenant_id or mls.tournament_id <> p_tournament_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'MATCH_STATE_CONFLICT');
  end if;

  select * into v_cached
  from public.match_sync_mutations
  where match_state_id = v_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_cached.request_hash is not null and v_cached.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSE_MISMATCH');
    end if;
    return coalesce(
      v_cached.response_payload,
      jsonb_build_object('ok', true, 'duplicate', true, 'alreadyInitialized', true, 'reset', false)
    ) || jsonb_build_object('ok', true, 'duplicate', true, 'alreadyInitialized', true, 'reset', false, 'initialized', false);
  end if;

  select * into v_live
  from public.match_live_states
  where id = v_id
  for update;

  if found then
    if v_live.tenant_id <> p_tenant_id
       or v_live.tournament_id <> p_tournament_id
       or v_live.match_id <> p_match_id then
      return jsonb_build_object('ok', false, 'code', 'MATCH_STATE_CONFLICT');
    end if;

    v_status := coalesce(v_live.status, '');
    v_version := coalesce(v_live.state_version, v_live.version, 0);
    v_sequence := coalesce(v_live.last_event_sequence, 0);

    if v_status = 'locked' then
      return jsonb_build_object('ok', false, 'code', 'MATCH_LOCKED');
    end if;
    if v_status in ('completed', 'cancelled', 'disputed') then
      return jsonb_build_object('ok', false, 'code', 'TERMINAL_STATE');
    end if;
    if v_status in ('in_progress', 'paused', 'game_break', 'SCORING_ACTIVE', 'scoring_active')
       or v_version > 0
       or v_sequence > 0 then
      return jsonb_build_object('ok', false, 'code', 'MATCH_ALREADY_ACTIVE');
    end if;

    v_response := jsonb_build_object(
      'ok', true,
      'initialized', false,
      'alreadyInitialized', true,
      'duplicate', false,
      'reset', false,
      'matchStateId', v_id,
      'status', v_live.status,
      'stateVersion', v_version,
      'lastEventSequence', v_sequence,
      'state', v_live.state_payload
    );

    insert into public.match_sync_mutations (
      tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
      mutation_type, request_payload, request_hash, response_payload, status, completed_at
    ) values (
      p_tenant_id, v_id, p_match_id, p_idempotency_key, p_idempotency_key,
      'INITIALIZE_MATCH_EXECUTION_STATE', p_initial_state, p_request_hash,
      v_response, 'applied', now()
    )
    on conflict (match_state_id, idempotency_key) do nothing;

    return v_response;
  end if;

  insert into public.match_live_states (
    id, tenant_id, tournament_id, match_id,
    team_a_id, team_b_id,
    state_payload, state_version, version, status, last_event_sequence,
    points_to_win, win_by, best_of, scoring_system
  ) values (
    v_id,
    p_tenant_id,
    p_tournament_id,
    p_match_id,
    coalesce(nullif(p_team_a_id, ''), p_initial_state->'teams'->'teamA'->>'teamId', 'SIDE_A'),
    coalesce(nullif(p_team_b_id, ''), p_initial_state->'teams'->'teamB'->>'teamId', 'SIDE_B'),
    p_initial_state,
    0,
    0,
    'not_started',
    0,
    coalesce(nullif(p_initial_state->>'pointsToWin', '')::int, 11),
    coalesce(nullif(p_initial_state->>'winBy', '')::int, 2),
    coalesce(nullif(p_initial_state->>'bestOf', '')::smallint, 1),
    coalesce(p_initial_state->>'scoringFormat', 'side_out')
  )
  on conflict (id) do nothing;

  select * into v_live
  from public.match_live_states
  where id = v_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  end if;

  if v_live.tenant_id <> p_tenant_id
     or v_live.tournament_id <> p_tournament_id
     or v_live.match_id <> p_match_id then
    return jsonb_build_object('ok', false, 'code', 'MATCH_STATE_CONFLICT');
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'initialized', true,
    'alreadyInitialized', false,
    'duplicate', false,
    'reset', false,
    'matchStateId', v_id,
    'status', v_live.status,
    'stateVersion', coalesce(v_live.state_version, v_live.version, 0),
    'lastEventSequence', coalesce(v_live.last_event_sequence, 0),
    'state', v_live.state_payload
  );

  insert into public.match_sync_mutations (
    tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
    mutation_type, request_payload, request_hash, response_payload, status, completed_at
  ) values (
    p_tenant_id, v_id, p_match_id, p_idempotency_key, p_idempotency_key,
    'INITIALIZE_MATCH_EXECUTION_STATE', p_initial_state, p_request_hash,
    v_response, 'applied', now()
  )
  on conflict (match_state_id, idempotency_key) do nothing;

  return v_response;
end;
$$;

revoke all on function public.referee_v5_initialize_match_execution_state(
  text, text, text, text, text, text, text, jsonb, text, text
) from public;

revoke all on function public.referee_v5_initialize_match_execution_state(
  text, text, text, text, text, text, text, jsonb, text, text
) from anon, authenticated;

grant execute on function public.referee_v5_initialize_match_execution_state(
  text, text, text, text, text, text, text, jsonb, text, text
) to service_role;

comment on function public.referee_v5_initialize_match_execution_state(
  text, text, text, text, text, text, text, jsonb, text, text
) is
  'Shared Referee Runtime trusted-server initializer for match_live_states. Not match identity authority. Not CORE-13. service_role only.';

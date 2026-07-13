-- Phase V5-D.1 — Referee V5 Architecture Correction & Pre-Staging Hardening
-- system_version: referee-v5
-- Status: DRAFT — NOT APPLIED
-- Prerequisite order (clean staging apply):
--   1. docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql
--   2. docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql
--   3. docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql
-- KHÔNG apply Production | KHÔNG apply Staging until owner GO after V5-D.1 review

begin;

-- ─── match_sync_mutations idempotency hardening ──────────────────
alter table public.match_sync_mutations
  add column if not exists request_hash text,
  add column if not exists error_code text,
  add column if not exists completed_at timestamptz,
  add column if not exists match_id text;

-- Full unique — no partial index (audit/retry safety)
alter table public.match_sync_mutations
  drop constraint if exists match_sync_mutations_match_state_id_idempotency_key_key;

create unique index if not exists match_sync_mutations_match_idempotency_uq
  on public.match_sync_mutations (match_state_id, idempotency_key);

-- ─── match_live_states snapshot metadata ─────────────────────────
alter table public.match_live_states
  add column if not exists state_hash text;

comment on column public.match_live_states.state_payload is
  'V5-B JSON snapshot. Must include stateSchemaVersion. Server-only writes via internal commit RPC.';

-- ─── match_integration_outbox (transactional downstream hooks) ───
create table if not exists public.match_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  match_state_id text not null references public.match_live_states (id) on delete restrict,
  event_type text not null check (event_type in (
    'BRACKET_ADVANCE_REQUESTED',
    'STANDINGS_RECALC_REQUESTED',
    'NOTIFICATION_REQUESTED',
    'RATING_EVIDENCE_REQUESTED'
  )),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (match_state_id, idempotency_key)
);

create index if not exists match_integration_outbox_pending_idx
  on public.match_integration_outbox (status, created_at)
  where status = 'pending';

-- ─── referee_assignments constraints ─────────────────────────────
alter table public.referee_assignments
  add column if not exists expires_at timestamptz;

alter table public.referee_assignments
  drop constraint if exists referee_assignments_expiry_order_chk;

alter table public.referee_assignments
  add constraint referee_assignments_expiry_order_chk
  check (expires_at is null or expires_at > assigned_at);

alter table public.referee_assignments
  drop constraint if exists referee_assignments_revoked_order_chk;

alter table public.referee_assignments
  add constraint referee_assignments_revoked_order_chk
  check (revoked_at is null or revoked_at >= assigned_at);

create unique index if not exists referee_assignments_active_role_uq
  on public.referee_assignments (tenant_id, tournament_id, match_id, role, referee_user_id)
  where status = 'active';

create index if not exists referee_assignments_tenant_user_idx
  on public.referee_assignments (tenant_id, referee_user_id, status);

-- ─── Append-only enforcement for match_events ────────────────────
create or replace function public.referee_v5_deny_match_events_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'APPEND_ONLY_VIOLATION: match_events is append-only';
end;
$$;

drop trigger if exists trg_match_events_deny_update on public.match_events;
create trigger trg_match_events_deny_update
  before update on public.match_events
  for each row execute function public.referee_v5_deny_match_events_mutation();

drop trigger if exists trg_match_events_deny_delete on public.match_events;
create trigger trg_match_events_deny_delete
  before delete on public.match_events
  for each row execute function public.referee_v5_deny_match_events_mutation();

-- ─── Internal: atomic command commit (service role ONLY) ─────────
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
  p_state_after_hash text
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
begin
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

  if (p_next_state->'teams'->'teamA'->>'courtEnd') = (p_next_state->'teams'->'teamB'->>'courtEnd') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  if nullif(p_next_state->>'version', '')::integer <> coalesce(v_live.state_version, v_live.version, 0) + 1 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_STATE');
  end if;

  if nullif(p_next_state->>'lastEventSequence', '')::bigint <> v_live.last_event_sequence + 1 then
    return jsonb_build_object('ok', false, 'code', 'EVENT_SEQUENCE_CONFLICT');
  end if;

  insert into public.match_events (
    tenant_id, tournament_id, match_id, match_state_id,
    event_sequence, event_type, command_type, command_payload,
    payload, state_version_before, state_version_after,
    state_before_hash, state_after_hash, generated_events,
    client_mutation_id, idempotency_key, actor_id
  ) values (
    p_tenant_id, p_tournament_id, p_match_id, v_match_state_id,
    p_expected_event_sequence + 1, p_command_type, p_command_type, p_command_payload,
    p_command_payload,
    p_expected_state_version, p_expected_state_version + 1,
    p_state_before_hash, p_state_after_hash, coalesce(p_generated_events, '[]'::jsonb),
    p_client_mutation_id, p_idempotency_key, p_actor_id
  );

  update public.match_live_states
  set state_payload = p_next_state,
      state_version = p_expected_state_version + 1,
      version = p_expected_state_version + 1,
      last_event_sequence = p_expected_event_sequence + 1,
      state_hash = p_state_after_hash,
      status = coalesce(p_next_state->>'status', v_live.status),
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_match_state_id;

  insert into public.match_sync_mutations (
    tenant_id, match_state_id, match_id, client_mutation_id, idempotency_key,
    mutation_type, request_payload, request_hash, response_payload,
    status, resulting_event_sequence, resulting_state_version, completed_at
  ) values (
    p_tenant_id, v_match_state_id, p_match_id, p_client_mutation_id, p_idempotency_key,
    p_command_type, p_command_payload, p_request_hash,
    jsonb_build_object(
      'ok', true,
      'state', p_next_state,
      'stateVersion', p_expected_state_version + 1,
      'lastEventSequence', p_expected_event_sequence + 1,
      'stateHash', p_state_after_hash
    ),
    'applied', p_expected_event_sequence + 1, p_expected_state_version + 1, now()
  )
  on conflict (match_state_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'stateVersion', p_expected_state_version + 1,
    'lastEventSequence', p_expected_event_sequence + 1,
    'stateHash', p_state_after_hash
  );
exception when others then
  return jsonb_build_object('ok', false, 'code', 'VALIDATION_FAILED', 'error', 'commit_failed');
end;
$$;

-- ─── Internal: atomic finalize (service role ONLY) ───────────────
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
  p_override_reason text default null
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

  update public.match_live_states
  set status = 'locked', locked_at = now(), locked_by = p_actor_id, updated_at = now()
  where id = v_match_state_id;

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

-- ─── Revoke deprecated public mutation RPCs (V5-D shell) ─────────
revoke all on function public.referee_v5_apply_match_command(
  text, text, text, text, jsonb, integer, bigint, text, text
) from public, anon, authenticated;

revoke all on function public.referee_v5_finalize_match_result(
  text, text, text, integer, text, text, boolean
) from public, anon, authenticated;

-- ─── Internal RPC grants: service_role ONLY ──────────────────────
revoke all on function public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated;

revoke all on function public.referee_v5_commit_match_finalization(
  text, text, text, uuid, integer, text, text, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.referee_v5_commit_match_transition(
  text, text, text, uuid, text, jsonb, integer, bigint, text, text, text, jsonb, jsonb, text, text
) to service_role;

grant execute on function public.referee_v5_commit_match_finalization(
  text, text, text, uuid, integer, text, text, jsonb, jsonb, text
) to service_role;

alter table public.match_integration_outbox enable row level security;
drop policy if exists match_integration_outbox_no_client on public.match_integration_outbox;
create policy match_integration_outbox_no_client
  on public.match_integration_outbox
  for all
  to authenticated
  using (false)
  with check (false);

commit;

-- DRAFT — NOT APPLIED
-- Rollback order: revoke service_role → drop triggers → drop internal functions → drop outbox

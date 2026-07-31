-- Phase V5-D — Referee V5 Persistence, RPC, RLS (DRAFT — NOT APPLIED)
-- system_version: referee-v5
-- Status: DRAFT — NOT APPLIED
-- Prerequisite: docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql (also DRAFT)
-- KHÔNG apply Production | KHÔNG apply Staging until owner GO
-- Architecture: V5-D.1 supersedes mutation RPC grants — see PHASE_V5D1_REFEREE_HARDENING.sql
-- Edge Function compute + internal atomic commit RPC (service_role only)

-- ─── Patch match_live_states for V5-D snapshot model ─────────────
alter table public.match_live_states
  add column if not exists state_payload jsonb,
  add column if not exists state_version integer,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

-- Backfill state_version from legacy version column when present
update public.match_live_states
set state_version = coalesce(state_version, version, 0)
where state_version is null;

alter table public.match_live_states
  alter column state_version set default 0;

comment on column public.match_live_states.state_payload is
  'Canonical V5-B match state JSON snapshot; server-only writes via RPC.';

-- ─── Patch match_events for command audit trail ──────────────────
alter table public.match_events
  add column if not exists command_type text,
  add column if not exists command_payload jsonb not null default '{}'::jsonb,
  add column if not exists state_before_hash text,
  add column if not exists state_after_hash text,
  add column if not exists generated_events jsonb not null default '[]'::jsonb;

-- Align naming: event_type remains domain event; command_type is client intent
update public.match_events
set command_type = coalesce(command_type, event_type),
    command_payload = case
      when command_payload = '{}'::jsonb then payload
      else command_payload
    end
where command_type is null;

-- Partial unique: idempotency only when key present
alter table public.match_events drop constraint if exists match_events_match_state_id_idempotency_key_key;
drop index if exists match_events_idempotency_partial_idx;
create unique index if not exists match_events_idempotency_partial_idx
  on public.match_events (match_state_id, idempotency_key)
  where idempotency_key is not null;

-- Replay index
create index if not exists match_events_replay_idx
  on public.match_events (match_state_id, event_sequence asc);

-- ─── match_command_idempotency (optional ledger; V5-A has match_sync_mutations) ─
-- Decision: reuse match_sync_mutations as idempotency store (unique match_state_id + idempotency_key).
-- No separate table unless divergence observed in staging.

alter table public.match_sync_mutations
  add column if not exists expires_at timestamptz,
  add column if not exists resulting_event_sequence bigint,
  add column if not exists resulting_state_version integer;

-- ─── match_result_revisions status expansion (V5-D spec) ─────────
alter table public.match_result_revisions
  drop constraint if exists match_result_revisions_status_check;

alter table public.match_result_revisions
  add constraint match_result_revisions_status_check
  check (status in (
    'draft', 'confirmed', 'disputed', 'overridden', 'locked', 'cancelled', 'void'
  ));

alter table public.match_result_revisions
  add column if not exists supersedes_revision integer,
  add column if not exists confirmed_by uuid references public.profiles (id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

-- ─── Helper: build match_state_id ─────────────────────────────────
create or replace function public.referee_v5_match_state_id(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text
) returns text
language sql
immutable
as $$
  select p_tenant_id || '::' || p_tournament_id || '::' || p_match_id;
$$;

-- ─── Authorization helpers (RLS + RPC) ─────────────────────────────
create or replace function public.referee_v5_current_user_has_assignment(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_roles text[] default array['REFEREE', 'SCOREKEEPER']
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.referee_assignments ra
    where ra.tenant_id = p_tenant_id
      and ra.tournament_id = p_tournament_id
      and ra.match_id = p_match_id
      and ra.referee_user_id = auth.uid()
      and ra.status = 'active'
      and ra.role = any (p_roles)
      and (ra.token_expires_at is null or ra.token_expires_at > now())
      and (ra.revoked_at is null)
  );
$$;

create or replace function public.referee_v5_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('SUPER_ADMIN', 'super_admin')
  );
$$;

-- ─── RLS policies (V5-D draft) ───────────────────────────────────
-- SELECT: assigned referee OR super admin, tenant scoped
drop policy if exists match_live_states_referee_select on public.match_live_states;
create policy match_live_states_referee_select
  on public.match_live_states
  for select
  to authenticated
  using (
    public.referee_v5_is_super_admin()
    or public.referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)
  );

drop policy if exists match_events_referee_select on public.match_events;
create policy match_events_referee_select
  on public.match_events
  for select
  to authenticated
  using (
    public.referee_v5_is_super_admin()
    or public.referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)
  );

drop policy if exists referee_assignments_self_select on public.referee_assignments;
create policy referee_assignments_self_select
  on public.referee_assignments
  for select
  to authenticated
  using (
    public.referee_v5_is_super_admin()
    or referee_user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE denied for client on append-only + snapshot tables
drop policy if exists match_events_no_client_write on public.match_events;
create policy match_events_no_client_write
  on public.match_events
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists match_live_states_no_client_write on public.match_live_states;
create policy match_live_states_no_client_write
  on public.match_live_states
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists match_result_revisions_no_client_write on public.match_result_revisions;
create policy match_result_revisions_no_client_write
  on public.match_result_revisions
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists match_sync_mutations_no_client_write on public.match_sync_mutations;
create policy match_sync_mutations_no_client_write
  on public.match_sync_mutations
  for all
  to authenticated
  using (false)
  with check (false);

-- ─── RPC: get match state (read path) ────────────────────────────
create or replace function public.referee_v5_get_match_state(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'TENANT_ACCESS_DENIED');
  end if;

  if not (
    public.referee_v5_is_super_admin()
    or public.referee_v5_current_user_has_assignment(p_tenant_id, p_tournament_id, p_match_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'REFEREE_NOT_ASSIGNED');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);

  select * into v_live
  from public.match_live_states
  where id = v_match_state_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', coalesce(v_live.state_payload, '{}'::jsonb),
    'stateVersion', coalesce(v_live.state_version, v_live.version, 0),
    'lastEventSequence', v_live.last_event_sequence,
    'status', v_live.status
  );
end;
$$;

-- ─── RPC: apply match command (transaction shell — engine in JS layer) ─
-- Production path: Edge Function calls RefereeV5PersistenceService then commits via service role.
-- This SQL stub validates auth + row lock intent and returns NOT_READY until wired.
create or replace function public.referee_v5_apply_match_command(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_command_type text,
  p_payload jsonb default '{}'::jsonb,
  p_expected_version integer default null,
  p_expected_sequence bigint default null,
  p_client_mutation_id text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
  v_cached public.match_sync_mutations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'TENANT_ACCESS_DENIED');
  end if;

  if not public.referee_v5_current_user_has_assignment(p_tenant_id, p_tournament_id, p_match_id) then
    return jsonb_build_object('ok', false, 'code', 'REFEREE_NOT_ASSIGNED');
  end if;

  -- Reject client official fields in payload
  if p_payload ?| array[
    'team_a_score', 'team_b_score', 'serving_team_id', 'serving_player_id',
    'receiving_player_id', 'server_number', 'player_positions', 'serve_direction',
    'winner_id', 'official_result'
  ] then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MATCH_COMMAND');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);

  if p_idempotency_key is not null then
    select * into v_cached
    from public.match_sync_mutations
    where match_state_id = v_match_state_id
      and idempotency_key = p_idempotency_key;

    if found and v_cached.response_payload is not null then
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

  if p_expected_version is not null
     and p_expected_version <> coalesce(v_live.state_version, v_live.version, 0) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MATCH_STATE_CONFLICT',
      'currentVersion', coalesce(v_live.state_version, v_live.version, 0),
      'currentSequence', v_live.last_event_sequence
    );
  end if;

  if p_expected_sequence is not null and p_expected_sequence <> v_live.last_event_sequence then
    return jsonb_build_object(
      'ok', false,
      'code', 'EVENT_SEQUENCE_CONFLICT',
      'currentVersion', coalesce(v_live.state_version, v_live.version, 0),
      'currentSequence', v_live.last_event_sequence
    );
  end if;

  -- Engine transition MUST run in JS (Approach C). Staging wires Edge Function here.
  return jsonb_build_object(
    'ok', false,
    'code', 'VALIDATION_FAILED',
    'error', 'V5-D RPC shell only — apply via Edge Function + RefereeV5PersistenceService'
  );
end;
$$;

-- ─── RPC: finalize match result ──────────────────────────────────
create or replace function public.referee_v5_finalize_match_result(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_expected_version integer,
  p_idempotency_key text,
  p_override_reason text default null,
  p_is_override boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_state_id text;
  v_live public.match_live_states%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'TENANT_ACCESS_DENIED');
  end if;

  if not public.referee_v5_current_user_has_assignment(p_tenant_id, p_tournament_id, p_match_id) then
    return jsonb_build_object('ok', false, 'code', 'REFEREE_NOT_ASSIGNED');
  end if;

  if p_is_override and (p_override_reason is null or btrim(p_override_reason) = '') then
    return jsonb_build_object('ok', false, 'code', 'OVERRIDE_REASON_REQUIRED');
  end if;

  v_match_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);

  select * into v_live
  from public.match_live_states
  where id = v_match_state_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MATCH_NOT_FOUND');
  end if;

  if p_expected_version <> coalesce(v_live.state_version, v_live.version, 0) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MATCH_STATE_CONFLICT',
      'currentVersion', coalesce(v_live.state_version, v_live.version, 0)
    );
  end if;

  if v_live.status not in ('completed', 'locked') then
    return jsonb_build_object('ok', false, 'code', 'RESULT_NOT_READY');
  end if;

  return jsonb_build_object(
    'ok', false,
    'code', 'VALIDATION_FAILED',
    'error', 'V5-D finalize shell only — complete via Edge Function transaction'
  );
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────
revoke all on function public.referee_v5_get_match_state(text, text, text) from public;
grant execute on function public.referee_v5_get_match_state(text, text, text) to authenticated;

revoke all on function public.referee_v5_apply_match_command(
  text, text, text, text, jsonb, integer, bigint, text, text
) from public;
grant execute on function public.referee_v5_apply_match_command(
  text, text, text, text, jsonb, integer, bigint, text, text
) to authenticated;

revoke all on function public.referee_v5_finalize_match_result(
  text, text, text, integer, text, text, boolean
) from public;
grant execute on function public.referee_v5_finalize_match_result(
  text, text, text, integer, text, text, boolean
) to authenticated;

-- Service role used by Edge Function for commit after engine transition (staging only)
-- grant usage on schema public to service_role; (already default)

-- DRAFT — NOT APPLIED

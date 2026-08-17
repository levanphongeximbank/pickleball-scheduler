-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO
-- Forward-only. Additive. No business DML. No Staging row copy.
-- STAGING_ROWS_COPIED=0. EXISTING_BUSINESS_DATA_MUTATION=NO.
--
-- Reuses public.referee_assignments. Creates Competition audit +
-- idempotency tables and competition_* assignment RPCs (CAS + atomic replace).
-- Does NOT modify Adapter #16. Does NOT drop referee_assignments.
--
-- APPLY_TRANSACTION_MODEL=SINGLE_EXPLICIT_TRANSACTION
-- Unique index is NOT CONCURRENTLY (safe inside a transaction).
-- PRECHECK must PASS first so foreseeable duplicate-active data cannot
-- fail the unique index after earlier DDL in this script.
-- PARTIAL_APPLY_RISK=LOW_IF_ONE_SESSION
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────
-- A) Additive evolution of referee_assignments (no parallel table)
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.referee_assignments') is null then
    raise exception
      'APPLY_REFUSED referee_assignments missing — refuse inventing a parallel assignment table';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referee_assignments'
      and column_name = 'version'
  ) then
    alter table public.referee_assignments
      add column version integer not null default 1;
    alter table public.referee_assignments
      add constraint referee_assignments_version_nonneg_chk check (version >= 0);
  end if;
end;
$$;

-- One active assignment per match+role (Competition CAS scope).
-- NOT CONCURRENTLY — must remain inside the APPLY transaction.
create unique index if not exists competition_referee_assignments_active_match_role_uq
  on public.referee_assignments (tenant_id, tournament_id, match_id, role)
  where status = 'active';

-- ─────────────────────────────────────────────────────────────────
-- B) Competition-owned durable assignment audit
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.competition_referee_assignment_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  match_id text not null,
  assignment_id uuid null references public.referee_assignments (id) on delete set null,
  old_referee_user_id uuid null,
  new_referee_user_id uuid null,
  operation text not null
    check (operation in ('ASSIGN', 'REPLACE', 'UNASSIGN')),
  actor_id uuid null,
  reason text null,
  lifecycle_state text null,
  idempotency_key text null,
  previous_version integer null,
  new_version integer null,
  emergency_replacement boolean not null default false,
  recorded_at timestamptz not null default now(),
  payload jsonb null
);

create index if not exists competition_referee_assignment_audit_scope_idx
  on public.competition_referee_assignment_audit (tenant_id, tournament_id, match_id);

create index if not exists competition_referee_assignment_audit_idempotency_idx
  on public.competition_referee_assignment_audit (idempotency_key)
  where idempotency_key is not null;

comment on table public.competition_referee_assignment_audit is
  'Competition-owned durable referee assignment audit (CORE-13 runtime closure). Not Adapter #16.';

alter table public.competition_referee_assignment_audit enable row level security;

-- Audit is durable and internal to SECURITY DEFINER RPCs.
-- No direct client table read (S01). Authenticated SELECT would leak
-- every tenant's assignment evidence under a mere auth.uid() IS NOT NULL policy.
revoke all on table public.competition_referee_assignment_audit from public, anon, authenticated;

drop policy if exists competition_referee_assignment_audit_select_auth
  on public.competition_referee_assignment_audit;
drop policy if exists competition_referee_assignment_audit_no_client_write
  on public.competition_referee_assignment_audit;
drop policy if exists competition_referee_assignment_audit_deny_authenticated
  on public.competition_referee_assignment_audit;
create policy competition_referee_assignment_audit_deny_authenticated
  on public.competition_referee_assignment_audit
  for all
  to authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────────
-- C) Competition-owned assignment idempotency ledger
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.competition_referee_assignment_idempotency (
  tenant_id text not null,
  tournament_id text not null,
  idempotency_key text not null,
  operation text not null,
  payload_hash text not null,
  assignment_id uuid null,
  result_version integer null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, tournament_id, idempotency_key)
);

comment on table public.competition_referee_assignment_idempotency is
  'Competition referee assignment idempotency (tenant+tournament+key). Same hash → replay; conflict → IDEMPOTENCY_CONFLICT.';

alter table public.competition_referee_assignment_idempotency enable row level security;

revoke all on table public.competition_referee_assignment_idempotency
  from public, anon, authenticated;
-- No client table access; RPCs (SECURITY DEFINER) own writes.

drop policy if exists competition_referee_assignment_idempotency_deny_all
  on public.competition_referee_assignment_idempotency;
create policy competition_referee_assignment_idempotency_deny_all
  on public.competition_referee_assignment_idempotency
  for all
  to authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────────
-- Internal helpers (not granted to clients)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.competition_assignment_normalize_role(p_role text)
returns text
language sql
immutable
as $$
  select case upper(trim(coalesce(p_role, 'REFEREE')))
    when 'PRIMARY' then 'REFEREE'
    when 'REFEREE' then 'REFEREE'
    when 'SCOREKEEPER' then 'SCOREKEEPER'
    when 'HEAD_REFEREE' then 'HEAD_REFEREE'
    when 'HEAD' then 'HEAD_REFEREE'
    else null
  end;
$$;

revoke all on function public.competition_assignment_normalize_role(text)
  from public, anon, authenticated;

create or replace function public.competition_assignment_scope_version(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_role text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active integer;
  v_max integer;
begin
  select ra.version into v_active
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = p_role
    and ra.status = 'active'
  order by ra.assigned_at desc nulls last
  limit 1;

  if v_active is not null then
    return v_active;
  end if;

  select max(ra.version) into v_max
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = p_role;

  return coalesce(v_max, 0);
end;
$$;

revoke all on function public.competition_assignment_scope_version(text, text, text, text)
  from public, anon, authenticated;

create or replace function public.competition_assignment_payload_hash(p_payload jsonb)
returns text
language sql
immutable
as $$
  select md5(coalesce(p_payload, '{}'::jsonb)::text);
$$;

revoke all on function public.competition_assignment_payload_hash(jsonb)
  from public, anon, authenticated;

create or replace function public.competition_assignment_check_idempotency(
  p_tenant_id text,
  p_tournament_id text,
  p_idempotency_key text,
  p_payload_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.competition_referee_assignment_idempotency;
begin
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED'
      using detail = 'idempotency_key is required for competition assignment RPCs';
  end if;

  select * into v_row
  from public.competition_referee_assignment_idempotency i
  where i.tenant_id = p_tenant_id
    and i.tournament_id = p_tournament_id
    and i.idempotency_key = p_idempotency_key;

  if not found then
    return jsonb_build_object('replay', false);
  end if;

  if v_row.payload_hash is distinct from p_payload_hash then
    raise exception 'IDEMPOTENCY_CONFLICT'
      using detail = format(
        'idempotency_key=%s stored_hash=%s request_hash=%s',
        p_idempotency_key, v_row.payload_hash, p_payload_hash
      );
  end if;

  return jsonb_build_object(
    'replay', true,
    'assignmentId', v_row.assignment_id,
    'version', v_row.result_version,
    'operation', v_row.operation
  );
end;
$$;

revoke all on function public.competition_assignment_check_idempotency(text, text, text, text)
  from public, anon, authenticated;

create or replace function public.competition_assignment_write_audit(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_assignment_id uuid,
  p_old_referee_user_id uuid,
  p_new_referee_user_id uuid,
  p_operation text,
  p_actor_id uuid,
  p_reason text,
  p_lifecycle_state text,
  p_idempotency_key text,
  p_previous_version integer,
  p_new_version integer,
  p_emergency_replacement boolean,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.competition_referee_assignment_audit (
    tenant_id, tournament_id, match_id, assignment_id,
    old_referee_user_id, new_referee_user_id, operation,
    actor_id, reason, lifecycle_state, idempotency_key,
    previous_version, new_version, emergency_replacement, payload
  ) values (
    p_tenant_id, p_tournament_id, p_match_id, p_assignment_id,
    p_old_referee_user_id, p_new_referee_user_id, p_operation,
    p_actor_id, p_reason, p_lifecycle_state, p_idempotency_key,
    p_previous_version, p_new_version,
    coalesce(p_emergency_replacement, false),
    p_payload
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.competition_assignment_write_audit(
  text, text, text, uuid, uuid, uuid, text, uuid, text, text, text, integer, integer, boolean, jsonb
) from public, anon, authenticated;

create or replace function public.competition_assignment_remember_idempotency(
  p_tenant_id text,
  p_tournament_id text,
  p_idempotency_key text,
  p_operation text,
  p_payload_hash text,
  p_assignment_id uuid,
  p_result_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.competition_referee_assignment_idempotency (
    tenant_id, tournament_id, idempotency_key,
    operation, payload_hash, assignment_id, result_version
  ) values (
    p_tenant_id, p_tournament_id, p_idempotency_key,
    p_operation, p_payload_hash, p_assignment_id, p_result_version
  )
  on conflict (tenant_id, tournament_id, idempotency_key) do nothing;
end;
$$;

revoke all on function public.competition_assignment_remember_idempotency(
  text, text, text, text, text, uuid, integer
) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Trusted-server service_role persistence boundary
--
-- PROVEN CONFLICT: auth.uid() under service_role is not the originating
-- user. JWT tenant/permission helpers (canonical_tournament_assert_tenant,
-- canonical_tournament_assert_permission, team_tournament_can_manage)
-- therefore cannot identify the end user here.
--
-- Trust model:
--   * EXECUTE is revoked from public/anon/authenticated (no browser RPC).
--   * Only service_role may execute (trusted Edge Function).
--   * Originating actor is p_actor_id, set only after the Edge Function
--     authenticates the user JWT on a user-scoped client.
--   * Browser actor spoofing is impossible because browsers cannot EXECUTE.
--   * SQL still binds tournament-in-tenant and derives lifecycle from
--     authoritative rows (defense in depth). It is NOT a CORE-13 planner.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.competition_assignment_assert_mutation_boundary(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_actor_id uuid,
  p_operation text,
  p_emergency_replacement boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_jwt_role text;
  v_canonical public.canonical_tournaments;
  v_header public.team_tournaments;
  v_live public.match_live_states;
  v_sm public.team_tournament_sub_matches;
  v_mu public.team_tournament_matchups;
  v_lifecycle text := 'PRE_MATCH';
  v_op text;
  v_mid text;
  v_daily jsonb;
  v_match jsonb;
begin
  v_jwt_role := coalesce(auth.role(), '');
  if v_jwt_role is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED'
      using detail = 'competition_* assignment RPCs are trusted-server service_role only';
  end if;

  if p_actor_id is null then
    raise exception 'ORIGINATING_ACTOR_REQUIRED'
      using detail = 'trusted server must pass authenticated originating actor; auth.uid() is not the end user under service_role';
  end if;

  v_actor := p_actor_id;

  if nullif(trim(coalesce(p_tenant_id, '')), '') is null
     or nullif(trim(coalesce(p_tournament_id, '')), '') is null
     or nullif(trim(coalesce(p_match_id, '')), '') is null then
    raise exception 'INVALID_INPUT'
      using detail = 'tenant_id, tournament_id, match_id required';
  end if;

  v_op := upper(trim(coalesce(p_operation, '')));
  if v_op not in ('ASSIGN', 'REPLACE', 'UNASSIGN') then
    raise exception 'INVALID_INPUT' using detail = format('unsupported operation=%s', p_operation);
  end if;

  -- Tournament-in-tenant bind (data integrity). JWT permission is asserted
  -- by the trusted server with the user-scoped client before this RPC.
  select * into v_canonical
  from public.canonical_tournaments ct
  where ct.tenant_id = p_tenant_id
    and (ct.id::text = p_tournament_id or ct.external_key = p_tournament_id)
  limit 1;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is not null then
    if v_header.tenant_id is distinct from p_tenant_id then
      raise exception 'CROSS_TENANT_DENIED'
        using detail = 'bound team tournament tenant does not match p_tenant_id';
    end if;
  end if;

  if v_canonical.id is null and v_header.id is null then
    raise exception 'CROSS_TOURNAMENT_DENIED'
      using detail = 'tournament is not bound in caller tenant';
  end if;

  -- Tournament-level lifecycle (authoritative row, not caller claim).
  if v_canonical.id is not null and v_canonical.status in ('completed', 'cancelled') then
    v_lifecycle := 'COMPLETED';
  end if;
  if v_header.id is not null and v_header.status in ('completed', 'cancelled') then
    v_lifecycle := 'COMPLETED';
  end if;

  v_mid := trim(p_match_id);

  select * into v_live
  from public.match_live_states mls
  where mls.tenant_id = p_tenant_id
    and mls.match_id = v_mid
    and mls.tournament_id in (
      p_tournament_id,
      coalesce(v_canonical.id::text, ''),
      coalesce(v_canonical.external_key, ''),
      coalesce(v_header.tournament_id, '')
    )
  order by mls.updated_at desc nulls last
  limit 1;

  if v_live.id is not null then
    if v_live.status in ('completed', 'cancelled') then
      v_lifecycle := 'COMPLETED';
    elsif v_live.status in ('locked', 'paused', 'disputed') then
      v_lifecycle := 'LOCKED';
    elsif v_live.status in ('in_progress', 'game_break') then
      if coalesce(v_live.last_event_sequence, 0) > 0
         or coalesce(v_live.team_a_score, 0) > 0
         or coalesce(v_live.team_b_score, 0) > 0 then
        v_lifecycle := 'SCORING_ACTIVE';
      else
        v_lifecycle := 'IN_PROGRESS';
      end if;
    elsif v_live.status = 'not_started' and v_lifecycle not in ('COMPLETED', 'LOCKED') then
      v_lifecycle := 'PRE_MATCH';
    end if;
  end if;

  if v_header.id is not null then
    select * into v_sm
    from public.team_tournament_sub_matches sm
    where sm.tenant_id = p_tenant_id
      and sm.tournament_id = v_header.tournament_id
      and sm.external_sub_match_id = v_mid
    limit 1;

    if v_sm.id is not null then
      if v_sm.status in ('completed', 'forfeit') or v_sm.result_confirmed_at is not null then
        v_lifecycle := 'COMPLETED';
      elsif v_sm.status = 'playing' and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
        v_lifecycle := 'IN_PROGRESS';
      end if;
    end if;

    select * into v_mu
    from public.team_tournament_matchups mu
    where mu.tenant_id = p_tenant_id
      and mu.team_tournament_id = v_header.id
      and mu.external_matchup_id = v_mid
    limit 1;

    if v_mu.id is not null then
      if v_mu.status = 'completed' then
        v_lifecycle := 'COMPLETED';
      elsif v_mu.status = 'locked' then
        v_lifecycle := 'LOCKED';
      elsif v_mu.status = 'in_progress'
            and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
        v_lifecycle := 'IN_PROGRESS';
      end if;
    end if;
  end if;

  if v_canonical.id is not null and v_canonical.mode = 'daily_play' then
    v_daily := coalesce(v_canonical.payload#>'{settings,dailyPlay,matches}', '[]'::jsonb);
    if jsonb_typeof(v_daily) = 'array' then
      select value into v_match
      from jsonb_array_elements(v_daily) e(value)
      where coalesce(e.value->>'id', e.value->>'matchId') = v_mid
      limit 1;
      if v_match is not null then
        if lower(coalesce(v_match->>'status', '')) in (
          'completed', 'complete', 'finished', 'final', 'closed', 'cancelled'
        ) then
          v_lifecycle := 'COMPLETED';
        elsif lower(coalesce(v_match->>'status', '')) in ('locked', 'suspended', 'paused') then
          v_lifecycle := 'LOCKED';
        elsif lower(coalesce(v_match->>'status', '')) in ('scoring', 'scoring_active', 'score_entry') then
          v_lifecycle := 'SCORING_ACTIVE';
        elsif lower(coalesce(v_match->>'status', '')) in ('in_progress', 'active', 'started', 'live', 'playing')
              and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
          v_lifecycle := 'IN_PROGRESS';
        end if;
      end if;
    end if;
  end if;

  -- Owner non-negotiable mutation invariants (not CORE-13 planning).
  if v_lifecycle in ('LOCKED', 'COMPLETED') then
    raise exception 'LIFECYCLE_DENIED'
      using detail = format('%s forbids assign/replace/unassign', v_lifecycle);
  end if;

  if v_lifecycle = 'IN_PROGRESS' then
    if v_op = 'ASSIGN' then
      raise exception 'LIFECYCLE_DENIED'
        using detail = 'IN_PROGRESS forbids new assignment (use atomic replace)';
    end if;
    if v_op = 'UNASSIGN' then
      raise exception 'UNASSIGN_WITHOUT_REPLACEMENT_DENIED'
        using detail = 'IN_PROGRESS forbids unassign without replacement';
    end if;
  end if;

  if v_lifecycle = 'SCORING_ACTIVE' then
    if v_op = 'ASSIGN' then
      raise exception 'LIFECYCLE_DENIED'
        using detail = 'SCORING_ACTIVE forbids normal assign';
    end if;
    if v_op = 'UNASSIGN' then
      raise exception 'UNASSIGN_WITHOUT_REPLACEMENT_DENIED'
        using detail = 'SCORING_ACTIVE forbids unassign without replacement';
    end if;
    if v_op = 'REPLACE' and coalesce(p_emergency_replacement, false) is not true then
      raise exception 'EMERGENCY_REPLACEMENT_REQUIRED'
        using detail = 'SCORING_ACTIVE requires explicit emergencyReplacement=true';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'actorId', v_actor,
    'lifecycleState', v_lifecycle,
    'tenantId', p_tenant_id,
    'tournamentId', p_tournament_id,
    'matchId', v_mid,
    'canonicalBound', (v_canonical.id is not null),
    'teamBound', (v_header.id is not null),
    'trustedServerDelegation', true,
    'jwtRole', v_jwt_role,
    'authUid', auth.uid()
  );
end;
$$;

revoke all on function public.competition_assignment_assert_mutation_boundary(
  text, text, text, uuid, text, boolean
) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- D1) competition_assign_referee
-- ─────────────────────────────────────────────────────────────────
create or replace function public.competition_assign_referee(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_referee_user_id uuid,
  p_role text default 'REFEREE',
  p_expected_version integer default null,
  p_idempotency_key text default null,
  p_actor_id uuid default null,
  p_reason text default null,
  p_lifecycle_state text default null,
  p_command_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor uuid;
  v_hash text;
  v_idem jsonb;
  v_current integer;
  v_new_version integer;
  v_active public.referee_assignments;
  v_prior public.referee_assignments;
  v_row public.referee_assignments;
  v_display text;
  v_audit_id uuid;
  v_payload jsonb;
  v_boundary jsonb;
begin
  if nullif(trim(coalesce(p_tenant_id, '')), '') is null
     or nullif(trim(coalesce(p_tournament_id, '')), '') is null
     or nullif(trim(coalesce(p_match_id, '')), '') is null
     or p_referee_user_id is null then
    raise exception 'INVALID_INPUT'
      using detail = 'tenant_id, tournament_id, match_id, referee_user_id required';
  end if;

  if p_expected_version is null then
    raise exception 'EXPECTED_VERSION_REQUIRED';
  end if;

  v_role := public.competition_assignment_normalize_role(p_role);
  if v_role is null then
    raise exception 'INVALID_INPUT' using detail = format('unsupported role=%s', p_role);
  end if;

  v_boundary := public.competition_assignment_assert_mutation_boundary(
    p_tenant_id, p_tournament_id, p_match_id, p_actor_id, 'ASSIGN', false
  );
  v_actor := (v_boundary->>'actorId')::uuid;

  v_payload := jsonb_build_object(
    'operation', 'ASSIGN',
    'tenantId', p_tenant_id,
    'tournamentId', p_tournament_id,
    'matchId', p_match_id,
    'refereeUserId', p_referee_user_id,
    'role', v_role,
    'expectedVersion', p_expected_version,
    'lifecycleState', v_boundary->>'lifecycleState',
    'commandMetadata', coalesce(p_command_metadata, '{}'::jsonb),
    'originatingActorId', v_actor,
    'trustedServerBoundary', 'competition-referee-assignment'
  );
  v_hash := public.competition_assignment_payload_hash(v_payload);

  perform pg_advisory_xact_lock(
    hashtext(p_tenant_id || '::' || p_tournament_id || '::' || p_match_id || '::' || v_role)
  );

  v_idem := public.competition_assignment_check_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key), v_hash
  );
  if coalesce((v_idem->>'replay')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_idem->>'assignmentId',
      'version', (v_idem->>'version')::integer,
      'matchId', p_match_id,
      'role', v_role,
      'operation', 'ASSIGN'
    );
  end if;

  select * into v_active
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = v_role
    and ra.status = 'active'
  for update;

  v_current := public.competition_assignment_scope_version(
    p_tenant_id, p_tournament_id, p_match_id, v_role
  );

  if v_current is distinct from p_expected_version then
    raise exception 'STALE_WRITE'
      using detail = format('expected=%s actual=%s', p_expected_version, v_current);
  end if;

  if v_active.id is not null then
    raise exception 'ACTIVE_ASSIGNMENT_EXISTS'
      using detail = format('assignmentId=%s — use competition_replace_referee', v_active.id);
  end if;

  v_new_version := p_expected_version + 1;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), 'Referee')
    into v_display
  from public.profiles p
  where p.id = p_referee_user_id;
  v_display := coalesce(v_display, 'Referee');

  -- Prefer insert; reactivate same referee row if unique (tenant,match,role,referee) blocks.
  select * into v_prior
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = v_role
    and ra.referee_user_id = p_referee_user_id
  order by ra.assigned_at desc nulls last
  limit 1
  for update;

  if v_prior.id is not null then
    update public.referee_assignments ra
    set status = 'active',
        version = v_new_version,
        assigned_by = v_actor,
        assigned_at = now(),
        revoked_at = null,
        revoked_by = null,
        revoke_reason = null,
        referee_display_name = v_display,
        updated_at = now()
    where ra.id = v_prior.id
    returning * into v_row;
  else
    insert into public.referee_assignments (
      tenant_id, tournament_id, match_id,
      referee_user_id, referee_display_name,
      role, status, assigned_by, assigned_at, version
    ) values (
      p_tenant_id, p_tournament_id, p_match_id,
      p_referee_user_id, v_display,
      v_role, 'active', v_actor, now(), v_new_version
    )
    returning * into v_row;
  end if;

  v_audit_id := public.competition_assignment_write_audit(
    p_tenant_id, p_tournament_id, p_match_id, v_row.id,
    null, p_referee_user_id, 'ASSIGN',
    v_actor, p_reason, v_boundary->>'lifecycleState', trim(p_idempotency_key),
    p_expected_version, v_new_version, false,
    v_payload
  );

  perform public.competition_assignment_remember_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key),
    'ASSIGN', v_hash, v_row.id, v_new_version
  );

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'assignmentId', v_row.id,
    'version', v_new_version,
    'previousVersion', p_expected_version,
    'matchId', p_match_id,
    'role', v_role,
    'refereeUserId', p_referee_user_id,
    'status', 'active',
    'operation', 'ASSIGN',
    'auditId', v_audit_id
  );
end;
$$;

revoke all on function public.competition_assign_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.competition_assign_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, jsonb
) to service_role;

-- ─────────────────────────────────────────────────────────────────
-- D2) competition_replace_referee (atomic revoke + insert)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.competition_replace_referee(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_new_referee_user_id uuid,
  p_role text default 'REFEREE',
  p_expected_version integer default null,
  p_idempotency_key text default null,
  p_actor_id uuid default null,
  p_reason text default null,
  p_lifecycle_state text default null,
  p_emergency_replacement boolean default false,
  p_command_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor uuid;
  v_hash text;
  v_idem jsonb;
  v_active public.referee_assignments;
  v_prior public.referee_assignments;
  v_row public.referee_assignments;
  v_new_version integer;
  v_display text;
  v_audit_id uuid;
  v_payload jsonb;
  v_old uuid;
  v_boundary jsonb;
begin
  if nullif(trim(coalesce(p_tenant_id, '')), '') is null
     or nullif(trim(coalesce(p_tournament_id, '')), '') is null
     or nullif(trim(coalesce(p_match_id, '')), '') is null
     or p_new_referee_user_id is null then
    raise exception 'INVALID_INPUT'
      using detail = 'tenant_id, tournament_id, match_id, new_referee_user_id required';
  end if;

  if p_expected_version is null then
    raise exception 'EXPECTED_VERSION_REQUIRED';
  end if;

  v_role := public.competition_assignment_normalize_role(p_role);
  if v_role is null then
    raise exception 'INVALID_INPUT' using detail = format('unsupported role=%s', p_role);
  end if;

  v_boundary := public.competition_assignment_assert_mutation_boundary(
    p_tenant_id, p_tournament_id, p_match_id, p_actor_id, 'REPLACE',
    coalesce(p_emergency_replacement, false)
  );
  v_actor := (v_boundary->>'actorId')::uuid;

  v_payload := jsonb_build_object(
    'operation', 'REPLACE',
    'tenantId', p_tenant_id,
    'tournamentId', p_tournament_id,
    'matchId', p_match_id,
    'newRefereeUserId', p_new_referee_user_id,
    'role', v_role,
    'expectedVersion', p_expected_version,
    'emergencyReplacement', coalesce(p_emergency_replacement, false),
    'lifecycleState', v_boundary->>'lifecycleState',
    'commandMetadata', coalesce(p_command_metadata, '{}'::jsonb),
    'originatingActorId', v_actor,
    'trustedServerBoundary', 'competition-referee-assignment'
  );
  v_hash := public.competition_assignment_payload_hash(v_payload);

  perform pg_advisory_xact_lock(
    hashtext(p_tenant_id || '::' || p_tournament_id || '::' || p_match_id || '::' || v_role)
  );

  v_idem := public.competition_assignment_check_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key), v_hash
  );
  if coalesce((v_idem->>'replay')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_idem->>'assignmentId',
      'version', (v_idem->>'version')::integer,
      'matchId', p_match_id,
      'role', v_role,
      'operation', 'REPLACE',
      'emergencyReplacement', coalesce(p_emergency_replacement, false)
    );
  end if;

  select * into v_active
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = v_role
    and ra.status = 'active'
  for update;

  if v_active.id is null then
    raise exception 'NO_ACTIVE_ASSIGNMENT'
      using detail = 'No active assignment to replace';
  end if;

  if v_active.version is distinct from p_expected_version then
    raise exception 'STALE_WRITE'
      using detail = format('expected=%s actual=%s', p_expected_version, v_active.version);
  end if;

  v_old := v_active.referee_user_id;
  v_new_version := p_expected_version + 1;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), 'Referee')
    into v_display
  from public.profiles p
  where p.id = p_new_referee_user_id;
  v_display := coalesce(v_display, 'Referee');

  -- ATOMIC: revoke old + activate new before function returns (single transaction).
  update public.referee_assignments ra
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = v_actor,
      revoke_reason = coalesce(p_reason, 'competition_replace'),
      updated_at = now()
  where ra.id = v_active.id;

  select * into v_prior
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = v_role
    and ra.referee_user_id = p_new_referee_user_id
    and ra.id is distinct from v_active.id
  order by ra.assigned_at desc nulls last
  limit 1
  for update;

  if v_prior.id is not null then
    update public.referee_assignments ra
    set status = 'active',
        version = v_new_version,
        assigned_by = v_actor,
        assigned_at = now(),
        revoked_at = null,
        revoked_by = null,
        revoke_reason = null,
        referee_display_name = v_display,
        updated_at = now()
    where ra.id = v_prior.id
    returning * into v_row;
  else
    insert into public.referee_assignments (
      tenant_id, tournament_id, match_id,
      referee_user_id, referee_display_name,
      role, status, assigned_by, assigned_at, version
    ) values (
      p_tenant_id, p_tournament_id, p_match_id,
      p_new_referee_user_id, v_display,
      v_role, 'active', v_actor, now(), v_new_version
    )
    returning * into v_row;
  end if;

  v_audit_id := public.competition_assignment_write_audit(
    p_tenant_id, p_tournament_id, p_match_id, v_row.id,
    v_old, p_new_referee_user_id, 'REPLACE',
    v_actor, p_reason, v_boundary->>'lifecycleState', trim(p_idempotency_key),
    p_expected_version, v_new_version,
    coalesce(p_emergency_replacement, false),
    v_payload || jsonb_build_object(
      'previousAssignmentId', v_active.id,
      'emergencyReplacement', coalesce(p_emergency_replacement, false)
    )
  );

  perform public.competition_assignment_remember_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key),
    'REPLACE', v_hash, v_row.id, v_new_version
  );

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'assignmentId', v_row.id,
    'previousAssignmentId', v_active.id,
    'version', v_new_version,
    'previousVersion', p_expected_version,
    'matchId', p_match_id,
    'role', v_role,
    'oldRefereeUserId', v_old,
    'newRefereeUserId', p_new_referee_user_id,
    'status', 'active',
    'operation', 'REPLACE',
    'emergencyReplacement', coalesce(p_emergency_replacement, false),
    'auditId', v_audit_id
  );
end;
$$;

revoke all on function public.competition_replace_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.competition_replace_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, boolean, jsonb
) to service_role;

-- ─────────────────────────────────────────────────────────────────
-- D3) competition_unassign_referee (revoke; keep history row)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.competition_unassign_referee(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_role text default 'REFEREE',
  p_expected_version integer default null,
  p_idempotency_key text default null,
  p_actor_id uuid default null,
  p_reason text default null,
  p_lifecycle_state text default null,
  p_command_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor uuid;
  v_hash text;
  v_idem jsonb;
  v_active public.referee_assignments;
  v_new_version integer;
  v_audit_id uuid;
  v_payload jsonb;
  v_old uuid;
  v_boundary jsonb;
begin
  if nullif(trim(coalesce(p_tenant_id, '')), '') is null
     or nullif(trim(coalesce(p_tournament_id, '')), '') is null
     or nullif(trim(coalesce(p_match_id, '')), '') is null then
    raise exception 'INVALID_INPUT'
      using detail = 'tenant_id, tournament_id, match_id required';
  end if;

  if p_expected_version is null then
    raise exception 'EXPECTED_VERSION_REQUIRED';
  end if;

  v_role := public.competition_assignment_normalize_role(p_role);
  if v_role is null then
    raise exception 'INVALID_INPUT' using detail = format('unsupported role=%s', p_role);
  end if;

  v_boundary := public.competition_assignment_assert_mutation_boundary(
    p_tenant_id, p_tournament_id, p_match_id, p_actor_id, 'UNASSIGN', false
  );
  v_actor := (v_boundary->>'actorId')::uuid;

  v_payload := jsonb_build_object(
    'operation', 'UNASSIGN',
    'tenantId', p_tenant_id,
    'tournamentId', p_tournament_id,
    'matchId', p_match_id,
    'role', v_role,
    'expectedVersion', p_expected_version,
    'lifecycleState', v_boundary->>'lifecycleState',
    'commandMetadata', coalesce(p_command_metadata, '{}'::jsonb),
    'originatingActorId', v_actor,
    'trustedServerBoundary', 'competition-referee-assignment'
  );
  v_hash := public.competition_assignment_payload_hash(v_payload);

  perform pg_advisory_xact_lock(
    hashtext(p_tenant_id || '::' || p_tournament_id || '::' || p_match_id || '::' || v_role)
  );

  v_idem := public.competition_assignment_check_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key), v_hash
  );
  if coalesce((v_idem->>'replay')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_idem->>'assignmentId',
      'version', (v_idem->>'version')::integer,
      'matchId', p_match_id,
      'role', v_role,
      'operation', 'UNASSIGN',
      'status', 'revoked'
    );
  end if;

  select * into v_active
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.role = v_role
    and ra.status = 'active'
  for update;

  if v_active.id is null then
    raise exception 'NO_ACTIVE_ASSIGNMENT'
      using detail = 'No active assignment to unassign';
  end if;

  if v_active.version is distinct from p_expected_version then
    raise exception 'STALE_WRITE'
      using detail = format('expected=%s actual=%s', p_expected_version, v_active.version);
  end if;

  v_old := v_active.referee_user_id;
  v_new_version := p_expected_version + 1;

  -- Keep history row; mark revoked and advance scope version for CAS continuum.
  update public.referee_assignments ra
  set status = 'revoked',
      version = v_new_version,
      revoked_at = now(),
      revoked_by = v_actor,
      revoke_reason = coalesce(p_reason, 'competition_unassign'),
      updated_at = now()
  where ra.id = v_active.id
  returning * into v_active;

  v_audit_id := public.competition_assignment_write_audit(
    p_tenant_id, p_tournament_id, p_match_id, v_active.id,
    v_old, null, 'UNASSIGN',
    v_actor, p_reason, v_boundary->>'lifecycleState', trim(p_idempotency_key),
    p_expected_version, v_new_version, false,
    v_payload
  );

  perform public.competition_assignment_remember_idempotency(
    p_tenant_id, p_tournament_id, trim(p_idempotency_key),
    'UNASSIGN', v_hash, v_active.id, v_new_version
  );

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'assignmentId', v_active.id,
    'version', v_new_version,
    'previousVersion', p_expected_version,
    'matchId', p_match_id,
    'role', v_role,
    'oldRefereeUserId', v_old,
    'status', 'revoked',
    'operation', 'UNASSIGN',
    'auditId', v_audit_id
  );
end;
$$;

revoke all on function public.competition_unassign_referee(
  text, text, text, text, integer, text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.competition_unassign_referee(
  text, text, text, text, integer, text, uuid, text, text, jsonb
) to service_role;

commit;

select 'APPLY_COMPLETE core13-canonical-assignment-runtime-closure-01' as status;

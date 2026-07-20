-- =============================================================================
-- CORE-03 Phase 1F — Registration & Eligibility Persistence Foundation
-- =============================================================================
-- Ownership: Core-03 (registration-eligibility)
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- Status: AUTHORIZED FOR AUTHORING ONLY — DO NOT APPLY
-- Applied: false
-- Environments: NONE (no Staging / Production / local apply by this phase)
--
-- Owner architecture decisions (Phase 1F condition closure):
--   TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
--     Tenant-scoped client RLS remains deferred until the canonical
--     tenant-to-competition ownership model is approved. Do not author
--     policies that pretend ownership mapping is already approved.
--   CORE02_ENTRY_CREATION = DEFERRED_FAIL_CLOSED
--     No Entry tables, handoff RPCs, or Entry activation flags in this SQL.
--   SQL_APPLY = DEFERRED_STAGING_FIRST_GATE
--     Apply only under a separate Staging-first rollout gate + Owner GO.
--
-- Prerequisites (documentation only):
--   - Core-03 Phases 1A–1E merged
--   - Backup / restore plan approved before any future Staging apply
--   - Staging-first + Production owner approval required for any future apply
--
-- Does NOT:
--   - alter legacy Phase 3C registration tables
--   - create Core-02 Entry tables or handoff RPCs
--   - reference unmerged sibling schemas
--   - grant client write access to audit or privileged tables
--   - infer tenant from first row, auth.uid() without approved mapping,
--     default tenant, venue fallback, or unscoped request
--
-- Tenant / RLS (fail-closed default):
--   Tables include optional tenant_id for future binding only.
--   RLS enabled on every Phase 1F table.
--   Deny-all policies only (USING (false) / WITH CHECK (false)).
--   No USING (true) / WITH CHECK (true).
--   Client (anon/authenticated) grants revoked.
--   Service-role bypasses RLS by design for future privileged writers.
--   TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
-- =============================================================================

-- ─── 1. Competition registrations ───────────────────────────────────────────
create table if not exists public.core03_competition_registrations (
  id text primary key,
  registration_request_id text not null,
  idempotency_key text,
  competition_id text not null,
  division_id text,
  tenant_id text,
  status text not null,
  target_type text not null,
  target_stable_identity text not null,
  identity_key text,
  applicant_json jsonb,
  target_json jsonb not null default '{}'::jsonb,
  lifecycle_timestamps_json jsonb not null default '{}'::jsonb,
  state_version integer not null default 0,
  source_version integer,
  created_at timestamptz,
  updated_at timestamptz,
  correlation_id text,
  request_id text,
  handoff_pending boolean not null default false,
  entry_id text,
  eligibility_decision_id text,
  payload_json jsonb,
  constraint core03_registrations_state_version_chk check (state_version >= 0),
  constraint core03_registrations_status_chk check (
    status in (
      'DRAFT','SUBMITTED','UNDER_REVIEW','CONDITIONAL','WAITLISTED',
      'APPROVED','REJECTED','WITHDRAWN','CANCELLED','EXPIRED'
    )
  )
);

comment on table public.core03_competition_registrations is
  'Core-03 owned competition registration aggregate. Not Core-02 Entry. Phase 1F.';

create unique index if not exists core03_registrations_request_id_uidx
  on public.core03_competition_registrations (registration_request_id);

create unique index if not exists core03_registrations_idempotency_uidx
  on public.core03_competition_registrations (idempotency_key)
  where idempotency_key is not null;

-- Active identity uniqueness within competition/division scope (non-terminal).
create unique index if not exists core03_registrations_active_identity_uidx
  on public.core03_competition_registrations (
    competition_id,
    coalesce(division_id, 'NONE'),
    target_stable_identity
  )
  where status not in ('APPROVED','REJECTED','WITHDRAWN','CANCELLED','EXPIRED');

create index if not exists core03_registrations_competition_idx
  on public.core03_competition_registrations (competition_id, division_id);

-- ─── 2. Registration / evaluation / capacity idempotency ────────────────────
create table if not exists public.core03_registration_idempotency (
  idempotency_key text primary key,
  namespace text not null,
  registration_id text not null,
  registration_request_id text not null,
  competition_id text not null,
  division_id text,
  tenant_id text,
  target_type text not null,
  target_stable_identity text not null,
  created_at timestamptz not null,
  request_fingerprint jsonb,
  constraint core03_idempotency_namespace_chk check (
    namespace in (
      'REG_IDEMP',
      'EVAL_IDEMP',
      'CAPACITY_WAITLIST'
    )
  )
);

comment on table public.core03_registration_idempotency is
  'Core-03 namespaced idempotency records (registration, evaluation, capacity/waitlist).';

create index if not exists core03_idempotency_registration_idx
  on public.core03_registration_idempotency (registration_id);

-- ─── 3. Eligibility decisions / evidence ────────────────────────────────────
create table if not exists public.core03_eligibility_evidence (
  id text primary key,
  decision_id text not null,
  evaluation_request_id text not null,
  registration_id text not null,
  competition_id text not null,
  division_id text,
  tenant_id text,
  outcome text not null,
  evaluator_version text not null,
  rule_set_id text,
  rule_set_version text,
  policy_id text,
  policy_version text,
  required_check_types jsonb not null default '[]'::jsonb,
  check_results_json jsonb not null default '[]'::jsonb,
  reasons_json jsonb not null default '[]'::jsonb,
  evidence_metadata_json jsonb,
  evaluated_at timestamptz not null,
  canonical_request_fingerprint text,
  correlation_id text,
  request_id text,
  created_at timestamptz,
  updated_at timestamptz,
  constraint core03_eligibility_outcome_chk check (
    outcome in (
      'ELIGIBLE','INELIGIBLE','CONDITIONAL','MANUAL_REVIEW_REQUIRED'
    )
  )
);

comment on table public.core03_eligibility_evidence is
  'Core-03 eligibility evaluation evidence. Ordered reasons preserved in reasons_json. No secrets.';

create unique index if not exists core03_eligibility_eval_request_uidx
  on public.core03_eligibility_evidence (evaluation_request_id);

create unique index if not exists core03_eligibility_fingerprint_uidx
  on public.core03_eligibility_evidence (canonical_request_fingerprint)
  where canonical_request_fingerprint is not null;

create index if not exists core03_eligibility_registration_idx
  on public.core03_eligibility_evidence (registration_id, evaluated_at desc);

-- ─── 4. Capacity state ──────────────────────────────────────────────────────
create table if not exists public.core03_capacity_state (
  scope_key text primary key,
  competition_id text not null,
  division_id text,
  tenant_id text,
  configured_limit integer,
  used_count integer not null default 0,
  reserved_count integer not null default 0,
  state_version integer not null default 0,
  source_version integer,
  updated_at timestamptz,
  constraint core03_capacity_non_negative_chk check (
    used_count >= 0
    and reserved_count >= 0
    and state_version >= 0
    and (configured_limit is null or configured_limit >= 0)
  ),
  constraint core03_capacity_limit_chk check (
    configured_limit is null
    or (used_count + reserved_count) <= configured_limit
  )
);

comment on table public.core03_capacity_state is
  'Core-03 capacity counters by competition/division scope. Optimistic concurrency via state_version.';

create index if not exists core03_capacity_competition_idx
  on public.core03_capacity_state (competition_id, division_id);

-- ─── 5. Capacity reservations ───────────────────────────────────────────────
create table if not exists public.core03_capacity_reservations (
  reservation_id text primary key,
  registration_id text not null,
  competition_id text not null,
  division_id text,
  tenant_id text,
  status text not null,
  reserved_at timestamptz not null,
  released_at timestamptz,
  release_reason text,
  request_id text,
  operation_fingerprint text,
  state_version integer not null default 0,
  source_version integer,
  actor_id text,
  constraint core03_reservation_status_chk check (status in ('ACTIVE','RELEASED')),
  constraint core03_reservation_version_chk check (state_version >= 0)
);

comment on table public.core03_capacity_reservations is
  'Core-03 capacity reservations. At most one ACTIVE reservation per registration.';

create unique index if not exists core03_reservation_active_registration_uidx
  on public.core03_capacity_reservations (registration_id)
  where status = 'ACTIVE';

create index if not exists core03_reservation_competition_idx
  on public.core03_capacity_reservations (competition_id, division_id);

-- ─── 6. Waitlist entries ────────────────────────────────────────────────────
create table if not exists public.core03_waitlist_entries (
  waitlist_entry_id text primary key,
  registration_id text not null,
  competition_id text not null,
  division_id text,
  tenant_id text,
  status text not null,
  priority_rank numeric not null default 0,
  submitted_at timestamptz,
  waitlisted_at timestamptz not null,
  withdrawn_at timestamptz,
  promoted_at timestamptz,
  waitlist_version integer not null default 0,
  operation_request_id text,
  operation_fingerprint text,
  actor_id text,
  metadata_json jsonb,
  constraint core03_waitlist_status_chk check (
    status in ('ACTIVE','WITHDRAWN','PROMOTED')
  ),
  constraint core03_waitlist_version_chk check (waitlist_version >= 0)
);

comment on table public.core03_waitlist_entries is
  'Core-03 waitlist entries. Position is derived from ordered ACTIVE rows, not authoritative mutable rank.';

create unique index if not exists core03_waitlist_active_registration_uidx
  on public.core03_waitlist_entries (registration_id)
  where status = 'ACTIVE';

create index if not exists core03_waitlist_order_idx
  on public.core03_waitlist_entries (
    competition_id,
    coalesce(division_id, 'NONE'),
    priority_rank,
    waitlisted_at,
    waitlist_entry_id
  )
  where status = 'ACTIVE';

-- ─── 7. Append-only audit events ────────────────────────────────────────────
create table if not exists public.core03_registration_audit_events (
  id text primary key,
  registration_id text not null,
  competition_id text,
  division_id text,
  tenant_id text,
  event_type text not null,
  operation text,
  actor_id text,
  from_status text,
  to_status text,
  decision_id text,
  eligibility_decision_id text,
  capacity_snapshot_id text,
  reservation_id text,
  waitlist_entry_id text,
  reason_codes text[] not null default '{}',
  request_id text,
  correlation_id text,
  service_version text,
  occurred_at timestamptz not null,
  reconciliation_required boolean not null default false,
  partial_success_json jsonb,
  payload_json jsonb
);

comment on table public.core03_registration_audit_events is
  'Core-03 append-only registration audit. Immutable after insert. No secrets/stack traces.';

create index if not exists core03_audit_registration_idx
  on public.core03_registration_audit_events (registration_id, occurred_at);

create index if not exists core03_audit_competition_idx
  on public.core03_registration_audit_events (competition_id, occurred_at);

-- Immutable audit protection: block UPDATE/DELETE via trigger
create or replace function public.core03_reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'core03_registration_audit_events is append-only (Core-03 Phase 1F)';
end;
$$;

drop trigger if exists core03_audit_no_update on public.core03_registration_audit_events;
create trigger core03_audit_no_update
  before update on public.core03_registration_audit_events
  for each row execute function public.core03_reject_audit_mutation();

drop trigger if exists core03_audit_no_delete on public.core03_registration_audit_events;
create trigger core03_audit_no_delete
  before delete on public.core03_registration_audit_events
  for each row execute function public.core03_reject_audit_mutation();

-- ─── 8. Partial-success / reconciliation records ────────────────────────────
create table if not exists public.core03_persistence_reconciliation (
  id text primary key,
  operation text not null,
  registration_id text,
  competition_id text,
  division_id text,
  tenant_id text,
  completed_steps text[] not null default '{}',
  failed_steps text[] not null default '{}',
  reconciliation_required boolean not null default true,
  error_message text,
  persistence_version text not null default 'core03-persistence-1.0.0',
  created_at timestamptz,
  resolved_at timestamptz,
  payload_json jsonb
);

comment on table public.core03_persistence_reconciliation is
  'Core-03 partial-success reconciliation metadata when multi-step writes cannot roll back.';

-- ─── 9. RLS — fail closed (service-role only writes) ────────────────────────
-- TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
-- Every Phase 1F table: RLS on + deny-all + revoke client grants.
-- No permissive client policies. No inferred tenant fallback.
alter table public.core03_competition_registrations enable row level security;
alter table public.core03_registration_idempotency enable row level security;
alter table public.core03_eligibility_evidence enable row level security;
alter table public.core03_capacity_state enable row level security;
alter table public.core03_capacity_reservations enable row level security;
alter table public.core03_waitlist_entries enable row level security;
alter table public.core03_registration_audit_events enable row level security;
alter table public.core03_persistence_reconciliation enable row level security;

revoke all on public.core03_competition_registrations from anon, authenticated;
revoke all on public.core03_registration_idempotency from anon, authenticated;
revoke all on public.core03_eligibility_evidence from anon, authenticated;
revoke all on public.core03_capacity_state from anon, authenticated;
revoke all on public.core03_capacity_reservations from anon, authenticated;
revoke all on public.core03_waitlist_entries from anon, authenticated;
revoke all on public.core03_registration_audit_events from anon, authenticated;
revoke all on public.core03_persistence_reconciliation from anon, authenticated;

-- Deny-all policies (no USING (true) / WITH CHECK (true))
drop policy if exists core03_registrations_deny_all on public.core03_competition_registrations;
create policy core03_registrations_deny_all on public.core03_competition_registrations
  for all using (false) with check (false);

drop policy if exists core03_idempotency_deny_all on public.core03_registration_idempotency;
create policy core03_idempotency_deny_all on public.core03_registration_idempotency
  for all using (false) with check (false);

drop policy if exists core03_eligibility_deny_all on public.core03_eligibility_evidence;
create policy core03_eligibility_deny_all on public.core03_eligibility_evidence
  for all using (false) with check (false);

drop policy if exists core03_capacity_deny_all on public.core03_capacity_state;
create policy core03_capacity_deny_all on public.core03_capacity_state
  for all using (false) with check (false);

drop policy if exists core03_reservation_deny_all on public.core03_capacity_reservations;
create policy core03_reservation_deny_all on public.core03_capacity_reservations
  for all using (false) with check (false);

drop policy if exists core03_waitlist_deny_all on public.core03_waitlist_entries;
create policy core03_waitlist_deny_all on public.core03_waitlist_entries
  for all using (false) with check (false);

drop policy if exists core03_audit_deny_all on public.core03_registration_audit_events;
create policy core03_audit_deny_all on public.core03_registration_audit_events
  for all using (false) with check (false);

drop policy if exists core03_reconciliation_deny_all on public.core03_persistence_reconciliation;
create policy core03_reconciliation_deny_all on public.core03_persistence_reconciliation
  for all using (false) with check (false);

-- =============================================================================
-- END Phase 1F migration
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
-- CORE02_ENTRY_CREATION = DEFERRED_FAIL_CLOSED
-- =============================================================================

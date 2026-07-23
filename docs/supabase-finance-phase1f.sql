-- =============================================================================
-- PICK_VN — Finance Foundation Phase 1F
-- Operational Finance persistence migration package
-- =============================================================================
-- Filename: docs/supabase-finance-phase1f.sql
-- Rollback: docs/supabase-finance-phase1f-rollback.sql
--
-- Namespace decision:
--   public.finance_* table prefixes (not SaaS Billing public.invoices/payments).
--   Dedicated `finance` schema was considered; repository convention uses public
--   schema with module-prefixed tables (billing, notification, identity).
--
-- Prerequisites (runtime apply):
--   docs/supabase-rbac.sql (or rbac-v4) providing:
--     public.user_venue_id(), public.is_super_admin(), public.user_has_permission(text)
--   Permissions finance.view / finance.edit already catalogued in identity SQL.
--
-- Soft references:
--   tenant_id and subject_* columns are soft references (IDs only). No FK to
--   venues/clubs/players/bookings/competitions — ownership not Finance-canonical
--   and cascade/restrict behavior must not destroy financial evidence.
--
-- Money:
--   amount_* columns are bigint minor units (never floating/numeric money).
--   currency constrained to uppercase 'VND' in v1; extend via later migration.
--
-- Invoice totals vs item lines:
--   Cannot safely enforce sum(items.line_total_minor) = invoices.amount_minor
--   with a simple CHECK across tables. Application + transaction UoW remain
--   authoritative; DB protects non-negative/positive money and currency only.
--
-- Optimistic concurrency (future adapter pattern):
--   UPDATE ... SET version = version + 1, updated_at = now()
--   WHERE id = $id AND tenant_id = $tenant AND version = $expected_version;
--
-- Append-only finance_events:
--   No UPDATE/DELETE policies for authenticated. Service-role bypass is NOT
--   application authorization. Maintenance deletes require elevated ops process.
--
-- Status: SQL authored / statically verified.
--   Applied to Staging only (Phase 1H) — READY WITH CONDITIONS.
--   Production was not touched / not authorized.
--   Runtime defaults remain disabled. Foundation is not a business integration.
-- =============================================================================

-- ─── 1. finance_fee_definitions ─────────────────────────────────────────────
create table if not exists public.finance_fee_definitions (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  status text not null default 'DRAFT',
  fee_type text not null,
  name text not null,
  description text,
  amount_minor bigint not null,
  currency text not null default 'VND',
  policy_version integer not null default 1,
  effective_from timestamptz,
  effective_to timestamptz,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  correlation_id text,
  causation_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_fee_definitions_pkey primary key (id),
  constraint finance_fee_definitions_tenant_id_id_key unique (tenant_id, id),
  constraint finance_fee_definitions_version_check check (version >= 1),
  constraint finance_fee_definitions_status_check check (
    status in ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')
  ),
  constraint finance_fee_definitions_fee_type_check check (
    fee_type in (
      'COMPETITION',
      'TOURNAMENT_ENTRY',
      'VENUE_BOOKING',
      'COURT_BOOKING',
      'CLUB_MEMBERSHIP',
      'OPERATIONAL',
      'OTHER'
    )
  ),
  constraint finance_fee_definitions_amount_minor_check check (amount_minor >= 0),
  constraint finance_fee_definitions_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_fee_definitions_policy_version_check check (policy_version >= 1),
  constraint finance_fee_definitions_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_fee_definitions_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_fee_definitions_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  )
);

comment on table public.finance_fee_definitions is
  'Finance operational fee definitions. Separated from SaaS Billing plans.';

create index if not exists finance_fee_definitions_tenant_status_idx
  on public.finance_fee_definitions (tenant_id, status, created_at desc);

create index if not exists finance_fee_definitions_tenant_subject_venue_idx
  on public.finance_fee_definitions (tenant_id, subject_venue_id)
  where subject_venue_id is not null;

create index if not exists finance_fee_definitions_tenant_subject_booking_idx
  on public.finance_fee_definitions (tenant_id, subject_booking_id)
  where subject_booking_id is not null;

-- ─── 2. finance_audit_evidence ──────────────────────────────────────────────
create table if not exists public.finance_audit_evidence (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  evidence_type text not null,
  provider_code text,
  external_reference text,
  captured_at timestamptz not null,
  verification_status text not null default 'UNVERIFIED',
  integrity_digest text,
  redaction_classification text not null default 'PARTIAL',
  retention_classification text not null default 'STANDARD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_audit_evidence_pkey primary key (id),
  constraint finance_audit_evidence_tenant_id_id_key unique (tenant_id, id),
  constraint finance_audit_evidence_version_check check (version >= 1),
  constraint finance_audit_evidence_verification_status_check check (
    verification_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')
  ),
  constraint finance_audit_evidence_redaction_check check (
    redaction_classification in ('NONE', 'PARTIAL', 'FULL')
  ),
  constraint finance_audit_evidence_retention_check check (
    retention_classification in ('STANDARD', 'EXTENDED', 'LEGAL_HOLD')
  ),
  constraint finance_audit_evidence_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_audit_evidence_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_audit_evidence_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload', 'password'
    ])
  )
);

comment on table public.finance_audit_evidence is
  'Normalized Finance audit evidence references only. No blobs, secrets, CVV, or unrestricted provider payloads.';

create index if not exists finance_audit_evidence_tenant_captured_idx
  on public.finance_audit_evidence (tenant_id, captured_at desc);

create index if not exists finance_audit_evidence_tenant_external_ref_idx
  on public.finance_audit_evidence (tenant_id, provider_code, external_reference)
  where external_reference is not null;

-- ─── 3. finance_obligations ─────────────────────────────────────────────────
create table if not exists public.finance_obligations (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  status text not null default 'CREATED',
  amount_minor bigint not null,
  currency text not null default 'VND',
  settled_amount_minor bigint not null default 0,
  fee_id text,
  invoice_id text,
  business_reference text,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  due_at timestamptz,
  settlement_started boolean not null default false,
  correlation_id text,
  causation_id text,
  idempotency_key text,
  evidence_refs text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_obligations_pkey primary key (id),
  constraint finance_obligations_tenant_id_id_key unique (tenant_id, id),
  constraint finance_obligations_version_check check (version >= 1),
  constraint finance_obligations_status_check check (
    status in ('CREATED', 'OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED', 'EXPIRED')
  ),
  constraint finance_obligations_amount_minor_check check (amount_minor >= 0),
  constraint finance_obligations_settled_amount_minor_check check (settled_amount_minor >= 0),
  constraint finance_obligations_settled_lte_amount_check check (settled_amount_minor <= amount_minor),
  constraint finance_obligations_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_obligations_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_obligations_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_obligations_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  ),
  constraint finance_obligations_fee_fk foreign key (tenant_id, fee_id)
    references public.finance_fee_definitions (tenant_id, id)
    on delete restrict
);

comment on table public.finance_obligations is
  'Finance financial obligations. Soft subject_* refs; fee_id FK is Finance-owned.';

create index if not exists finance_obligations_tenant_status_idx
  on public.finance_obligations (tenant_id, status, created_at desc);

create unique index if not exists finance_obligations_tenant_business_ref_uidx
  on public.finance_obligations (tenant_id, business_reference)
  where business_reference is not null;

create index if not exists finance_obligations_tenant_subject_entry_idx
  on public.finance_obligations (tenant_id, subject_entry_id)
  where subject_entry_id is not null;

create index if not exists finance_obligations_tenant_subject_booking_idx
  on public.finance_obligations (tenant_id, subject_booking_id)
  where subject_booking_id is not null;

-- ─── 4. finance_invoices ────────────────────────────────────────────────────
create table if not exists public.finance_invoices (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  status text not null default 'DRAFT',
  invoice_number text,
  amount_minor bigint not null,
  currency text not null default 'VND',
  paid_amount_minor bigint not null default 0,
  business_reference text,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  correlation_id text,
  causation_id text,
  idempotency_key text,
  evidence_refs text[] not null default '{}',
  issued_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_invoices_pkey primary key (id),
  constraint finance_invoices_tenant_id_id_key unique (tenant_id, id),
  constraint finance_invoices_version_check check (version >= 1),
  constraint finance_invoices_status_check check (
    status in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID')
  ),
  constraint finance_invoices_amount_minor_check check (amount_minor >= 0),
  constraint finance_invoices_paid_amount_minor_check check (paid_amount_minor >= 0),
  constraint finance_invoices_paid_lte_amount_check check (paid_amount_minor <= amount_minor),
  constraint finance_invoices_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_invoices_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_invoices_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_invoices_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  )
);

comment on table public.finance_invoices is
  'Operational Finance invoices. NOT SaaS Billing public.invoices. Invoice number uniqueness only when assigned (no global sequence invented).';

comment on column public.finance_invoices.amount_minor is
  'Protected by application/transaction: must equal sum of finance_invoice_items.line_total_minor. Not a cross-table CHECK.';

create index if not exists finance_invoices_tenant_status_idx
  on public.finance_invoices (tenant_id, status, created_at desc);

create unique index if not exists finance_invoices_tenant_invoice_number_uidx
  on public.finance_invoices (tenant_id, invoice_number)
  where invoice_number is not null;

create index if not exists finance_invoices_tenant_subject_customer_idx
  on public.finance_invoices (tenant_id, subject_customer_id)
  where subject_customer_id is not null;

-- Link obligation.invoice_id after invoices exist (soft nullable FK within Finance)
alter table public.finance_obligations
  drop constraint if exists finance_obligations_invoice_fk;

alter table public.finance_obligations
  add constraint finance_obligations_invoice_fk foreign key (tenant_id, invoice_id)
    references public.finance_invoices (tenant_id, id)
    on delete restrict;

-- ─── 5. finance_invoice_items ───────────────────────────────────────────────
create table if not exists public.finance_invoice_items (
  id text not null,
  tenant_id text not null,
  invoice_id text not null,
  description text,
  quantity integer not null default 1,
  unit_amount_minor bigint not null,
  line_total_minor bigint not null,
  currency text not null default 'VND',
  fee_id text,
  obligation_id text,
  created_at timestamptz not null default now(),
  constraint finance_invoice_items_pkey primary key (id),
  constraint finance_invoice_items_tenant_id_id_key unique (tenant_id, id),
  constraint finance_invoice_items_quantity_check check (quantity >= 1),
  constraint finance_invoice_items_unit_amount_minor_check check (unit_amount_minor >= 0),
  constraint finance_invoice_items_line_total_minor_check check (line_total_minor >= 0),
  constraint finance_invoice_items_line_math_check check (
    line_total_minor = unit_amount_minor * quantity
  ),
  constraint finance_invoice_items_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_invoice_items_invoice_fk foreign key (tenant_id, invoice_id)
    references public.finance_invoices (tenant_id, id)
    on delete restrict,
  constraint finance_invoice_items_fee_fk foreign key (tenant_id, fee_id)
    references public.finance_fee_definitions (tenant_id, id)
    on delete restrict,
  constraint finance_invoice_items_obligation_fk foreign key (tenant_id, obligation_id)
    references public.finance_obligations (tenant_id, id)
    on delete restrict
);

comment on table public.finance_invoice_items is
  'Finance invoice line items. Cross-invoice total aggregation is application-enforced.';

create index if not exists finance_invoice_items_tenant_invoice_idx
  on public.finance_invoice_items (tenant_id, invoice_id);

-- ─── 6. finance_payments ────────────────────────────────────────────────────
create table if not exists public.finance_payments (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  payment_reference text not null,
  status text not null default 'PENDING',
  amount_minor bigint not null,
  currency text not null default 'VND',
  refunded_amount_minor bigint not null default 0,
  invoice_id text,
  obligation_id text,
  provider_code text,
  provider_transaction_reference text,
  confirmed_attempt_id text,
  idempotency_key text,
  evidence_ref text,
  audit_evidence_ref text,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  correlation_id text,
  causation_id text,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_payments_pkey primary key (id),
  constraint finance_payments_tenant_id_id_key unique (tenant_id, id),
  constraint finance_payments_version_check check (version >= 1),
  constraint finance_payments_status_check check (
    status in ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED')
  ),
  constraint finance_payments_amount_minor_check check (amount_minor >= 0),
  constraint finance_payments_refunded_amount_minor_check check (refunded_amount_minor >= 0),
  constraint finance_payments_refunded_lte_amount_check check (refunded_amount_minor <= amount_minor),
  constraint finance_payments_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_payments_confirmed_requires_evidence_check check (
    status <> 'CONFIRMED' or evidence_ref is not null
  ),
  constraint finance_payments_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_payments_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_payments_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  ),
  constraint finance_payments_invoice_fk foreign key (tenant_id, invoice_id)
    references public.finance_invoices (tenant_id, id)
    on delete restrict,
  constraint finance_payments_obligation_fk foreign key (tenant_id, obligation_id)
    references public.finance_obligations (tenant_id, id)
    on delete restrict,
  constraint finance_payments_audit_evidence_fk foreign key (tenant_id, audit_evidence_ref)
    references public.finance_audit_evidence (tenant_id, id)
    on delete restrict
);

comment on table public.finance_payments is
  'Operational Finance payments. NOT SaaS Billing public.payments. No raw_payload column.';

create index if not exists finance_payments_tenant_status_idx
  on public.finance_payments (tenant_id, status, created_at desc);

create unique index if not exists finance_payments_tenant_provider_txn_uidx
  on public.finance_payments (tenant_id, provider_code, provider_transaction_reference)
  where provider_transaction_reference is not null;

create index if not exists finance_payments_tenant_invoice_idx
  on public.finance_payments (tenant_id, invoice_id)
  where invoice_id is not null;

create index if not exists finance_payments_tenant_obligation_idx
  on public.finance_payments (tenant_id, obligation_id)
  where obligation_id is not null;

-- ─── 7. finance_payment_attempts ────────────────────────────────────────────
create table if not exists public.finance_payment_attempts (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  payment_id text not null,
  attempt_number integer not null default 1,
  status text not null default 'PENDING',
  amount_minor bigint not null,
  currency text not null default 'VND',
  provider_code text,
  provider_transaction_reference text,
  idempotency_key text,
  evidence_ref text,
  audit_evidence_ref text,
  correlation_id text,
  causation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_payment_attempts_pkey primary key (id),
  constraint finance_payment_attempts_tenant_id_id_key unique (tenant_id, id),
  constraint finance_payment_attempts_version_check check (version >= 1),
  constraint finance_payment_attempts_attempt_number_check check (attempt_number >= 1),
  constraint finance_payment_attempts_status_check check (
    status in ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED')
  ),
  constraint finance_payment_attempts_amount_minor_check check (amount_minor >= 0),
  constraint finance_payment_attempts_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_payment_attempts_confirmed_requires_evidence_check check (
    status <> 'CONFIRMED' or evidence_ref is not null
  ),
  constraint finance_payment_attempts_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_payment_attempts_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_payment_attempts_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  ),
  constraint finance_payment_attempts_payment_fk foreign key (tenant_id, payment_id)
    references public.finance_payments (tenant_id, id)
    on delete restrict,
  constraint finance_payment_attempts_audit_evidence_fk foreign key (tenant_id, audit_evidence_ref)
    references public.finance_audit_evidence (tenant_id, id)
    on delete restrict
);

comment on table public.finance_payment_attempts is
  'Finance payment attempts. Duplicate attempt identity prevented per tenant.';

create unique index if not exists finance_payment_attempts_tenant_payment_number_uidx
  on public.finance_payment_attempts (tenant_id, payment_id, attempt_number);

create index if not exists finance_payment_attempts_tenant_payment_idx
  on public.finance_payment_attempts (tenant_id, payment_id);

create unique index if not exists finance_payment_attempts_tenant_provider_txn_uidx
  on public.finance_payment_attempts (tenant_id, provider_code, provider_transaction_reference)
  where provider_transaction_reference is not null;

-- ─── 8. finance_receipts ────────────────────────────────────────────────────
create table if not exists public.finance_receipts (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  payment_id text not null,
  payment_reference text not null,
  amount_minor bigint not null,
  currency text not null default 'VND',
  evidence_ref text not null,
  audit_evidence_ref text,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  correlation_id text,
  causation_id text,
  idempotency_key text,
  issued_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_receipts_pkey primary key (id),
  constraint finance_receipts_tenant_id_id_key unique (tenant_id, id),
  constraint finance_receipts_version_check check (version >= 1),
  constraint finance_receipts_amount_minor_check check (amount_minor >= 0),
  constraint finance_receipts_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_receipts_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_receipts_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_receipts_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  ),
  constraint finance_receipts_payment_fk foreign key (tenant_id, payment_id)
    references public.finance_payments (tenant_id, id)
    on delete restrict,
  constraint finance_receipts_audit_evidence_fk foreign key (tenant_id, audit_evidence_ref)
    references public.finance_audit_evidence (tenant_id, id)
    on delete restrict
);

comment on table public.finance_receipts is
  'Authoritative Finance receipts. One receipt per payment (tenant-scoped). Immutable after insert at policy layer.';

create unique index if not exists finance_receipts_tenant_payment_uidx
  on public.finance_receipts (tenant_id, payment_id);

create index if not exists finance_receipts_tenant_issued_idx
  on public.finance_receipts (tenant_id, issued_at desc);

-- ─── 9. finance_refunds ─────────────────────────────────────────────────────
create table if not exists public.finance_refunds (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  payment_id text not null,
  status text not null default 'REQUESTED',
  amount_minor bigint not null,
  currency text not null default 'VND',
  reason text,
  evidence_ref text,
  audit_evidence_ref text,
  provider_code text,
  provider_refund_reference text,
  subject_venue_id text,
  subject_club_id text,
  subject_competition_id text,
  subject_registration_id text,
  subject_entry_id text,
  subject_booking_id text,
  subject_player_id text,
  subject_customer_id text,
  correlation_id text,
  causation_id text,
  idempotency_key text,
  requested_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_refunds_pkey primary key (id),
  constraint finance_refunds_tenant_id_id_key unique (tenant_id, id),
  constraint finance_refunds_version_check check (version >= 1),
  constraint finance_refunds_status_check check (
    status in ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED')
  ),
  constraint finance_refunds_amount_minor_positive_check check (amount_minor > 0),
  constraint finance_refunds_currency_vnd_v1_check check (currency = 'VND'),
  constraint finance_refunds_completed_requires_evidence_check check (
    status <> 'COMPLETED' or evidence_ref is not null
  ),
  constraint finance_refunds_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint finance_refunds_metadata_size_check check (octet_length(metadata::text) <= 8192),
  constraint finance_refunds_no_secret_metadata_check check (
    not (metadata ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload'
    ])
  ),
  constraint finance_refunds_payment_fk foreign key (tenant_id, payment_id)
    references public.finance_payments (tenant_id, id)
    on delete restrict,
  constraint finance_refunds_audit_evidence_fk foreign key (tenant_id, audit_evidence_ref)
    references public.finance_audit_evidence (tenant_id, id)
    on delete restrict
);

comment on table public.finance_refunds is
  'Finance refunds. Partial refunds via multiple rows; amount constrained by payment refundable balance in application.';

create index if not exists finance_refunds_tenant_payment_idx
  on public.finance_refunds (tenant_id, payment_id);

create index if not exists finance_refunds_tenant_status_idx
  on public.finance_refunds (tenant_id, status, created_at desc);

create unique index if not exists finance_refunds_tenant_provider_ref_uidx
  on public.finance_refunds (tenant_id, provider_code, provider_refund_reference)
  where provider_refund_reference is not null;

-- ─── 10. finance_events (append-only) ───────────────────────────────────────
create table if not exists public.finance_events (
  id text not null,
  tenant_id text not null,
  event_type text not null,
  event_version integer not null default 1,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  correlation_id text not null,
  causation_id text,
  idempotency_key text,
  privacy_classification text not null default 'INTERNAL',
  amount_minor bigint,
  currency text,
  obligation_id text,
  invoice_id text,
  payment_id text,
  attempt_id text,
  receipt_id text,
  refund_id text,
  evidence_refs text[] not null default '{}',
  payload_schema_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint finance_events_pkey primary key (id),
  constraint finance_events_tenant_id_id_key unique (tenant_id, id),
  constraint finance_events_event_version_check check (event_version >= 1),
  constraint finance_events_payload_schema_version_check check (payload_schema_version >= 1),
  constraint finance_events_event_type_check check (
    event_type in (
      'FINANCE_OBLIGATION_CREATED',
      'INVOICE_CREATED',
      'INVOICE_ISSUED',
      'PAYMENT_PENDING',
      'PAYMENT_CONFIRMED',
      'PAYMENT_FAILED',
      'PAYMENT_CANCELLED',
      'PAYMENT_EXPIRED',
      'RECEIPT_ISSUED',
      'REFUND_REQUESTED',
      'REFUND_APPROVED',
      'REFUND_REJECTED',
      'REFUND_COMPLETED',
      'RECONCILIATION_COMPLETED',
      'FINANCIAL_ADJUSTMENT_RECORDED'
    )
  ),
  constraint finance_events_privacy_check check (
    privacy_classification in ('INTERNAL', 'RESTRICTED', 'PUBLIC')
  ),
  constraint finance_events_amount_minor_check check (amount_minor is null or amount_minor >= 0),
  constraint finance_events_currency_vnd_v1_check check (currency is null or currency = 'VND'),
  constraint finance_events_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint finance_events_payload_size_check check (octet_length(payload::text) <= 16384),
  constraint finance_events_no_secret_payload_check check (
    not (payload ?| array[
      'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
      'authorization', 'authorizationHeader', 'webhookSecret', 'cvv',
      'cardNumber', 'rawPayload', 'raw_payload', 'password'
    ])
  )
);

comment on table public.finance_events is
  'Append-only Finance events. Ordinary roles: SELECT + INSERT only. No UPDATE/DELETE policies.';

comment on column public.finance_events.payload is
  'Sanitized payload only. Forbidden: secrets, tokens, CVV, unrestricted raw provider bodies.';

create index if not exists finance_events_tenant_recorded_idx
  on public.finance_events (tenant_id, recorded_at desc);

create index if not exists finance_events_tenant_occurred_idx
  on public.finance_events (tenant_id, occurred_at desc);

create index if not exists finance_events_tenant_correlation_idx
  on public.finance_events (tenant_id, correlation_id);

create index if not exists finance_events_tenant_event_type_idx
  on public.finance_events (tenant_id, event_type, recorded_at desc);

create index if not exists finance_events_tenant_payment_idx
  on public.finance_events (tenant_id, payment_id)
  where payment_id is not null;

-- ─── 11. finance_idempotency ────────────────────────────────────────────────
create table if not exists public.finance_idempotency (
  id text not null,
  tenant_id text not null,
  version integer not null default 1,
  operation_type text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  execution_status text not null default 'STARTED',
  result_entity_type text,
  result_entity_id text,
  retention_policy_ref text not null default 'finance-idempotency-v1',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint finance_idempotency_pkey primary key (id),
  constraint finance_idempotency_tenant_op_key_uidx unique (tenant_id, operation_type, idempotency_key),
  constraint finance_idempotency_version_check check (version >= 1),
  constraint finance_idempotency_fingerprint_not_empty_check check (
    length(trim(request_fingerprint)) > 0
  ),
  constraint finance_idempotency_execution_status_check check (
    execution_status in ('STARTED', 'COMPLETED', 'FAILED', 'ABANDONED')
  ),
  constraint finance_idempotency_completed_result_check check (
    execution_status <> 'COMPLETED'
    or (result_entity_type is not null and result_entity_id is not null)
  )
);

comment on table public.finance_idempotency is
  'Durable Finance idempotency. Fingerprint + result pointer only. No raw request body / PII / secrets.';

create index if not exists finance_idempotency_tenant_status_idx
  on public.finance_idempotency (tenant_id, execution_status, created_at desc);

create index if not exists finance_idempotency_expires_idx
  on public.finance_idempotency (expires_at)
  where expires_at is not null;

-- =============================================================================
-- RLS ENABLEMENT
-- Tenant identity: public.user_venue_id() from profiles (authoritative mapping).
-- Do NOT trust client-supplied tenant_id alone — policies require
-- tenant_id = public.user_venue_id() OR is_super_admin().
-- Permission assumptions: finance.view (read), finance.edit (command writes).
-- Unresolved: finer refund-approval permission; service-role is not app auth.
-- =============================================================================

alter table public.finance_fee_definitions enable row level security;
alter table public.finance_audit_evidence enable row level security;
alter table public.finance_obligations enable row level security;
alter table public.finance_invoices enable row level security;
alter table public.finance_invoice_items enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_payment_attempts enable row level security;
alter table public.finance_receipts enable row level security;
alter table public.finance_refunds enable row level security;
alter table public.finance_events enable row level security;
alter table public.finance_idempotency enable row level security;

-- Force RLS for table owners as well (defense in depth when supported)
alter table public.finance_fee_definitions force row level security;
alter table public.finance_audit_evidence force row level security;
alter table public.finance_obligations force row level security;
alter table public.finance_invoices force row level security;
alter table public.finance_invoice_items force row level security;
alter table public.finance_payments force row level security;
alter table public.finance_payment_attempts force row level security;
alter table public.finance_receipts force row level security;
alter table public.finance_refunds force row level security;
alter table public.finance_events force row level security;
alter table public.finance_idempotency force row level security;

-- ─── Helper predicate notes (inline in policies) ────────────────────────────
-- same_tenant: tenant_id = public.user_venue_id() OR public.is_super_admin()
-- can_view:    public.user_has_permission('finance.view') OR is_super_admin()
-- can_edit:    public.user_has_permission('finance.edit') OR is_super_admin()
-- Dependency: if user_has_permission is absent at apply time, apply fails —
-- marked READY WITH CONDITIONS until rbac-v4 (or equivalent) is present.

-- fee_definitions
drop policy if exists finance_fee_definitions_select on public.finance_fee_definitions;
create policy finance_fee_definitions_select on public.finance_fee_definitions
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_fee_definitions_insert on public.finance_fee_definitions;
create policy finance_fee_definitions_insert on public.finance_fee_definitions
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_fee_definitions_update on public.finance_fee_definitions;
create policy finance_fee_definitions_update on public.finance_fee_definitions
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- audit_evidence (insert + select; no ordinary delete)
drop policy if exists finance_audit_evidence_select on public.finance_audit_evidence;
create policy finance_audit_evidence_select on public.finance_audit_evidence
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_audit_evidence_insert on public.finance_audit_evidence;
create policy finance_audit_evidence_insert on public.finance_audit_evidence
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_audit_evidence_update on public.finance_audit_evidence;
create policy finance_audit_evidence_update on public.finance_audit_evidence
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- obligations
drop policy if exists finance_obligations_select on public.finance_obligations;
create policy finance_obligations_select on public.finance_obligations
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_obligations_insert on public.finance_obligations;
create policy finance_obligations_insert on public.finance_obligations
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_obligations_update on public.finance_obligations;
create policy finance_obligations_update on public.finance_obligations
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- invoices
drop policy if exists finance_invoices_select on public.finance_invoices;
create policy finance_invoices_select on public.finance_invoices
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_invoices_insert on public.finance_invoices;
create policy finance_invoices_insert on public.finance_invoices
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_invoices_update on public.finance_invoices;
create policy finance_invoices_update on public.finance_invoices
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- invoice_items
drop policy if exists finance_invoice_items_select on public.finance_invoice_items;
create policy finance_invoice_items_select on public.finance_invoice_items
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_invoice_items_insert on public.finance_invoice_items;
create policy finance_invoice_items_insert on public.finance_invoice_items
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_invoice_items_update on public.finance_invoice_items;
create policy finance_invoice_items_update on public.finance_invoice_items
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- payments
drop policy if exists finance_payments_select on public.finance_payments;
create policy finance_payments_select on public.finance_payments
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_payments_insert on public.finance_payments;
create policy finance_payments_insert on public.finance_payments
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_payments_update on public.finance_payments;
create policy finance_payments_update on public.finance_payments
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- payment_attempts
drop policy if exists finance_payment_attempts_select on public.finance_payment_attempts;
create policy finance_payment_attempts_select on public.finance_payment_attempts
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_payment_attempts_insert on public.finance_payment_attempts;
create policy finance_payment_attempts_insert on public.finance_payment_attempts
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_payment_attempts_update on public.finance_payment_attempts;
create policy finance_payment_attempts_update on public.finance_payment_attempts
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- receipts: append-like (select + insert; no update/delete for ordinary roles)
drop policy if exists finance_receipts_select on public.finance_receipts;
create policy finance_receipts_select on public.finance_receipts
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_receipts_insert on public.finance_receipts;
create policy finance_receipts_insert on public.finance_receipts
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- refunds
drop policy if exists finance_refunds_select on public.finance_refunds;
create policy finance_refunds_select on public.finance_refunds
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_refunds_insert on public.finance_refunds;
create policy finance_refunds_insert on public.finance_refunds
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_refunds_update on public.finance_refunds;
create policy finance_refunds_update on public.finance_refunds
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- events: APPEND-ONLY for authenticated (select + insert; NO update/delete policy)
drop policy if exists finance_events_select on public.finance_events;
create policy finance_events_select on public.finance_events
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_events_insert on public.finance_events;
create policy finance_events_insert on public.finance_events
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- idempotency
drop policy if exists finance_idempotency_select on public.finance_idempotency;
create policy finance_idempotency_select on public.finance_idempotency
  for select to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.view'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_idempotency_insert on public.finance_idempotency;
create policy finance_idempotency_insert on public.finance_idempotency
  for insert to authenticated
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

drop policy if exists finance_idempotency_update on public.finance_idempotency;
create policy finance_idempotency_update on public.finance_idempotency
  for update to authenticated
  using (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  )
  with check (
    (public.is_super_admin() or public.user_has_permission('finance.edit'))
    and (public.is_super_admin() or tenant_id = public.user_venue_id())
  );

-- =============================================================================
-- GRANTS (least privilege)
-- No PUBLIC / anon financial access. No ALL to authenticated.
-- =============================================================================

revoke all on table public.finance_fee_definitions from public;
revoke all on table public.finance_audit_evidence from public;
revoke all on table public.finance_obligations from public;
revoke all on table public.finance_invoices from public;
revoke all on table public.finance_invoice_items from public;
revoke all on table public.finance_payments from public;
revoke all on table public.finance_payment_attempts from public;
revoke all on table public.finance_receipts from public;
revoke all on table public.finance_refunds from public;
revoke all on table public.finance_events from public;
revoke all on table public.finance_idempotency from public;

revoke all on table public.finance_fee_definitions from anon;
revoke all on table public.finance_audit_evidence from anon;
revoke all on table public.finance_obligations from anon;
revoke all on table public.finance_invoices from anon;
revoke all on table public.finance_invoice_items from anon;
revoke all on table public.finance_payments from anon;
revoke all on table public.finance_payment_attempts from anon;
revoke all on table public.finance_receipts from anon;
revoke all on table public.finance_refunds from anon;
revoke all on table public.finance_events from anon;
revoke all on table public.finance_idempotency from anon;

grant select on table public.finance_fee_definitions to authenticated;
grant insert, update on table public.finance_fee_definitions to authenticated;

grant select on table public.finance_audit_evidence to authenticated;
grant insert, update on table public.finance_audit_evidence to authenticated;

grant select on table public.finance_obligations to authenticated;
grant insert, update on table public.finance_obligations to authenticated;

grant select on table public.finance_invoices to authenticated;
grant insert, update on table public.finance_invoices to authenticated;

grant select on table public.finance_invoice_items to authenticated;
grant insert, update on table public.finance_invoice_items to authenticated;

grant select on table public.finance_payments to authenticated;
grant insert, update on table public.finance_payments to authenticated;

grant select on table public.finance_payment_attempts to authenticated;
grant insert, update on table public.finance_payment_attempts to authenticated;

grant select on table public.finance_receipts to authenticated;
grant insert on table public.finance_receipts to authenticated;

grant select on table public.finance_refunds to authenticated;
grant insert, update on table public.finance_refunds to authenticated;

-- Append-only events: select + insert only (no update/delete grant)
grant select on table public.finance_events to authenticated;
grant insert on table public.finance_events to authenticated;

grant select on table public.finance_idempotency to authenticated;
grant insert, update on table public.finance_idempotency to authenticated;

-- Explicit: no delete grants to authenticated on Finance tables.
-- Retention / archival: soft archive via status; hard delete is ops-only (service role).
-- WARNING: service_role bypasses RLS — application must still enforce tenant checks.

-- End of Finance Phase 1F forward migration (static authoring only).

# Finance Persistence Design (Phase 1E)

**Status:** Contract + migration design only. **No executable SQL. No staging/production apply.**

**Module:** `src/features/finance/persistence/`

---

## 1. Ownership

Finance owns **operational finance** durable persistence:

- fee definitions (financial representation)
- financial obligations
- invoices / invoice items
- payments / payment attempts
- receipts
- refunds
- finance events (append-only)
- durable idempotency records
- audit evidence references (normalized, redaction-aware)

Finance does **not** own SaaS Billing tables, marketplace payment gateway tables, subscription lifecycle tables, or finance-ledger localStorage.

---

## 2. Separation from SaaS Billing

| Concern | Canonical store |
|---------|-----------------|
| Tenant SaaS plans / trials / locks | `billing` / `subscription` |
| Operational fees, invoices, receipts, refunds | **Finance** (this design) |

Finance persistence **must not** reuse Billing tables as source of truth.

---

## 3. Proposed logical tables (no SQL)

| Logical table | PK | Tenant key | Notes |
|---------------|----|------------|-------|
| `finance_fee_definitions` | `id` | `tenant_id` | Mutable with version |
| `finance_obligations` | `id` | `tenant_id` | Mutable with version |
| `finance_invoices` | `id` | `tenant_id` | Mutable with version |
| `finance_invoice_items` | `id` | via invoice / tenant | Child of invoice |
| `finance_payments` | `id` | `tenant_id` | Mutable until terminal |
| `finance_payment_attempts` | `id` | `tenant_id` | Mutable until terminal |
| `finance_receipts` | `id` | `tenant_id` | Immutable after insert |
| `finance_refunds` | `id` | `tenant_id` | Mutable until terminal |
| `finance_events` | `id` | `tenant_id` | Append-only |
| `finance_idempotency` | `(tenant_id, operation_type, idempotency_key)` | `tenant_id` | Durable execution lock |
| `finance_audit_evidence` | `id` | `tenant_id` | Reference + digest only |

Primary keys are opaque Finance IDs (strings). Tenant key is always explicit `tenant_id`.

---

## 4. Columns (logical)

Common on mutable aggregates:

- `id`, `tenant_id`, `version`, `created_at`, `updated_at`
- lifecycle `status`
- `amount_minor` (bigint / safe integer), `currency` (uppercase ISO-4217; v1 = VND)
- `correlation_id`, `causation_id`, `idempotency_key` where applicable
- typed external references (venue/club/competition/registration/entry/booking/player/customer) — IDs only
- evidence reference IDs (not raw payloads)

Events additionally:

- `event_type`, `event_version`
- `occurred_at` vs `recorded_at`
- `privacy_classification`
- `payload_schema_version`
- safe payload (no secrets / unrestricted provider bodies)

---

## 5. Unique constraints (future database)

| Rule | Components | Tenant scope | Nullable | Conflict error | Idempotent replay | Partial unique later? |
|------|------------|--------------|----------|----------------|-------------------|------------------------|
| Idempotency | `(tenant_id, operation_type, idempotency_key)` | Yes | key NOT NULL | `FINANCE_PERSISTENCE_UNIQUENESS_CONFLICT` / fingerprint mismatch | Same fingerprint returns stored result; no version bump | No |
| Provider payment txn | `(tenant_id, provider_code, provider_transaction_reference)` | Yes | reference NULL allowed pre-assign | uniqueness conflict | Replay must resolve to same payment | **Yes** — unique where reference IS NOT NULL |
| Payment attempt reference | `(tenant_id, attempt_id)` PK; optional `(tenant_id, payment_id, attempt_number)` | Yes | attempt_number NOT NULL | uniqueness conflict | N/A | Optional |
| Receipt identity | `id` PK; `(tenant_id, payment_id)` one receipt per payment | Yes | payment_id NOT NULL | uniqueness conflict | Same payment → same receipt | No |
| Finance event id | `(tenant_id, event_id)` | Yes | NOT NULL | `FINANCE_EVENT_APPEND_CONFLICT` | Same id rejected (append-only) | No |
| Invoice number (future) | `(tenant_id, invoice_number)` | Yes | NULL until issued/assigned | uniqueness conflict | Replay returns same invoice | **Yes** — unique where number IS NOT NULL |
| Business reference (selected) | `(tenant_id, entity_type, business_reference)` where justified | Yes | NULL allowed | uniqueness conflict | Deterministic lookup | **Yes** for non-null |

---

## 6. Index strategy (design only)

- Tenant + id primary access path on every aggregate.
- Tenant + status + created_at for bounded lists.
- Tenant + provider_code + provider_transaction_reference (partial) for payment uniqueness lookup.
- Tenant + operation_type + idempotency_key for idempotency.
- Tenant + occurred_at for event reads (always bounded).
- Tenant + payment_id for attempts / refunds / receipt.

No unbounded full-history scan is authorized by the query contract.

---

## 7. Transaction boundaries

Atomic unit-of-work groups (see `FINANCE_ATOMIC_OPERATION_GROUPS`):

1. create obligation + append event
2. issue invoice + append event
3. confirm payment + settle obligation + settle invoice + create receipt + append event + complete idempotency
4. complete refund + update refundable balance + append event
5. consume idempotency key with the financial effect

Semantics: explicit begin/commit/rollback or `run(callback)`. Nested transactions are **not** supported. No silent partial success.

---

## 8. Optimistic concurrency

- Mutable aggregates carry `version` starting at 1.
- Updates require `expectedVersion`.
- Success increments version by 1.
- Mismatch → `FINANCE_OPTIMISTIC_CONCURRENCY_CONFLICT`.
- Terminal / immutable records cannot be updated by version bump alone.
- Idempotent replay must not bump versions.

**Caveat:** application contracts alone do not equal database concurrency safety; later DB constraints / RLS / transactions are required.

---

## 9. Idempotency model

Durable record fields: tenant, operation type, key, canonical fingerprint, execution status (`STARTED` / `COMPLETED` / `FAILED` / `ABANDONED`), result reference only, timestamps, retention policy ref, version.

Policies:

- Same key + same fingerprint → replay stored result.
- Same key + different fingerprint → conflict.
- `STARTED` → `FINANCE_IDEMPOTENCY_IN_PROGRESS` (no silent re-entry).
- `FAILED` / `ABANDONED` → explicit retry API only (not silent).
- Never persist sensitive request payloads.

---

## 10. Event append model

Append-only. Duplicate event id → conflict. No mutation after append. Queries require tenant + bounds (`limit`, optional time window / cursor). Correlation/causation preserved. Privacy classification required. Evidence refs only.

---

## 11. Evidence redaction

`finance_audit_evidence` stores:

- evidence type, provider code, external reference
- captured_at, verification status
- integrity digest
- redaction + retention classification
- safe metadata only

Rejected: secrets, auth headers, tokens, CVV, full card data, unrestricted PII profiles, unlimited raw payloads. File/blob storage is out of scope for Phase 1E.

---

## 12. RLS / permission assumptions (future)

- Every Finance table RLS-scoped by `tenant_id`.
- No policy may allow cross-tenant select/update.
- Service role writes still must pass application tenant checks.
- Permissions assumed at app layer: Finance command actors; DB roles deferred.

---

## 13. Migration ordering (deferred SQL)

Suggested later order (documentation only):

1. fee definitions
2. obligations
3. invoices + items
4. payments + attempts
5. receipts
6. refunds
7. audit evidence
8. events
9. idempotency
10. uniqueness indexes / partial uniques
11. RLS policies

**Explicitly deferred:** executable SQL files, Supabase migration apply, staging apply, production apply.

---

## 14. Rollback considerations

- Forward-only additive migrations preferred.
- Dropping uniqueness indexes is dangerous once live money flows exist.
- Event table should not be rewritten; compensating events preferred.
- Rollback of applied Finance DDL requires owner approval and a separate change request.

---

## 15. Legacy data migration risks

| Source | Risk |
|--------|------|
| `finance-ledger` localStorage | Incomplete, non-tenant-safe, not durable; do not treat as SoT |
| Booking monetary blobs | May lack evidence / idempotency; require explicit mapping + quarantine |
| Tournament fee blobs | Eligibility mixed with money; Finance must import financial facts only |

Dual-write / backfill plans are **out of scope** until a later persistence implementation phase.

---

## 16. Explicit non-claims

- This phase does **not** create SQL.
- This phase does **not** implement Supabase repositories.
- Contract harness is in-memory proof only (`isDurable: false`).
- No package installs, no Billing reuse, no live provider, no PR, no deploy.

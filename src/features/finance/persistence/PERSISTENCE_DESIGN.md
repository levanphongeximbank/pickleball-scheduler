# Finance Persistence Design (Phase 1E + Phase 1F + Phase 1G + Phase 1H)

**Status:** Contracts + SQL authored/statically verified + **Supabase-compatible adapter implemented** + **SQL applied to Staging only** + Staging certification **READY WITH CONDITIONS**. Production SQL **not** applied. Production runtime **not** authorized. Runtime defaults remain disabled.

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
| Tenant SaaS plans / trials / locks | `billing` / `subscription` (`public.invoices`, `public.payments`, …) |
| Operational fees, invoices, receipts, refunds | **Finance** `public.finance_*` |

Finance persistence **must not** reuse Billing tables as source of truth.

---

## 3. Namespace decision (Phase 1F)

**Chosen model:** `public.finance_*` table prefixes.

**Rejected for v1:** dedicated `finance` schema — repository Supabase convention uses the `public` schema with module-prefixed tables (billing, notification, identity). Inventing a second schema system was avoided.

---

## 4. Migration artifacts (Phase 1F)

Canonical repository migration location: `docs/supabase-*.sql` (no active `supabase/migrations/` directory).

| Role | Filename |
|------|----------|
| Forward | `docs/supabase-finance-phase1f.sql` |
| Rollback | `docs/supabase-finance-phase1f-rollback.sql` |
| Static tests | `tests/finance-phase-1f-sql-migration.test.js` |

**Distinctions:**

- SQL authored.
- SQL statically verified.
- SQL applied on **Staging only** (Phase 1H).
- Staging certification: **READY WITH CONDITIONS** — see `staging/PHASE_1H_STAGING_CERTIFICATION.md`.
- Production SQL **not** applied / **not** authorized.
- Runtime composition defaults **disabled**; Production remains hard-disabled.
- Foundation is **not** a business integration (no Booking / Tournament / Competition / UI workflow).
- Known Production-only conditions remain deferred.

---

## 5. Logical / physical tables

| Table | PK | Tenant key | Mutable | Notes |
|-------|----|------------|---------|-------|
| `finance_fee_definitions` | `id` | `tenant_id` | Yes + `version` | Fee catalog |
| `finance_obligations` | `id` | `tenant_id` | Yes + `version` | Soft subject_* refs |
| `finance_invoices` | `id` | `tenant_id` | Yes + `version` | Not Billing invoices |
| `finance_invoice_items` | `id` | `tenant_id` | Child | FK → invoice |
| `finance_payments` | `id` | `tenant_id` | Yes + `version` | Not Billing payments |
| `finance_payment_attempts` | `id` | `tenant_id` | Yes + `version` | FK → payment |
| `finance_receipts` | `id` | `tenant_id` | Insert-only at policy | One per payment |
| `finance_refunds` | `id` | `tenant_id` | Yes + `version` | FK → payment |
| `finance_events` | `id` | `tenant_id` | Append-only | No UPDATE/DELETE grant |
| `finance_idempotency` | `id` | `tenant_id` | Yes + `version` | Unique (tenant, op, key) |
| `finance_audit_evidence` | `id` | `tenant_id` | Yes + `version` | Metadata only |

Primary keys are opaque Finance IDs (text). Tenant key is always explicit `tenant_id` (soft reference to venue/tenant identity; **no FK** to `venues` to avoid cascade destroying financial evidence).

---

## 6. External reference model

**Selected:** explicit nullable typed columns:

`subject_venue_id`, `subject_club_id`, `subject_competition_id`, `subject_registration_id`, `subject_entry_id`, `subject_booking_id`, `subject_player_id`, `subject_customer_id`

All are **soft references** (IDs only):

- avoid ambiguous free-form entity types;
- support indexes;
- do not duplicate external profiles;
- do not create FKs to tables Finance does not own.

---

## 7. Money and currency

- Store money as `bigint` minor units (`amount_minor`, etc.).
- Never floating-point / `numeric` / `real` for money.
- Non-negative checks; refunds require positive amounts.
- Currency CHECK: `currency = 'VND'` (v1). Extend via later migration.
- Invoice line math: `line_total_minor = unit_amount_minor * quantity` (CHECK).
- **Cannot** safely CHECK `sum(items) = invoice.amount_minor` across tables — application + UoW remain authoritative.

---

## 8. Unique constraints and conflict behavior

| Rule | Components | Semantics | Conflict |
|------|------------|-----------|----------|
| Idempotency | `(tenant_id, operation_type, idempotency_key)` | Unique always | Uniqueness conflict; same fingerprint → replay at app layer |
| Provider payment txn | `(tenant_id, provider_code, provider_transaction_reference)` | **Partial** WHERE reference IS NOT NULL | Uniqueness conflict |
| Provider attempt txn | same pattern on attempts | Partial | Uniqueness conflict |
| Payment attempt number | `(tenant_id, payment_id, attempt_number)` | Unique | Duplicate attempt identity |
| Receipt per payment | `(tenant_id, payment_id)` | Unique | One authoritative receipt |
| Event id | `(tenant_id, id)` + PK `id` | Unique | Append conflict |
| Invoice number | `(tenant_id, invoice_number)` | **Partial** WHERE number IS NOT NULL | No global sequence invented |
| Obligation business ref | `(tenant_id, business_reference)` | Partial WHERE NOT NULL | Duplicate obligation effect |

---

## 9. Relational integrity (Finance-owned)

Composite tenant-aware FKs with `ON DELETE RESTRICT`:

- invoice items → invoices
- payment attempts → payments
- receipts → payments
- refunds → payments
- payments → invoices / obligations (nullable)
- obligations → fee definitions / invoices (nullable)
- optional audit_evidence_ref → finance_audit_evidence

Retention: soft archive via status; hard delete is ops-only. Never cascade-delete immutable financial evidence.

---

## 10. Optimistic concurrency

Mutable aggregates include `version integer not null default 1` with `version >= 1`.

Future adapter update pattern:

```sql
UPDATE ...
SET version = version + 1, updated_at = now()
WHERE id = $id
  AND tenant_id = $tenant
  AND version = $expected_version;
```

No generic version-hiding trigger in Phase 1F.

---

## 11. Idempotency table

Fields: tenant, operation_type, idempotency_key, request_fingerprint (non-empty), execution_status (`STARTED`/`COMPLETED`/`FAILED`/`ABANDONED`), result_entity_type/id, timestamps, expires_at, version.

- Completed requires result entity type + id.
- No raw request body / PII / secrets.
- Future: consume key in same DB transaction as the financial effect.

---

## 12. Finance events (append-only)

Includes event_type, event_version, occurred_at, recorded_at, correlation/causation, privacy_classification, Finance refs, evidence_refs, payload_schema_version, sanitized payload.

**Append-only boundary:**

- GRANT SELECT, INSERT only to `authenticated`.
- No UPDATE/DELETE policies for ordinary roles.
- No UPDATE/DELETE grants.
- Service-role bypass is **not** application authorization; maintenance deletes require elevated ops process + Owner approval.

---

## 13. Audit evidence restrictions

Stores: evidence_type, provider_code, external_reference, captured_at, verification_status, integrity_digest, redaction/retention classification, sanitized metadata (≤ 8 KiB; secret key names rejected).

**Forbidden:** API secrets, auth headers, tokens, webhook secrets, CVV, full card data, unrestricted provider payloads, profile blobs. No file/blob storage.

---

## 14. RLS and permission model

- RLS + FORCE RLS on all Finance tables.
- Tenant: `tenant_id = public.user_venue_id()` OR `is_super_admin()`.
- Read: `user_has_permission('finance.view')` (or super admin).
- Commands: `user_has_permission('finance.edit')` (or super admin).
- WITH CHECK on all write policies.
- REVOKE ALL from `PUBLIC` and `anon`; no anonymous/public financial access.
- No `GRANT ALL` to authenticated.

**READY WITH CONDITIONS:**

- Depends on existing rbac helpers (`user_venue_id`, `user_has_permission`, `is_super_admin`) from `docs/supabase-rbac.sql` / `docs/supabase-rbac-v4.sql`.
- Finer-grained refund-approval permission not introduced (uses `finance.edit`).
- Runtime permission wiring / role matrix verification deferred to Staging certification.
- Client-supplied `tenant_id` alone is never trusted.

---

## 15. Index strategy

Tenant + status + time; tenant + subject refs; tenant + provider txn (partial unique); tenant + idempotency key (unique); payment attempts by payment; invoice items by invoice; refunds by payment; events by recorded_at / correlation_id; evidence by external reference.

Unique constraints already cover primary uniqueness paths — no redundant duplicate indexes.

---

## 16. Transaction boundaries (unchanged from 1E)

Atomic UoW groups remain application-defined (obligation+event, invoice+event, confirm payment settle+receipt+idempotency, refund complete, etc.). Nested transactions unsupported.

---

## 17. Rollback strategy

- Explicit file: `docs/supabase-finance-phase1f-rollback.sql`
- Drops policies then child tables then parents; Finance objects only.
- No Billing/foreign DROP; no broad CASCADE.
- **WARNING:** destroys Finance data.
- Static-only / unapplied in Phase 1F.

---

## 18. Static verification results

`tests/finance-phase-1f-sql-migration.test.js` inspects SQL text (no DB connection, no Supabase CLI apply).

Covers: required tables, Billing isolation, bigint money, VND, tenant_id, RLS, grants, uniqueness, append-only events, version columns, indexes, evidence restrictions, rollback scope, no legacy backfill, no new SECURITY DEFINER Finance functions.

---

## 19. Unresolved runtime authorization dependencies

| Dependency | Status |
|------------|--------|
| `user_venue_id()` | Existing convention; required at apply time |
| `user_has_permission('finance.view'|'finance.edit')` | Catalogued in identity/rbac-v4; role wiring verification deferred |
| Finer refund approval permission | Not created; uses finance.edit |
| Service-role tenant enforcement | Application must enforce; RLS bypassed by service_role |
| Durable adapter | Implemented (Phase 1G); Staging-certified with conditions (Phase 1H) |

---

## 20. Phase 1G durable adapter

Package: `src/features/finance/persistence/supabase/`

- Factory: `createSupabaseFinanceRepositories(client, config?)`
- Fake test client: `createFakeSupabaseFinanceClient()` (`__testOnly: true`)
- Maps exclusively to `public.finance_*` (never Billing tables)
- Tenant filters on every read/write; optimistic updates use `tenant_id` + `id` + `version`
- Events/receipts expose no ordinary update/delete
- Unit of work: single-statement capable; multi-record atomic groups fail closed unless `transactionalExecutor` injected
- Error normalization: unique / constraint / RLS / timeout / unknown → typed Finance errors with sanitized context

**Non-claims:** adapter factory tests do not apply SQL or open Production; no env credentials; no network in unit tests; no Production runtime activation.

---

## 21. Explicit non-claims / current boundaries

- SQL was applied to **Staging only** (Phase 1H). Production was **not** touched.
- Staging certification is **READY WITH CONDITIONS**.
- Contract harness remains in-memory for unit tests (`isDurable: false`).
- Runtime defaults remain disabled; Production remains hard-disabled.
- Authenticated Staging app-shell composition exists (Phase 1J) behind a feature flag (default OFF).
- Foundation is **not** a business integration.
- No package installs, no Billing reuse, no live provider, no Production deploy, no legacy finance-ledger backfill in this phase.
- Known Production-only conditions remain deferred.

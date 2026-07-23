# Finance Foundation Architecture (Phase 1B + Phase 1C + Phase 1D + Phase 1E + Phase 1F + Phase 1G + Phase 1H + Phase 1I)

**Module home:** `src/features/finance/`

**Status:** Domain + application services + in-memory repositories + provider-neutral payment port + durable persistence contracts + SQL authored/statically verified + Supabase-compatible durable adapter + **Staging SQL applied & certified (READY WITH CONDITIONS)** + **opt-in runtime composition foundation (default disabled)**

**Baseline:** Phase 1A read-only audit approved at `1fe3d1c0597470858ea400d379ef853d225720a5`

**Distinctions:** SQL authored, statically verified, and **Staging-applied** (Phase 1H). Adapter certified on Staging with conditions. Runtime composition exists but is **opt-in / default disabled**. Production **not** authorized. No live provider. No UI / Booking / Tournament / Competition wiring.

---

## Purpose / Ownership

Finance owns **operational finance** for PICK_VN:

- competition fees (financial representation only);
- tournament entry fees (financial representation only);
- venue and court booking money;
- club and membership fees;
- operational invoices, payments, receipts, refunds, and reconciliation concepts.

Finance **confirms financial status only**.

---

## Explicit non-ownership

Finance does **not** own:

- competition eligibility (Competition Engine);
- SaaS subscription billing (`src/features/billing/`);
- marketplace payment gateway wiring (`src/features/payments/`);
- subscription lifecycle (`src/features/subscription/`);
- legacy/prototype ledger UI (`src/features/finance-ledger/`);
- booking domain engines;
- notification delivery;
- CRM opportunity monetary estimates;
- auth/identity profiles.

---

## Separation from SaaS Billing

| Concern | Owner |
|---------|--------|
| Tenant SaaS plans, trials, locks, plan limits | `billing` / `subscription` |
| Operational fees, invoices, receipts, refunds | `finance` (this module) |

Do **not** merge or relocate `src/features/billing` into Finance Foundation.

Billing PascalCase events and provider webhook names remain unchanged.

---

## Separation from finance-ledger

`src/features/finance-ledger` is legacy/prototype UI with localStorage persistence.

- Do **not** build the new Finance domain on finance-ledger.
- Phase 1B/1C do **not** modify finance-ledger.
- localStorage is not an acceptable production source of truth for Finance.

---

## Money representation

- Monetary values are **integer minor units** (`amountMinor`).
- No floating-point arithmetic for financial calculations.
- Immutable Money value objects (`createMoney`, `addMoney`, `subtractMoney`, …).
- Percentage math uses integer **basis points** with half-away-from-zero rounding (`applyPercentBps`).
- No external decimal package.

### VND v1 currency policy

- Version 1 allowlist: **VND** only.
- VND minor-unit exponent is `0` (1 minor unit = 1 đồng).
- Money is structurally ready for additional ISO 4217 currencies later.
- Unsupported, missing, malformed, or non-uppercase currency codes are rejected (normalization is explicit only).

---

## Layering (Phase 1C + 1D + 1E + 1I)

```
runtime/         Phase 1I composition factory + readiness/capabilities (opt-in)
application/     orchestration services + idempotent commands
providers/       provider-neutral PaymentProviderPort + mock adapter
persistence/     durable record contracts, mappers, ports, UoW, Supabase adapter
repositories/    Phase 1C provider-neutral ports + in-memory implementations
domain/          pure lifecycle contracts (Phase 1B)
events/          catalogue + envelope builders
errors/          typed FinanceError codes
```

### Provider-neutral payment port (Phase 1D)

Finance owns `PaymentProviderPort` under `src/features/finance/providers/`.

| Concern | Policy |
|---------|--------|
| Ownership | Finance-owned, provider-neutral |
| Canonical provider | **None selected** |
| Sibling stacks | `billing` / `payments` remain separate; not modified or consolidated |
| Secrets | No API keys, webhook secrets, or env vars introduced |
| Network | No external API calls in this phase |
| Domain truth | Provider payloads are never Finance source of truth |
| Storage | Normalized references + evidence only; no unrestricted raw sensitive payloads |
| Webhook | Evidence input only; Finance application rules still decide transitions |
| Confirmation | Callback / redirect / client-declared success alone never confirms payment |

Port methods: `getCapabilities`, `initiatePayment`, `queryPaymentStatus`, `verifyPaymentConfirmation`, `cancelPayment`, `initiateRefund`, `queryRefundStatus`, `parseWebhook`.

Capability negotiation is explicit and immutable. Unsupported operations throw typed Finance provider errors (never silent success).

Application integration (injected only):

- `createPaymentAttemptWithProvider` initiates at provider; payment stays pending.
- `verifyAndConfirmPayment` requires verified provider evidence before Finance confirmation.
- `initiateProviderRefund` / `verifyAndCompleteRefund` keep Finance refund transitions application-owned.
- Idempotent replay does not re-invoke provider initiation.
- Provider transaction uniqueness remains repository-enforced (tenant-scoped).

Mock adapter (`createMockPaymentProvider`) is tests/development only: deterministic, no network, no production claim, isolated per factory call.

---

### Application layer

Focused services (explicit DI via `createFinanceApplication`):

| Service | Responsibility |
|---------|----------------|
| FeeApplicationService | Register FeeDefinition; evaluate FeePolicy |
| ObligationApplicationService | Create/open/cancel/expire; settlement only via confirmed payment |
| InvoiceApplicationService | Create/issue/void; payment hint only via confirmed payment |
| PaymentApplicationService | Initiate, attempt, confirm/fail/cancel/expire; settle once |
| ReceiptApplicationService | Exactly one receipt per confirmed payment |
| RefundApplicationService | Request/approve/reject/complete; partial refunds |
| FinanceEventRecorder | Persist approved event envelopes (not an external bus) |

Commands carry explicit `tenantId`, `idempotencyKey`, `actor`, `correlationId`, optional `causationId`, and `occurredAt` / `requestedAt`. No `Date.now`, no implicit current user, no random IDs unless injected.

### Repository ports

Provider-neutral, persistence-neutral contracts:

- FeeDefinitionRepository
- FinancialObligationRepository
- InvoiceRepository
- PaymentRepository (tenant-scoped provider transaction uniqueness)
- PaymentAttemptRepository
- ReceiptRepository (one receipt per payment)
- RefundRepository
- IdempotencyRepository
- FinanceEventRepository (FinanceEventSink)

Ports support tenant-scoped reads/writes, deterministic identity lookup, immutable-record protections, idempotency lookup/conflict detection, and typed `NOT_FOUND` / `CONFLICT` errors. No SQL, Supabase, localStorage, or browser APIs.

### In-memory repositories

`createInMemoryFinanceRepositories()` creates an **isolated** store per call:

- tenant isolation;
- defensive cloning / frozen snapshots (no mutable leakage);
- duplicate identity rejection;
- provider transaction reference uniqueness **per tenant**;
- idempotency uniqueness per tenant + operation + key;
- `resetAllForTests()` for test setup only.

**Limitations:** in-memory only; not durable; not production persistence; no shared global singleton across instances.

### Orchestration workflows

1. Fee → Obligation → Invoice → Payment → Attempt → Confirmation → Receipt
2. Confirmed Payment → Refund Request → Approve/Reject → Complete (with evidence)
3. Idempotent command replay returns the same financial result without a second effect

### Idempotency behavior

Application-level executor (`executeIdempotent`):

1. First valid command records canonical request fingerprint + result.
2. Same tenant, operation, key, and fingerprint → return stored result; no second record/event/settlement.
3. Same key with different fingerprint → `FINANCE_IDEMPOTENCY_CONFLICT`.
4. Same key in a different tenant remains isolated.
5. Fingerprints use canonical key-sorted normalization (not raw unordered `JSON.stringify`).
6. Secrets / sensitive fields are rejected from fingerprints.

**Still required later:** database uniqueness on `(tenantId, operationType, idempotencyKey)`.

### Event recording

Successful transitions record Phase 1B envelopes (SCREAMING_SNAKE_CASE). Event recorder stores envelopes through FinanceEventRepository. Idempotent replay does not append duplicate events (command + event idempotency keys). No Notification or Reporting wiring. No fake reconciliation/adjustment events.

### Tenant isolation

All repository operations are tenant-scoped. Cross-tenant reads/updates fail with typed errors. Provider transaction uniqueness is tenant-scoped (documented policy).

### Provider-neutral design

No live payment provider. No webhooks. No provider secrets or raw payloads in commands/events. Provider transaction references are opaque strings with uniqueness enforcement.

---

## Lifecycle summaries

### Fee Definition / Fee Policy

Fee contracts carry identity, type, amount, currency, effective period, tenant scope, optional venue/club/competition/booking references, status, and policy version.

Evaluation is deterministic and side-effect free. Tournament/booking-specific rule engines are deferred.

### Financial Obligation

`CREATED → OPEN → PARTIALLY_SETTLED → SETTLED`

Also: `CREATED|OPEN|PARTIALLY_SETTLED → CANCELLED|EXPIRED`

- Explicit allowed transitions; invalid transitions throw typed errors.
- Amount/currency immutable after settlement begins.
- Overpayment rejected.
- Settlement applied only through confirmed Finance payments (application layer).

### Invoice

`DRAFT → ISSUED → PARTIALLY_PAID → PAID`

Also void from draft/issued/partially-paid (not from paid).

- Total = deterministic sum of items.
- Single currency per invoice.
- Issued invoices cannot be silently rewritten.
- Invoice status is **not** provider payment evidence.

### Payment / Payment Attempt

Payment: `PENDING → CONFIRMED | FAILED | CANCELLED | EXPIRED`

- Attempts are separate; failed/cancelled/expired attempts cannot become successful.
- Confirmation requires evidence metadata.
- Duplicate confirmation does not create a second financial effect.
- Provider transaction references are immutable once set and unique per tenant.
- Refunds never rewrite the original payment amount.

### Receipt

Issued only from a confirmed payment. Exactly one canonical receipt per confirmed effect. Deterministic serialization. No PDF/HTML/print.

### Refund

`REQUESTED → APPROVED | REJECTED`

`APPROVED → COMPLETED | REJECTED`

- References confirmed payment.
- Cannot exceed remaining refundable amount.
- Multiple partial refunds supported.
- Completion requires evidence.
- Completed/rejected are terminal.

---

## Event catalogue

Envelope fields include: `eventId`, `eventType`, `eventVersion`, `occurredAt`, `owningModule` (= `Finance`), `tenantId`, optional `venueId`/`clubId`, `correlationId`, optional `causationId`, `idempotencyKey`, actor, subject/financial references, amount/currency when applicable, privacy classification, evidence references, reason, payload.

Approved types (SCREAMING_SNAKE_CASE):

- `FINANCE_OBLIGATION_CREATED`
- `INVOICE_CREATED`
- `INVOICE_ISSUED`
- `PAYMENT_PENDING`
- `PAYMENT_CONFIRMED`
- `PAYMENT_FAILED`
- `PAYMENT_CANCELLED`
- `PAYMENT_EXPIRED`
- `RECEIPT_ISSUED`
- `REFUND_REQUESTED`
- `REFUND_APPROVED`
- `REFUND_REJECTED`
- `REFUND_COMPLETED`
- `RECONCILIATION_COMPLETED`
- `FINANCIAL_ADJUSTMENT_RECORDED`

Phase 1C records the workflow events above as applicable. It does **not** implement reconciliation or financial adjustment merely to emit those events.

`PAYMENT_CONFIRMED` may later be consumed by Competition, but the event itself only confirms financial state — never eligibility.

---

## Persistence

Phase 1E delivers Finance-owned **durable persistence contracts** under `src/features/finance/persistence/`:

- normalized persistence records (obligation, invoice/items, payment, attempt, receipt, refund, event, idempotency, audit evidence)
- bidirectional domain ↔ record mappers (reject corrupt/malformed stored data; no silent repair)
- durable repository ports with explicit tenant scope + bounded queries
- unit-of-work / transaction boundary contract (no nested transactions)
- optimistic concurrency contract (`expectedVersion` → increment)
- uniqueness / RLS / migration ordering documented in `persistence/PERSISTENCE_DESIGN.md`
- in-memory **contract harness** only (`createDurableFinanceContractHarness`, `isDurable: false`)

Phase 1C in-memory repositories remain capability proof for application services.

### Phase 1F — SQL migration package (authored, not applied)

Canonical executable migration location for this repository: `docs/supabase-*.sql` (no active `supabase/migrations/` directory).

| Artifact | Path |
|----------|------|
| Forward migration | `docs/supabase-finance-phase1f.sql` |
| Rollback migration | `docs/supabase-finance-phase1f-rollback.sql` |
| Static verification | `tests/finance-phase-1f-sql-migration.test.js` |

**Namespace:** `public.finance_*` table prefixes — operational Finance is **not** SaaS Billing (`public.invoices` / `public.payments`).

### Phase 1G — Durable Supabase repository adapter (injected client)

| Artifact | Path |
|----------|------|
| Adapter package | `src/features/finance/persistence/supabase/` |
| Factory | `createSupabaseFinanceRepositories(client, config?)` |
| Fake client (tests) | `createFakeSupabaseFinanceClient()` |
| Contract tests | `tests/finance-phase-1g-supabase-adapter.test.js` |

Adapter targets Phase 1F `public.finance_*` tables only. Client is **explicitly injected**. No application Supabase singleton, env credentials, network, or SQL apply in this phase. Multi-record atomic groups fail closed unless an injected transactional executor is provided (`atomicityClaim: none | injected-executor`).

**Distinctions (mandatory):**

- SQL authored.
- SQL statically verified.
- SQL applied on **Staging only** (Phase 1H) — see `persistence/staging/PHASE_1H_STAGING_CERTIFICATION.md`.
- Adapter implemented and contract-tested with fake client; Staging adapter QA certified with conditions.
- Production SQL **not** applied / **not** authorized.
- Runtime composition (Phase 1I) is opt-in; default mode is **disabled**.

**Still absent / deferred:**

- Production SQL apply / Production runtime activation
- App shell / authenticated Supabase client composition wiring
- Billing table reuse
- finance-ledger localStorage as durable SoT
- Live payment provider
- Booking / Tournament / Competition / UI integration

---

## Phase 1I — Runtime composition foundation

| Artifact | Path |
|----------|------|
| Runtime package | `src/features/finance/runtime/` |
| Factory | `createFinanceRuntime(config, dependencies)` |
| Test harness | `createFinanceRuntimeTestHarness(options?)` |
| Contract tests | `tests/finance-phase-1i-runtime-composition.test.js` |

### Owner decisions (enforced)

1. Finance runtime is **opt-in**; default mode is **disabled**.
2. No implicit Supabase client; no env credential reads; no global singleton.
3. No implicit tenant; default tenant strategy is `explicit-per-command`.
4. No Production activation; Production environment classification rejects non-disabled modes.
5. No live payment provider; provider strategies are `none` (default) and `mock` (explicit).
6. No UI route/menu wiring; no Booking / Tournament / Competition integration.
7. No automatic migration apply; no startup database write; no network during construction.

### Modes

| Mode | Persistence | Notes |
|------|-------------|-------|
| `disabled` (default) | none | Capability inspection only; command attempts throw `FINANCE_RUNTIME_DISABLED` |
| `memory` | isolated in-memory repos | Non-durable; rejects Production; tests/demo only |
| `supabase` | `createSupabaseFinanceRepositories` | Injected client required; Staging classification only; no query/write during construction |

### Configuration contract

Validated by `validateFinanceRuntimeConfig`. Unknown keys are **rejected** (fail-closed). Secret-like keys (`apiKey`, `token`, `serviceRole`, …) are rejected. Validated config is immutable (`Object.freeze`).

Fields: `enabled`, `mode`, `environment`, `tenantStrategy`, `providerStrategy`, `persistenceExpectation`, `transactionExpectation`, `featureFlags`, `diagnostics`.

### Readiness / capabilities

Readiness states: `DISABLED` | `READY` | `READY_WITH_CONDITIONS` | `NOT_READY`.

Supabase without an injected transactional executor reports `READY_WITH_CONDITIONS` (or `NOT_READY` when `transactionExpectation` requires an executor). Capability reports always set `productionAuthorized: false` and reference Phase 1H Staging certification without embedding secrets or database URLs.

Optional health probes are explicit and opt-in (`featureFlags.allowOptionalHealthProbes`); they never run during construction.

### Tenant / provider boundaries

- Tenant: `explicit-per-command` (default) or `injected-trusted-resolver` (injected `tenantResolver.resolveTenantId`). Factory does not resolve a tenant at startup. No first-venue fallback.
- Provider: `none` (default) or `mock` (requires `featureFlags.allowMockProvider: true`). Mock never auto-confirms payments. Production rejects mock.

---

## Provider integration

Finance owns a provider-neutral Payment Provider port (Phase 1D).

Phase 1D/1I does **not** select, enable, or consolidate a live payment provider. No webhooks wired to HTTP/Edge. No live provider calls. No credentials.

---

## Integration status

Phase 1I has **no integration** with Booking, Tournament, Competition, Notification, Reporting, Billing, or UI modules. Runtime composition is not wired into the application shell.

---

## Competition eligibility boundary

| Owner | Responsibility |
|-------|----------------|
| Finance | Financial obligation / payment / refund status |
| Competition Engine | Whether a player/entry/team may compete |

Finance must never independently decide competition eligibility.

---

## Future adapter boundaries

Expected later phases (not started):

1. Authenticated app-shell composition behind feature flags (still opt-in; Staging first)
2. Live provider adapters implementing PaymentProviderPort (still no forced consolidation of sibling stacks)
3. Booking / Tournament / Club fee adapters (consume Finance contracts)
4. Competition consumer of `PAYMENT_CONFIRMED` (eligibility remains Competition-owned)
5. Notification / Reporting consumers of Finance events
6. Reconciliation workflows
7. Production authorization gate (separate Owner approval)

---

## Security assumptions

- Domain objects must not store raw provider secrets or unnecessary personal profile data.
- Event payloads reject forbidden eligibility and secret/PII fields.
- Idempotency keys and fingerprints reject secret-like material.
- Provider contracts reject secret-like metadata and do not return raw payloads.
- Webhook tenant routing hints are never authoritative.
- Typed errors expose safe messages + non-sensitive context only; retryable hints where applicable.
- Runtime config / readiness / capability reports reject secrets and do not embed credentials, DB URLs, or access tokens.

---

## Known limitations

- Phase 1C in-memory repositories and Phase 1E contract harness are not durable / not production.
- Phase 1F SQL is Staging-applied (Phase 1H) with unresolved conditions — see certification doc.
- Phase 1G adapter multi-record atomicity requires injected executor.
- Phase 1I runtime default is disabled; Production activation rejected; no app-shell wiring.
- VND-only allowlist (DB CHECK `currency = 'VND'`; extend via later migration).
- Provider port exists; no live provider adapter authorized.
- Mock provider is not production-capable.
- No UI.
- No wiring into booking, tournament, competition, notification, or billing modules.
- Invoice payment status is a bookkeeping hint, not settlement evidence.
- Cross-table invoice total = sum(items) cannot be a simple CHECK; application/UoW remain authoritative.
- RLS depends on existing `user_venue_id()` / `user_has_permission('finance.view'|'finance.edit')` (rbac-v4); finer refund-approval permission unresolved.
- Service-role bypass is not application authorization.
- No cryptographic hash dependency for idempotency (canonical string fingerprints).

---

## Next recommended phase

**Phase 1J — Authenticated Staging composition behind feature flags** (Owner-authorized) and/or live provider adapter spike (separately gated). Production remains blocked.

Conditions for next phase: Phase 1I committed on `feature/finance-phase-1-foundation`, Finance tests green, Owner approval for any app-shell wiring or live provider work (never Production without separate gate).

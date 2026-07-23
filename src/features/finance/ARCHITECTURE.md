# Finance Foundation Architecture (Phase 1B)

**Module home:** `src/features/finance/`

**Status:** Domain foundation contracts and lifecycles (not Production-ready Finance)

**Baseline:** Phase 1A read-only audit approved at `1fe3d1c0597470858ea400d379ef853d225720a5`

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
- Phase 1B does **not** modify finance-ledger.
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
- Provider transaction references are immutable once set.
- Refunds never rewrite the original payment amount.

### Receipt

Issued only from a confirmed payment. Deterministic serialization. No PDF/HTML/print.

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

`PAYMENT_CONFIRMED` may later be consumed by Competition, but the event itself only confirms financial state — never eligibility.

Phase 1B does **not** create a runtime event bus or Notification wiring.

---

## Idempotency boundaries

Helpers produce deterministic tenant-scoped keys from:

- tenantId
- operationType
- businessReference
- optional providerReference
- version

Empty/malformed/secret-like components are rejected.

**Limitation:** an in-memory helper alone does **not** prevent database duplicates. Persistence phases must enforce uniqueness.

---

## Persistence

**Not implemented in Phase 1B.**

No SQL, Supabase migrations, staging, or production database operations are authorized in this phase.

---

## Provider integration

Finance will own a provider-neutral Payment Provider port in a later phase.

Phase 1B does **not** select, enable, or consolidate a live payment provider. No webhooks. No live provider calls.

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

1. Persistence adapters + DB uniqueness for idempotency
2. Payment Provider port (provider-neutral)
3. Booking / Tournament / Club fee adapters (consume Finance contracts)
4. Competition consumer of `PAYMENT_CONFIRMED` (eligibility remains Competition-owned)
5. Notification / Reporting consumers of Finance events
6. Reconciliation workflows

---

## Security assumptions

- Domain objects must not store raw provider secrets or unnecessary personal profile data.
- Event payloads reject forbidden eligibility and secret/PII fields.
- Idempotency keys reject secret-like component names.
- Typed errors expose safe messages + non-sensitive context only.

---

## Known limitations

- In-memory / pure domain only — no durability.
- VND-only allowlist.
- No provider port.
- No UI.
- No wiring into booking, tournament, competition, notification, or billing modules.
- Invoice payment status is a bookkeeping hint, not settlement evidence.
- No cryptographic hash dependency for idempotency (canonical string keys only).

---

## Next recommended phases

1. **Phase 1C — Persistence contracts** (repository ports + SQL design, still no production deploy)
2. **Phase 1D — Payment Provider port** (provider-neutral; no live consolidation yet)
3. **Phase 1E — Adapter wiring** (booking/tournament fee adapters consuming Finance)
4. **Competition financial-status consumer** (eligibility remains outside Finance)

Conditions for next phase: Phase 1B committed on `feature/finance-phase-1-foundation`, tests green, owner approval for persistence scope.

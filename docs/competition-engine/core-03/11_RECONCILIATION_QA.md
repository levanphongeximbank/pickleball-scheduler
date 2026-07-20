# CORE-03 Phase 1G — Reconciliation QA

**Scope:** Document and test reconciliation cases for partial-success persistence paths.
**Not in scope:** Automatic Production reconciliation worker.

Owner decisions:

- Manual operator recovery only
- `reconciliationRequired = true` must not be hidden
- Exact replay is preferred over blind mutation retry
- `automaticRecoverySafe = false` for all catalogued cases below

Programmatic catalog (test-only import path):

`src/features/competition-core/registration-eligibility/fixtures/runtimeCompositionHarness.js`
→ `CORE03_RECONCILIATION_SCENARIOS`

---

## Case catalog

### 1. REG_PERSISTED_AUDIT_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | Registration row / status transition |
| Missing effects | Audit event |
| Safe replay behavior | Prefer operator audit backfill; avoid duplicate transition |
| reconciliationRequired | true |
| Operator recovery action | Append missing audit with `reconciliationRequired=true`; verify no duplicate mutation |
| Automatic recovery | unsafe |

### 2. CAPACITY_COUNTERS_CHANGED_RESERVATION_WRITE_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | Capacity counters incremented |
| Missing effects | Reservation row, audit, idempotency |
| Safe replay behavior | Do not blind-retry reserve; counters already moved |
| reconciliationRequired | true |
| Operator recovery action | Inspect counters vs reservations; restore counter or insert missing reservation under Owner GO |
| Automatic recovery | unsafe |

### 3. RESERVATION_PERSISTED_AUDIT_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | Capacity counters + reservation row |
| Missing effects | Audit event; possibly idempotency record |
| Safe replay behavior | Exact requestId replay should HIT once idempotency exists; otherwise append audit only |
| reconciliationRequired | true |
| Operator recovery action | Append audit; ensure idempotency record exists for requestId |
| Automatic recovery | unsafe |

### 4. REGISTRATION_TRANSITIONED_WAITLIST_WRITE_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | Registration transitioned to WAITLISTED |
| Missing effects | Waitlist entry and/or audit |
| Safe replay behavior | Unsafe automatic waitlist recreate without uniqueness checks |
| reconciliationRequired | true |
| Operator recovery action | Create missing waitlist entry or revert status under Owner GO |
| Automatic recovery | unsafe |

### 5. PROMOTION_RESERVATION_PERSISTED_APPROVAL_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | Promotion reservation / capacity changes |
| Missing effects | APPROVED transition and/or waitlist PROMOTED mark |
| Safe replay behavior | Do not double-reserve; resume approval with expected versions |
| reconciliationRequired | true |
| Operator recovery action | Complete APPROVED transition + waitlist mark, or release reservation |
| Automatic recovery | unsafe |

### 6. WAITLIST_PROMOTED_AUDIT_FAILED

| Field | Value |
|-------|-------|
| Persisted effects | APPROVED registration, waitlist PROMOTED, reservation |
| Missing effects | Audit event |
| Safe replay behavior | Append-only audit backfill; do not re-promote |
| reconciliationRequired | true |
| Operator recovery action | Append promotion audit with `reconciliationRequired=true` |
| Automatic recovery | unsafe |

### 7. IDEMPOTENCY_RECORD_MISSING_AFTER_SUCCESS

| Field | Value |
|-------|-------|
| Persisted effects | Mutation completed; audit may exist |
| Missing effects | Idempotency record |
| Safe replay behavior | Exact replay may duplicate unless operator inserts HIT payload |
| reconciliationRequired | true |
| Operator recovery action | Insert idempotency record from audit/replay payload before client retries |
| Automatic recovery | unsafe |

---

## Runtime QA coverage

Phase 1G tests inject audit / reservation / waitlist write failures through the
test-only runtime composition harness hooks and assert:

- `metadata.reconciliationRequired === true` when partial success occurs
- retry after partial reservation failure does not create a second ACTIVE reservation
- retry after partial waitlist failure does not silently succeed as a duplicate place

No automatic Production worker is created.

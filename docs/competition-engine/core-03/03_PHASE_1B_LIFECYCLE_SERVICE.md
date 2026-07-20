# CORE-03 Phase 1B — Registration Lifecycle Service

**Wave:** 1 / CORE-03
**Phase:** 1B — Registration Lifecycle Orchestration
**Module:** `src/features/competition-core/registration-eligibility/services/`
**Branch intent:** `feature/competition-core-03-registration-lifecycle`

---

## 1. Service responsibilities

Phase 1B owns **registration lifecycle orchestration only**:

| Operation | Responsibility |
|-----------|----------------|
| `createDraftRegistration` | Mint DRAFT registration with idempotency + audit |
| `submitRegistration` | DRAFT → SUBMITTED with `submittedAt` from ClockPort |
| `beginRegistrationReview` | SUBMITTED → UNDER_REVIEW (no eligibility evaluation) |
| `withdrawRegistration` | Open status → WITHDRAWN with actor + optional reason |
| `cancelRegistration` | Allowed open status → CANCELLED |
| `expireRegistration` | Allowed open status → EXPIRED (system actor default) |

All status changes delegate to Phase 1A `validateRegistrationTransition` / `applyRegistrationTransition`. Phase 1B does **not** duplicate the transition matrix.

Factory entry point:

```js
import { createRegistrationLifecycleService } from "../registration-eligibility/index.js";

const lifecycle = createRegistrationLifecycleService({
  repository,
  audit,
  clock,
  ids,
});
```

---

## 2. Lifecycle operations

### Create draft

Requires: `competitionId`, valid `applicant`, valid `target` (INDIVIDUAL | PAIR | TEAM), `registrationRequestId`, `idempotencyKey`.

Uses `IdGeneratorPort` for registration and audit ids; `ClockPort` for timestamps. Persists via `RegistrationRepositoryPort` and appends audit via `RegistrationAuditPort`.

### Submit

Loads registration by id. Permits only DRAFT → SUBMITTED. Already-SUBMITTED returns deterministic replay (`replayed: true`, no duplicate audit).

### Begin review

SUBMITTED → UNDER_REVIEW only. Full eligibility orchestration is deferred to Phase 1C.

### Withdraw / cancel / expire

Each operation validates against Phase 1A allowed transitions, records actor (or system actor for expire), optional reason, previous/next status in audit evidence, and fails closed on terminal or invalid source status.

---

## 3. Idempotency behavior

Uses Phase 1A `evaluateIdempotentSubmission` + `createIdempotencyRecordForRegistration`.

| Scenario | Result |
|----------|--------|
| Same idempotency key + same canonical request | **HIT** — return existing registration, `replayed: true`, no duplicate write/audit on create replay |
| Same idempotency key + different request fingerprint/scope | **CONFLICT** — fail closed (`REG_ELIG_IDEMPOTENCY_CONFLICT`) |
| Submit when already SUBMITTED | Deterministic replay, no duplicate audit event |

Idempotency keys are never silently rebound or overwritten.

---

## 4. Audit behavior

Every successful state-changing operation appends a `RegistrationAuditEvent` containing:

- `id` (eventId)
- `registrationId`, `competitionId`
- `operation`, `eventType`
- `actorId`
- `fromStatus`, `toStatus`
- `occurredAt` (from ClockPort)
- `requestId` / `correlationId`
- `reason` (when supplied)
- `serviceVersion` (`core03-lifecycle-1.0.0`)

Phase 1B adds optional top-level audit fields (additive, backward compatible with Phase 1A contract).

---

## 5. Consistency limitations (contract-only / in-memory phase)

**No transactional guarantee** between repository and audit sink:

1. Registration (and idempotency record) may be persisted successfully.
2. If audit append fails afterward, the service returns `REG_ELIG_AUDIT_APPEND_FAILED` with `metadata.persistedWithoutAudit: true` and includes the persisted registration in the failure result.
3. Callers must treat this as a **partial success** — state changed but audit trail incomplete.
4. A future Production adapter should use outbox or two-phase patterns; Phase 1B documents the contract only.

---

## 6. Error model

Service results use `RegistrationLifecycleServiceResult`:

```js
{
  ok: boolean,
  operation: string,
  registration: CompetitionRegistration | null,
  previousStatus: string | null,
  currentStatus: string | null,
  idempotencyResult: 'MISS' | 'HIT' | 'CONFLICT' | null,
  auditEventId: string | null,
  performedAt: string | null,
  replayed: boolean,
  warnings: RegistrationEligibilityIssue[],
  errors?: RegistrationEligibilityIssue[], // when ok === false
}
```

Structured error codes (additive Phase 1B):

- `REG_ELIG_REGISTRATION_NOT_FOUND`
- `REG_ELIG_AUDIT_APPEND_FAILED`
- `REG_ELIG_DUPLICATE_REGISTRATION` (in-memory identity-key guard)

Existing Phase 1A codes remain in use for validation, transitions, and idempotency.

---

## 7. Dependency direction

Unchanged from Phase 1A:

```text
RegistrationLifecycleService
  → RegistrationRepositoryPort
  → RegistrationAuditPort
  → ClockPort
  → IdGeneratorPort
  → Phase 1A policies (transitions, idempotency)
  → Phase 1A contracts (CompetitionRegistration, audit events)
```

No runtime imports from Core-01, Core-02, Core-04, or legacy Phase 3C `registrations/**`.

---

## 8. In-scope / out-of-scope

### In scope (Phase 1B)

- Lifecycle orchestration for six operations above
- In-memory repository defensive copies + duplicate-key rejection
- Dedicated Phase 1B unit tests
- Public exports via `registration-eligibility/index.js`

### Out of scope

- Full eligibility orchestration (Phase 1C)
- APPROVED → Core-02 Entry creation
- SQL / Supabase adapters
- UI, auth, RLS, deployment
- Capacity / waitlist runtime
- Legacy Phase 3C modifications

---

## 9. Compatibility with Phase 1A

- Phase 1A contracts, enums, policies, and ports are reused unchanged except **additive** fields:
  - `REGISTRATION_LIFECYCLE_SERVICE_VERSION` in `shared.js`
  - Optional audit event fields (`competitionId`, `operation`, `requestId`, `correlationId`, `reason`, `serviceVersion`)
  - Error codes for not-found, audit failure, duplicate registration
- In-memory repository extended (backward compatible interface)
- Phase 1A tests must remain passing

---

## 10. Deferred — Phase 1C eligibility orchestration

Phase 1C will own:

- Eligibility evaluation orchestration across injected ports (Core-01 rules, Core-04 division descriptors, payment/membership/roster checks)
- Decision aggregation → `UNDER_REVIEW` outcomes (APPROVED, CONDITIONAL, WAITLISTED, REJECTED)
- Evidence capture beyond lifecycle audit events

Phase 1B intentionally stops at `beginRegistrationReview` without running eligibility checks.

---

## 11. Public surface

Exported from `registration-eligibility/index.js`:

- `REGISTRATION_LIFECYCLE_SERVICE_VERSION`
- `REGISTRATION_LIFECYCLE_OPERATION`
- `REGISTRATION_LIFECYCLE_SYSTEM_ACTOR`
- `createRegistrationLifecycleService`
- `registrationLifecycleServiceOk` / `registrationLifecycleServiceFail`

Not re-exported from root `competition-core/index.js` (Integrator-owned).

---

## 12. Verification

```bash
node --test tests/competition-core-registration-eligibility-core03-phase1b.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1a.test.js
```

See Phase 1B completion report for full CI gate evidence.

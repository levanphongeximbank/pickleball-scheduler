# CORE-03 Phase 1C — Eligibility Evaluation Orchestration

**Wave:** 1 / CORE-03  
**Phase:** 1C — Eligibility Evaluation Orchestration  
**Module:** `src/features/competition-core/registration-eligibility/services/`  
**Branch intent:** `feature/competition-core-03-eligibility-orchestration`

---

## 1. Orchestration responsibilities

Phase 1C owns **eligibility evaluation orchestration only**:

| Responsibility | Owner |
|----------------|-------|
| Build `EligibilityEvaluationContext` | Core-03 orchestrator |
| Resolve competition + eligibility policy | `CompetitionRegistrationPolicyPort` |
| Determine required check set | `eligibilityEvaluationPolicy.js` |
| Execute checks via dependency ports | `eligibilityCheckExecutor.js` |
| Normalize + aggregate check results | Phase 1A `createEligibilityDecision` |
| Record evaluation evidence | `EligibilityEvaluationEvidence` contract |
| Append evaluation audit event | `RegistrationAuditPort` |
| Evaluation idempotency | `evaluationIdempotencyPolicy.js` (namespaced keys) |

Phase 1C does **not** own: SQL persistence, Production adapters, UI, capacity/waitlist runtime, Core-02 Entry creation, or legacy Phase 3C registration runtime.

Canonical public operation:

```js
import { createEligibilityEvaluationService } from "../registration-eligibility/index.js";

const evaluator = createEligibilityEvaluationService({
  repository,
  audit,
  clock,
  ids,
  participantLookup,
  entryLookup,
  divisionEligibility,
  competitionPolicy,
  ruleEvaluation,
  paymentStatus,
  membershipStatus,
  teamRosterValidation,
});

const result = await evaluator.evaluateRegistrationEligibility({
  registrationId,
  evaluationRequestId, // namespaced idempotency key — not submission idempotency
  actorId,
  correlationId,
  requestId,
});
```

---

## 2. Evaluation flow

1. Validate `registrationId` + `evaluationRequestId`
2. Load registration via `RegistrationRepositoryPort`
3. Confirm status is `SUBMITTED` or `UNDER_REVIEW`
4. Resolve competition policy (`policyAvailable` must be true)
5. Resolve required check types (policy-driven, sorted alphabetically)
6. Build **canonical evaluation-request fingerprint** (no timestamps)
7. Evaluation idempotency lookup (`EVAL_IDEMP::{evaluationRequestId}`)
8. On HIT — return replayed decision/evidence (no duplicate audit)
9. On MISS — execute checks through ports (deterministic order)
10. Aggregate via Phase 1A precedence into `EligibilityDecision`
11. Create `EligibilityEvaluationEvidence`
12. Append audit event (`ELIGIBILITY_EVALUATION_SERVICE_VERSION`)
13. Persist evaluation idempotency replay record (includes fingerprint)
14. Return structured `EligibilityEvaluationServiceResult`

---

## 3. Check-to-port mapping

| Check type | Port(s) |
|------------|---------|
| `REGISTRATION_WINDOW` | `CompetitionRegistrationPolicyPort` |
| `PARTICIPANT_STATUS` | `ParticipantLookupPort` |
| `AGE_REQUIREMENT` | `ParticipantLookupPort` + policy parameters |
| `GENDER_REQUIREMENT` | `ParticipantLookupPort` + policy parameters |
| `RATING_RANGE` | `ParticipantLookupPort` + policy parameters |
| `RANKING_REQUIREMENT` | `RuleEvaluationPort` |
| `DIVISION_COMPATIBILITY` | `DivisionEligibilityPort` |
| `DIVISION_CAPACITY` | `DivisionEligibilityPort` |
| `MEMBERSHIP_REQUIREMENT` | `MembershipStatusPort` |
| `TEAM_ROSTER_REQUIREMENT` | `TeamRosterValidationPort` |
| `DOCUMENT_REQUIREMENT` | `RuleEvaluationPort` |
| `PAYMENT_REQUIREMENT` | `PaymentStatusPort` |
| `DUPLICATE_REGISTRATION` | `RegistrationRepositoryPort.findByIdentityKey` |
| `ENTRY_LIMIT` | `EntryLookupPort` |
| `COMPETITION_CAPACITY` | `CompetitionRegistrationPolicyPort` + repository counts |
| `SUSPENSION_OR_SANCTION` | `RuleEvaluationPort` |
| `MANUAL_APPROVAL` | Eligibility policy `requireManualApproval` |

Deferred Production adapters: capacity/waitlist runtime, document providers, payment gateways, membership systems — use port contracts + in-memory/stub adapters in Phase 1C.

---

## 4. Outcome precedence

Uses Phase 1A `createEligibilityDecision` (unchanged):

1. Any **BLOCKING** reason → `INELIGIBLE`
2. Else manual-approval signal / `requireManualApproval` → `MANUAL_REVIEW_REQUIRED`
3. Else conditional warning codes (`CONDITIONAL_*` / `CONDITIONAL_REQUIREMENT`) when `allowConditional` → `CONDITIONAL`
4. Else → `ELIGIBLE`

---

## 5. Deterministic reason ordering

Reasons are ordered by Phase 1A `orderEligibilityReasons`:

**severity rank** → **checkType** → **code** → **message**

Check execution order is alphabetical by `ELIGIBILITY_CHECK_TYPE` code (`orderCheckTypesForExecution`). Policy array order does not affect final reason ordering.

---

## 6. Mandatory vs optional checks

- All `requiredCheckTypes` from eligibility policy are **mandatory** by default.
- `policy.parameters.optionalCheckTypes` marks checks as optional.
- Mandatory unavailable adapter → operation fails closed (`REG_ELIG_PORT_REQUIRED`).
- Optional unavailable adapter → documented warning on service result; evaluation continues.

---

## 7. Missing-adapter behavior

| Scenario | Behavior |
|----------|----------|
| Mandatory rule port unavailable (`RULE_EVALUATION_PORT_UNAVAILABLE`) | Fail closed — no silent eligible |
| Optional rule port unavailable | Warning + skip check |
| Competition policy missing (`policyAvailable: false`) | Fail closed before checks |
| Null/stub ports in tests | Deterministic stub responses only |

---

## 8. Audit and evidence behavior

**Evidence** (`EligibilityEvaluationEvidence`):

- evaluation ID, registration/competition/division IDs
- evaluator + rule-set versions
- required check types, check results, ordered reasons, outcome
- `evaluatedAt`, correlation/request IDs

**Audit** (`RegistrationAuditEvent`):

- operation `EVALUATE_REGISTRATION_ELIGIBILITY`
- `eligibilityDecisionId`, previous registration status, outcome
- `serviceVersion: core03-eligibility-eval-1.0.0`
- summary reason codes in payload

**Consistency limitation:** No transactional guarantee between evidence computation, audit append, and idempotency persistence. Audit failure returns `REG_ELIG_AUDIT_APPEND_FAILED` with decision/evidence in the failure result (`metadata.evaluatedWithoutAudit: true`).

---

## 9. Evaluation idempotency

- Keys are namespaced: `EVAL_IDEMP::{evaluationRequestId}`
- **Never** reuse registration submission idempotency keys
- Binding is to the **full canonical evaluation request fingerprint**, not registrationId alone

### Canonical fingerprint fields

| Field | Source |
|-------|--------|
| `registrationId` | registration |
| `competitionId` | registration |
| `divisionId` | registration |
| `targetStableIdentity` | registration target |
| `evaluatorVersion` | `ELIGIBILITY_EVALUATOR_VERSION` |
| `ruleSetId` / `ruleSetVersion` | eligibility policy |
| `policyId` / `policyVersion` | eligibility policy (+ `parameters.policyVersion`) |
| `requiredCheckTypes` | resolved + sorted check set |
| `evaluationOptions` | optional explicit request options (canonicalized JSON) |

Volatile fields **excluded**: `evaluatedAt`, actor/correlation ids, async port completion order.

| Scenario | Result |
|----------|--------|
| Same `evaluationRequestId` + exact same fingerprint | **HIT** — `replayed: true`, same logical decision/evidence, no duplicate audit |
| Same `evaluationRequestId` + different registration | **CONFLICT** |
| Same `evaluationRequestId` + same registration + different rule-set version | **CONFLICT** |
| Same `evaluationRequestId` + same registration + different check set / policy identity | **CONFLICT** |
| Missing `evaluationRequestId` / `registrationId` / fingerprint | fail closed |

---

## 9b. Official test-manifest registration (Integrator-owned)

`scripts/ci/unit-test-files.json` is an **Integrator-protected** file.

Phase 1C does **not** modify it. Capability verification runs via direct:

`node --test tests/competition-core-registration-eligibility-core03-phase1c.test.js`

Official CI manifest registration is an **Integrator follow-up** and is **not** a Phase 1C source-code blocker.

---

## 10. Ownership boundaries

| Boundary | Rule |
|----------|------|
| Core-01 | `RuleEvaluationPort` only |
| Core-02 | `ParticipantLookupPort`, `EntryLookupPort` — no Entry creation |
| Core-04 | `DivisionEligibilityPort` only |
| Core-05 | `TeamRosterValidationPort` only |
| Legacy Phase 3C | Not modified |
| Integrator barrels | `competition-core/index.js` not modified |

---

## 11. Deferred work

- Production SQL persistence for evaluations / evidence
- Capacity + waitlist runtime orchestration
- Production adapters for payment, membership, documents
- Integrator manifest entry in `scripts/ci/unit-test-files.json` (protected file)

---

## 12. Verification

```bash
node --test tests/competition-core-registration-eligibility-core03-phase1c.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1a.test.js
node --test tests/competition-core-registration-eligibility-core03-phase1b.test.js
```

Phase 1C test count: **40** (orchestration paths + canonical idempotency fingerprint conflicts + isolation scans).

Official `scripts/ci/unit-test-files.json` registration remains Integrator-owned (not a Phase 1C blocker).

# CORE-03 — Registration & Eligibility Architecture (Phase 1A)

**Wave:** 1 / CORE-03  
**Phase:** 1A — Boundary, Contract, and Architecture Foundation  
**Module:** `src/features/competition-core/registration-eligibility/`  
**Branch intent:** `feature/competition-core-03-registration-eligibility`

---

## 1. Ownership boundaries

| Concern | Owner |
|---------|-------|
| Registration application lifecycle (submit / review / decide / withdraw) | **Core-03** |
| Eligibility evaluation **orchestration** + reason aggregation | **Core-03** |
| Capacity / duplicate / waitlist **policy contracts** | **Core-03** |
| Registration evidence + audit events | **Core-03** |
| APPROVED → Entry conversion **handoff port** | **Core-03 port → Core-02** |
| Participant canonical persistence | **Core-02** |
| Entry canonical persistence | **Core-02** |
| Division / Category definitions + eligibility **descriptors** | **Core-04** |
| Generic Rule Engine implementation | **Core-01** (`constraints/**`) |
| Scheduling, draw, seeding, matchup, scoring, standings | Other cores |
| UI / Production SQL / Auth / RLS | Out of scope |

### Adjacent but not owned

- Phase 3C `registrations/**` (legacy resolve runtime) remains Integrator/legacy surface. Core-03 Phase 1A does **not** edit it.
- Core-02 `COMPETITION_REGISTRATION_STATUS` (PENDING-centric) is **not** mutated. Core-03 uses an expanded local `REGISTRATION_STATUS` (adds `UNDER_REVIEW`, `CONDITIONAL`, `EXPIRED`).

### Status compatibility (mandatory reading)

See **`02_STATUS_COMPATIBILITY.md`** for the full matrix and rules:

1. Core-03 registration status is **not** the same object as Core-02 Entry status.
2. `APPROVED` registration does **not** imply an Entry has been persisted.
3. `EntryCreationPort` is responsible for approved-registration → Entry handoff.
4. Legacy `PENDING` remains untouched until a later migration/adapter phase.
5. **No direct enum aliasing** unless a later compatibility decision explicitly approves it.
6. Any future mapping must be explicit, versioned, deterministic, and auditable.

---

## 2. Dependency direction

```text
                    ┌─────────────────────┐
                    │   Core-03 Domain    │
                    │ registration-       │
                    │ eligibility/**      │
                    └─────────┬───────────┘
                              │ ports only (DI)
        ┌───────────┬─────────┼──────────┬────────────┬──────────┐
        ▼           ▼         ▼          ▼            ▼          ▼
   Core-02     Core-02    Core-04    Core-01     Payment/    Clock /
   Participant Entry      Division   RuleEval    Membership  IdGen
   Lookup      Create     Elig.      Port        / Roster
               Lookup     Port
```

- Core-03 domain/services **never** import `participants/**`, `classification/**`, or `constraints/**` source.
- Sibling cores are reached only through **local ports** with null/in-memory stubs.
- **Phase 1E** adds `adapters/**` that implement those ports via **injected sibling public facades** (still no deep imports of sibling private files). See `06_PHASE_1E_SIBLING_CORE_ADAPTERS.md`.
- No hidden fallback to “first participant / first division / first club / first competition”.

---

## 3. Lifecycle

Statuses:

`DRAFT → SUBMITTED → UNDER_REVIEW → {APPROVED | CONDITIONAL | WAITLISTED | REJECTED}`

Also:

- `CONDITIONAL → {APPROVED | REJECTED}`
- `WAITLISTED → {APPROVED | WITHDRAWN | …}`
- Open statuses → `WITHDRAWN` / `CANCELLED` / (where allowed) `EXPIRED`

Terminal (no reopen): `APPROVED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`, `EXPIRED`.

Policy: `policies/registrationTransitions.js` — fail closed on invalid transitions.

---

## 4. Decision model

| Layer | Contract |
|-------|----------|
| Human/system decision | `RegistrationDecision` + `REGISTRATION_DECISION_TYPE` |
| Machine eligibility | `EligibilityDecision` + `ELIGIBILITY_OUTCOME` |
| Per-check | `EligibilityCheckResult` + `ELIGIBILITY_CHECK_TYPE` |
| Structured reasons | `EligibilityReason` with `INFO` / `WARNING` / `BLOCKING` |

Aggregation (deterministic):

1. Any **BLOCKING** → `INELIGIBLE`
2. Else manual-approval signal / policy → `MANUAL_REVIEW_REQUIRED`
3. Else conditional warning codes → `CONDITIONAL`
4. Else → `ELIGIBLE`

Reasons are ordered by severity rank → checkType → code → message.  
`evaluatorVersion` + optional `ruleSetVersion` are recorded.  
Domain evaluation uses injected `ClockPort` / caller-supplied ids — no `Date.now()`, no random IDs inside aggregation.

---

## 5. Audit model

- `RegistrationEvidence` — payload snapshots (documents, policy dumps, capacity).
- `RegistrationAuditEvent` — append-only lifecycle events (`fromStatus` / `toStatus` / decision refs).
- `RegistrationAuditPort.append` — sink interface (in-memory for Phase 1A).

---

## 6. Compatibility with Core-01 / Core-02 / Core-04

| Sibling | Integration style |
|---------|-------------------|
| **Core-01** | `RuleEvaluationPort` — Core-03 asks; Core-01 evaluates rules |
| **Core-02** | `ParticipantLookupPort`, `EntryLookupPort`, `EntryCreationPort` — conversion handoff only after APPROVED |
| **Core-04** | `DivisionEligibilityPort` — lane open-state + opaque descriptor refs; Core-03 does not define divisions |

Format hints (`DAILY_PLAY`, `TEAM_TOURNAMENT`, `INDIVIDUAL_TOURNAMENT`, `LEAGUE`, `LADDER`) are **opaque context** only — Team Tournament rules are not hard-coded into Core-03.

Targets: `INDIVIDUAL` | `PAIR` | `TEAM`.

---

## 7. Idempotency & recommended persistence (later phases)

Contracts support:

- `registrationRequestId`
- `idempotencyKey`
- `competitionId` / `divisionId`
- `participantId` or `teamId` (via `RegistrationTarget`)
- `targetType`

Repeated submission with the same idempotency key + same fingerprint → **HIT** (return existing).  
Same key + different fingerprint → **CONFLICT** (fail closed).

### Recommended uniqueness (document only — not applied in Phase 1A)

1. `UNIQUE (registration_request_id)`
2. `UNIQUE (idempotency_key) WHERE idempotency_key IS NOT NULL`
3. Partial unique on active registrations:  
   `UNIQUE (competition_id, COALESCE(division_id,'NONE'), target_stable_identity)`  
   excluding terminal statuses that are reopen-safe (none today — terminals stay closed)

---

## 8. Module map

```text
src/features/competition-core/registration-eligibility/
  enums/
  contracts/
  policies/
  ports/
  services/         ← Phase 1B lifecycle + Phase 1C evaluation + Phase 1D capacity/waitlist
  adapters/         ← Phase 1E sibling core adapters (DI facades → Core-03 ports)
  persistence/      ← Phase 1F persistence adapters + parameterized SQL helpers (no SQL apply)
  errors/
  fixtures/
  index.js          ← capability-local public surface ONLY
```

Persistence foundation (Phase 1F): see **`07_PHASE_1F_PERSISTENCE_FOUNDATION.md`**.
Migration SQL is authored under `docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql` and is **not applied** (`MIGRATION_STATUS = AUTHORED_NOT_APPLIED`).
Owner-accepted deferred gaps: `TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`, Core-02 Entry creation = `DEFERRED_FAIL_CLOSED`.
Phase 1G is documented as a future boundary only and is **not started** by Phase 1F.

Import example:

```js
import {
  REGISTRATION_STATUS,
  validateRegistrationTransition,
  createEligibilityDecision,
} from "../src/features/competition-core/registration-eligibility/index.js";
```

---

## 9. Public surface notes

Capability barrel: `registration-eligibility/index.js`.

Intentionally exported for Phase 1A:

- Domain enums, contracts, transition/idempotency policies, error helpers
- Port interfaces + null/in-memory stubs (dependency inversion for tests)
- Pure-domain fixtures under `fixtures/` (test helpers — not Production adapters)

Not re-exported from root `competition-core/index.js` (Integrator-owned).

## 10. Official unit-test manifest (Condition 1)

`scripts/ci/unit-test-files.json` is an **Integrator-protected** file
(`scripts/ci/competition-shared-file-ownership.mjs` → `COMPETITION_PROTECTED_FILES`).

Capability workstreams (including Core-03) **must not** edit it. Evidence:

- Core-01 foundation test exists but is **not** listed in the official manifest.
- Core-02 participant-entry foundation test exists but is **not** listed.
- Core-04 classification foundation test exists but is **not** listed.

Phase 1A verification therefore runs via direct:

`node --test tests/competition-core-registration-eligibility-core03-phase1a.test.js`

Integrator follow-up (separate PR) may add the Core-03 test to the official manifest.

## 11. Explicit non-goals (Phase 1A)

- Production / Staging SQL apply
- Deployment, auth, RLS
- UI wiring
- Root `competition-core/index.js` re-exports
- Editing Core-01 / Core-02 / Core-04 owned trees
- Editing Integrator-protected `unit-test-files.json`
- Full eligibility orchestration service (Phase 1C — see `03_PHASE_1B_LIFECYCLE_SERVICE.md`)

---

## 12. Phase 1B — Lifecycle service (complete)

Phase 1B adds `services/registrationLifecycleService.js` orchestrating:

- `createDraftRegistration`, `submitRegistration`, `beginRegistrationReview`
- `withdrawRegistration`, `cancelRegistration`, `expireRegistration`

Details: **`03_PHASE_1B_LIFECYCLE_SERVICE.md`**

---

## 13. Phase 1C — Eligibility evaluation orchestration (complete)

Phase 1C adds `services/eligibilityEvaluationService.js` orchestrating:

- `evaluateRegistrationEligibility` — canonical public evaluation operation
- Check execution via dependency ports (`eligibilityCheckExecutor.js`)
- Evaluation evidence + audit + namespaced idempotency replay

Details: **`04_PHASE_1C_ELIGIBILITY_ORCHESTRATION.md`**

---

## 14. Phase 1D — Capacity & waitlist runtime (complete)

Phase 1D adds `services/capacityWaitlistService.js` orchestrating:

- Capacity evaluation / reserve / release
- Waitlist place / withdraw / position / list
- Deterministic promotion-candidate selection
- Validated `WAITLISTED → APPROVED` promotion (no Core-02 Entry creation)

Details: **`05_PHASE_1D_CAPACITY_WAITLIST_RUNTIME.md`**

Deferred after 1D: SQL adapters, UI, Production authz providers, Entry creation handoff.

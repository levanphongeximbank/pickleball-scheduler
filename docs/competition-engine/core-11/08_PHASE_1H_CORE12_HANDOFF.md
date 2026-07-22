# CORE-11 Phase 1H-B — Certified Schedule → CORE-12 Court Assignment Handoff

| | |
|--|--|
| **Phase** | **1H-B — Integration handoff** |
| **Date** | 2026-07-22 |
| **Path** | `CORE_11_PHASE_1H_PATH_A_IMPLEMENT_INTEGRATION_HANDOFF` |
| **Prior** | Phase 1H-A′ public contract freeze |
| **Status** | Pre-commit review complete (integration-layer only; not committed) |

---

## 1. Phase 1H-A′ contract freeze (consumed)

Phase 1H-A′ froze the public CORE-12 surface under
`src/features/competition-core/court-assignment/index.js`, including:

* `createCourtAssignmentRequest` / `validateCourtAssignmentRequest`
* `assignCourtsDeterministic` / `assignCourts`
* `createCourtAssignmentPolicy`, match/court/lock/snapshot factories
* `fingerprintValue`
* Venue bridge helpers (`createInjectedVenueCourtAvailabilityProvider`,
  `normalizeVenueDescriptorEnvelope`, `projectEligibleCourtsToAvailableInputs`)
  for composition-root use — **not** imported by this adapter

CORE-11 certification fields consumed:

* `BASELINE_SCHEDULE_CANDIDATE` / `BASELINE_ONLY`
* `CONSTRAINT_CERTIFICATION_RESULT` / `HARD_CONSTRAINTS_CERTIFIED`
* `fingerprintScheduleRequest` / `fingerprintBaselineScheduleCandidate`
* `FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS`
* `validateScheduleRequest`

---

## 2. Integration-layer ownership

Files (authorized only):

```text
src/features/competition-core/integration/scheduleToCourtAssignment.js
src/features/competition-core/integration/index.js
tests/competition-core-core11-core12-handoff.test.js
docs/competition-engine/core-11/08_PHASE_1H_CORE12_HANDOFF.md
```

Responsibility:

* certification gate between CORE-11 and CORE-12
* fingerprint verification
* explicit tenant/club/venue scope
* match mapping
* court snapshot acceptance (prebuilt canonical courts)
* CORE-12 request construction
* optional deterministic assignment orchestration
* integration diagnostics

**Not owned:** CORE-11 core, CORE-12 core, Venue/Court, persistence, UI, Supabase,
Production cutover, Phase 1I.

---

## 3. Public import boundaries

Allowed:

```text
../schedule-engine/index.js
../court-assignment/index.js
```

Forbidden:

* CORE-11 / CORE-12 private paths
* Venue/Court private or public imports inside the adapter
* Tournament Engine / Court Engine
* CORE-09 / CORE-10 / CORE-14
* Supabase / React / MUI

Dependency direction: **integration → CORE-11 + CORE-12** (one-way).
CORE-11 and CORE-12 must not import integration.

Venue strategy: composition root resolves Venue public facades (or supplies
prebuilt `AvailableCourtInput[]`) and passes `courts[]` into the adapter.

---

## 4. Public API

```js
createCourtAssignmentRequestFromCertifiedSchedule({
  scheduleRequest,
  candidate,
  certificationResult,
  scope: { tenantId, clubId, venueId },
  courts,
  availabilitySnapshotRef,
  lockedAssignments?,
  courtRequirementsByMatchId?,
  courtAssignmentPolicy?,
  requestId?,
})
```

Result status: `SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT`

```js
{
  ok,
  status,
  courtAssignmentRequest, // plain, assignable; null when ok=false
  courtAssignmentResult: null, // always null for request-creation API
  diagnostics,
  mappingSummary: {
    sourceScheduledMatchCount,
    mappedMatchCount,
    byeCount,
    courtCount,
    lockedAssignmentCount,
  },
  replay: {
    sourceScheduleRequestFingerprint,
    sourceScheduleCandidateFingerprint,
    sourceCertificationFingerprint,
    courtAssignmentRequestFingerprint,
    handoffRequestFingerprintProjectionVersion,
    availabilitySnapshotTrustModel,
    resultFingerprintVerification,
  },
}
```

Optional orchestration:

```js
assignCourtsFromCertifiedSchedule(input)
```

Result status: `CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT`

Creates the request, calls public `assignCourtsDeterministic`, verifies
fingerprints/partition/times. Does **not** auto-assign on request creation.

---

## 5. CORE-11 precondition gate

### ScheduleRequest

* `validateScheduleRequest` must succeed
* valid `competitionId` and `timezone`
* live fingerprint via `fingerprintScheduleRequest` (caller object, not
  window-normalized validator output — windowId normalization must not break
  Phase 1F replay equality)

### Baseline candidate

* `status === BASELINE_SCHEDULE_CANDIDATE`
* `constraintCertification === BASELINE_ONLY`
* same `competitionId`
* fingerprint via `fingerprintBaselineScheduleCandidate`
* no non-bye unscheduled matches
* every scheduled match exists on the request; no duplicates

### Phase 1F result

* `status === CONSTRAINT_CERTIFICATION_RESULT`
* `certification === HARD_CONSTRAINTS_CERTIFIED`
* `ok === true`, no hard violations
* `replay.inputFingerprint` equals live request fingerprint
* `replay.resultFingerprint` equals live candidate fingerprint
* certification object is not mutated

### Physical-assignment boundary

Reject (do not strip) any forbidden fields from
`FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS` on request or candidate decision surfaces
(`courtId`, `courtName`, `courtNumber`, `assignedCourt`, `refereeId`,
`assignedReferee`).

---

## 6. Scope, courts, availability

### Scope (EXTERNAL_REQUIRED)

```js
scope: { tenantId, clubId, venueId }
```

All three required non-empty trimmed strings. No defaults, no first-venue
fallback, no metadata derivation, no Supabase.

### Courts

Accept prebuilt canonical CORE-12 `AvailableCourtInput[]`.

* empty courts fail when assignable matches exist
* venue/club must equal scope; tenant must match when present
* no invented court IDs; no concurrency-index courts; no name→capability inference

### Availability snapshot

Required (`requireAvailabilitySnapshot: true`). Must pass
`createSnapshotRef`. **Model A:** caller supplies trusted snapshot reference;
adapter validates shape only and does **not** claim proof that the fingerprint
authoritatively equals Venue inventory. Missing/invalid/empty fingerprint → fail closed.

---

## 7. Field mapping

| CORE-11 | CORE-12 | Transform |
|---------|---------|-----------|
| `competitionId` | `competitionId` | DIRECT |
| `matchId` | `matchId` | DIRECT |
| `timezone` | `timezone` | DIRECT |
| `startUtcIso` / `startUtcMs` | `scheduledStart` | NORMALIZED absolute ISO |
| `endUtcIso` / `endUtcMs` | `scheduledEnd` | NORMALIZED absolute ISO |
| civil `start`/`end` | `civilWindow` | NORMALIZED `HH:mm` from minutes |
| `durationMinutes` | `durationMinutes` | DIRECT when present |
| `stageId` | `stage` | DIRECT when valid |
| `priority` | `priority` | DIRECT; else CORE-12 default |
| request byes | — | OMITTED from matches |
| `sessionId` | — | OMITTED from court semantics |
| `concurrencyIndex` | — | **FORBIDDEN** as `courtId` |
| `abstractSlotIndex` | — | **FORBIDDEN** as court |
| `capacityReleaseUtcMs` | — | **FORBIDDEN** as `scheduledEnd` |
| display labels | capabilities | **FORBIDDEN** |
| candidate fingerprint | `scheduleSnapshotRef.fingerprint` | DERIVED |
| scope | tenant/club/venue | EXTERNAL_REQUIRED |
| courts | `courts[]` | EXTERNAL_REQUIRED |
| locks | `lockedAssignments` | EXTERNAL explicit only |
| requirements map | `requiredCapabilities` | EXTERNAL optional |

ISO and ms must agree when both present. Times are not rounded or repaired.

Returned `courtAssignmentRequest` is a **plain** projection (no `_startMs` /
`_endMs`) so public `assignCourtsDeterministic` can re-validate safely.

---

## 8. Policy (integration-certified)

Created via public `createCourtAssignmentPolicy` with:

* `partialAssignmentAllowed: false` (explicit `true` rejected, not rewritten)
* `acceptLockedAssignments: true`
* `overrideManualLocks: false`
* `invalidLockBehavior: CONFLICT`
* `allowUnscheduledMatches: false`
* `requireVenueTimezone: true`
* `requireAvailabilitySnapshot: true`
* `capabilityMatchMode: HARD`
* `overlapMode: HALF_OPEN`

No seed (greedy runtime does not use PRNG).

---

## 9. Request construction and fingerprint

* schema: `CORE12_COURT_ASSIGNMENT_SCHEMA_V1`
* deterministic `requestId` from fingerprints + scope (or explicit caller id)
* `scheduleSnapshotRef`: id `CORE11_BASELINE_SCHEDULE_CANDIDATE`, version
  `BASELINE_ONLY`, fingerprint = candidate fingerprint
* request fingerprint: public `fingerprintCourtAssignmentRequest` (assignment-semantic
  projection is integration-private; excludes opaque metadata / internal ms;
  projection version remains replay-visible)

---

## 10. Optional assignment orchestration

`assignCourtsFromCertifiedSchedule`:

1. run handoff gate + request creation
2. `assignCourtsDeterministic(plainRequest)`
3. verify deterministic `resultFingerprint`
4. verify replay snapshot fingerprints
5. status gates: only `SUCCESS` is `ok: true`
6. `PARTIAL` / `INFEASIBLE` / `REJECTED` → structured failure (`ok: false`)
7. partition + certified time equality on SUCCESS
8. provisional INFEASIBLE assignments never treated as success

No publication status. No schedule repair. No input mutation.

---

## 11. Integration diagnostics

Owned codes (`HANDOFF_DIAGNOSTIC_CODE`), ASCII-sorted:

* `SCHEDULE_REQUEST_INVALID`
* `SCHEDULE_NOT_CERTIFIED`
* `SCHEDULE_CANDIDATE_INCOMPLETE`
* `SCHEDULE_CERTIFICATION_MISMATCH`
* `PHYSICAL_ASSIGNMENT_FIELD_PRESENT`
* `COURT_SCOPE_MISSING` / `COURT_SCOPE_MISMATCH`
* `COURT_SNAPSHOT_MISSING` / `COURT_SNAPSHOT_INVALID`
* `AVAILABILITY_SNAPSHOT_MISSING` / `AVAILABILITY_SNAPSHOT_INVALID`
* `COURT_ASSIGNMENT_POLICY_INVALID`
* `COURT_ASSIGNMENT_REQUEST_INVALID`
* `COURT_ASSIGNMENT_FINGERPRINT_MISMATCH`
* `COURT_ASSIGNMENT_PARTIAL` / `INFEASIBLE` / `REJECTED`
* `COURT_ASSIGNMENT_RESULT_INVALID`
* `MATCH_MAPPING_INVALID`
* `COURT_REQUIREMENTS_INVALID`
* `LOCKED_ASSIGNMENT_INVALID`

CORE-11/CORE-12 registries are not modified.

---

## 12. Determinism

* match / court / lock / requirements-map order independence
* deterministic request id + request fingerprint + diagnostics
* no `Date.now`, `Math.random`, random UUID, `localeCompare`
* no host-local timezone derivation
* no input mutation

---

## 13. Traceability (scenarios 1–82)

| # | Scenario | Test / assertion group |
|---|----------|------------------------|
| 1 | Valid single-match handoff | `01 valid certified single-match handoff` |
| 2 | Multi-match handoff | `02 valid multi-match handoff` |
| 3 | Deterministic SUCCESS | `03 valid deterministic court assignment SUCCESS` |
| 4 | ScheduleRequest invalid | `04 ScheduleRequest validation failure` |
| 5–8 | Candidate/cert status failures | `05–08 candidate and certification status/cert failures` |
| 9–11 | Fingerprint/replay mismatch | `09–11 fingerprint and replay mismatches` |
| 12–15 | Completeness / competition | `12–15 completeness and competition gates` |
| 16–17 | Physical court/referee fields | `16–17 physical court and referee fields rejected` |
| 18–20 | Missing scope | `18–20 missing scope fields` |
| 21–23 | Court scope/empty/invalid | `21–23 court scope / empty / invalid snapshot` |
| 24–25 | Availability snapshot | `24–25 availability snapshot missing / invalid` |
| 26–32 | Time/civil/duration/stage/priority | `26–32 time, civil, duration, stage, priority mapping` |
| 27 | UTC-ms fallback | `27 UTC-ms fallback serialization` |
| 28 | ISO/ms mismatch | `28 ISO and ms mismatch` |
| 33–37 | Forbidden/omitted mappings | `33–37 omitted / forbidden semantic mappings` |
| 38–39 | Bye handling | `38–39 bye excluded; scheduled bye rejected` |
| 40–42 | Requirements | `40–42 court requirements` |
| 43–46 | Locks | `43–46 locks` |
| 47–49 | Policy / seed | `47–49 policy: partial rejected, stable ordering, seed omitted` |
| 50–56 | Determinism / no mutation | `50–56 deterministic IDs, fingerprints, order independence, no mutation` |
| 57–64 | SUCCESS partition/times/FP | `57–64 SUCCESS partition, times, fingerprints` |
| 59–62 | PARTIAL/INFEASIBLE/REJECTED | `59–62 PARTIAL / INFEASIBLE / REJECTED / provisional not success` |
| 65–66 | Result FP / replay | `65–66 result fingerprint present and deterministic; replay snapshot aligned` |
| 67–69 | No repair/time mutation/lane map | `67–69 no schedule repair, no time mutation, no lane-to-court` |
| 70–77 | Import/forbidden patterns | `70–77 import and forbidden-pattern boundary` |
| 78–82 | Regression suite presence | `78–82 focused regression suites remain present` |
| R1 | Phase 1F replay semantics | `R1 Phase 1F replay: request/candidate continuity, swap, tamper, unrelated` |
| R2 | Request FP public API / projection private | `R2 request fingerprint public API: metadata exclusion, requestId non-circular, projection private` |
| R3 | Result FP Approach C | `R3 Approach C result fingerprint replay; missing fingerprint rejected` |
| R4 | Bye lock/requirements | `R4 bye lock and bye requirements rejected; request bye excluded from mapped` |
| R5 | Availability Model A | `R5 availability snapshot Model A: empty fingerprint invalid; trust model documented` |
| R6 | Public exports; projection private | `R6 public barrel exports are stable-only; projection builder private` |
| R8 | Duplicate courts/locks | `R8 duplicate court IDs and duplicate locks fail closed` |

---

## 14. Deferred / Phase 1I entry

Deferred:

* Production orchestration / UI / persistence
* automatic Venue composition-root wiring inside this adapter
* CORE-10 optimization loop coupling
* legacy TE/CE cutover
* capability taxonomy enrichment upstream
* rebasing non-colliding CORE-10 main commits

Phase 1I entry criteria (suggested):

* Owner accepts Phase 1H-B review
* composition-root Venue provider wiring authorized
* Production env checklist for court assignment handoff
* no CORE-11/CORE-12 core changes required for the handoff path

---

## 15. Pre-commit review freeze (Phase 1H-B)

### 15.1 Phase 1F certification replay semantics

Exact public meanings (from `certifyBaselineScheduleCandidateConstraints` → `buildResult`):

| Certification field | Exact meaning | Source object | Recompute API |
|---------------------|---------------|---------------|---------------|
| `status` | Always `CONSTRAINT_CERTIFICATION_RESULT` | certification result | constant |
| `certification` | `HARD_CONSTRAINTS_CERTIFIED` or `HARD_CONSTRAINTS_REJECTED` | certification result | from `ok` |
| `ok` | Hard-constraint pass boolean | certification result | — |
| `replay.inputFingerprint` | **ScheduleRequest** semantic fingerprint | live request at cert time | `fingerprintScheduleRequest` |
| `replay.resultFingerprint` | **Baseline candidate** semantic fingerprint | live candidate at cert time | `fingerprintBaselineScheduleCandidate` |
| `replay.engineId` / `engineVersion` | CORE-11 identity echo | schedule engine | constants |
| `replay.details.*` | Certification metadata (status, codes) | certification build | — |

There is **no** separate public “certification-result fingerprint” field.
`replay.resultFingerprint` is **not** a hash of the certification object; it is the
candidate fingerprint by Phase 1F contract.

Adapter verification:

1. Live `fingerprintScheduleRequest(scheduleRequest)` == `replay.inputFingerprint`
2. Live `fingerprintBaselineScheduleCandidate(candidate)` == `replay.resultFingerprint`
3. Integration-owned `sourceCertificationFingerprint` = `fingerprintValue` over
   `{status, certification, ok, inputFingerprint, resultFingerprint}` (integrity of
   the certification envelope as presented — not a Phase 1F primitive)
4. Competition ID continuity request ↔ candidate plan

### 15.2 Request fingerprint projection

Version: `CORE11_CORE12_HANDOFF_REQUEST_FP_V1`
(`HANDOFF_REQUEST_FINGERPRINT_PROJECTION_VERSION` — replay-visible constant)

Projection construction is **integration-private**
(`projectCourtAssignmentRequestForFingerprint` inside
`scheduleToCourtAssignment.js`). It is **not** a public barrel export.

The public fingerprint boundary is:

```js
fingerprintCourtAssignmentRequest(request)
```

Consumers must not construct, import, or depend on the internal projection shape.

**Sequence (non-circular):**

1. Build semantic request partial **without** `requestId`
2. Compute `semanticRequestFingerprint` via public `fingerprintCourtAssignmentRequest`
   (internal projection excludes `requestId` and opaque `metadata`)
3. Derive `requestId = ca-handoff-${semanticRequestFingerprint}` (or explicit caller id)
4. Create/validate CORE-12 request
5. Final handoff `courtAssignmentRequestFingerprint` **equals** step-2 semantic fingerprint

Included: schema/scope/competition/timezone; matches (times, civil, duration, stage,
priority, capabilities, locks flags); courts (status, active/eligible, capabilities,
priority, intervals); locks; policy decision fields; snapshot refs; projection version;
`CORE12_FINGERPRINT_VERSION`.

Excluded: opaque metadata; wall clock; `_startMs`/`_endMs`; display labels; `requestId`
(from default projection).

### 15.3 Result fingerprint — Approach C

`HANDOFF_RESULT_FINGERPRINT_VERIFICATION = DETERMINISTIC_ASSIGNMENT_REPLAY_V1`

* Require non-empty `result.resultFingerprint`
* Re-run `assignCourtsDeterministic` on the same plain request
* Compare fingerprints + partition/times
* Do **not** invent a conflicting public result projection

### 15.4 Bye rules

1. Request-only bye may exist; not mapped to CORE-12
2. Bye never sent to CORE-12 matches
3. Bye in `candidate.plan.scheduled` → fail (`MATCH_MAPPING_INVALID`)
4. No silent filter-to-success
5. Bye excluded from mapped/assignable counts (`byeCount` = request byes)
6. Bye must not receive lock or court requirements

### 15.5 Availability snapshot — Model A

`HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL = MODEL_A_EXTERNAL_AUTHORITATIVE_SNAPSHOT`

Adapter validates shape via `createSnapshotRef` (id/version/fingerprint present).
Does **not** prove fingerprint equals `courts[]` Venue authority.
Composition root supplies trusted courts + snapshot pair.
No random snapshot id; no wall-clock version; no silent placeholder.

### 15.6 Public exports

Stable barrel exports only:

* `createCourtAssignmentRequestFromCertifiedSchedule`
* `assignCourtsFromCertifiedSchedule`
* `fingerprintCourtAssignmentRequest` (public fingerprint boundary)
* status + diagnostic constants
* fingerprint projection **version** / result verification / trust-model constants
  (replay-visible; not the projection builder itself)

Private (not exported):

* `projectCourtAssignmentRequestForFingerprint` (canonical projection builder)
* diagnostic constructors/sorters
* `toPlainCourtAssignmentRequest`
* other internal helpers

Consumers must not construct or depend on the private projection shape.

### 15.7 Failure envelopes

Request creation always returns `courtAssignmentResult: null`.
On failure: `courtAssignmentRequest: null`, `ok: false`.
Assignment non-success (`PARTIAL`/`INFEASIBLE`/`REJECTED`): `ok: false`, preserves
CORE-12 result for diagnostics, never commits provisional assignments.

### 15.8 Duplicates

Validate before sort. Duplicate court IDs → `DUPLICATE_COURT_ID`.
Two locks for one match → `DUPLICATE_LOCK`. No silent dedupe of contradictory data.

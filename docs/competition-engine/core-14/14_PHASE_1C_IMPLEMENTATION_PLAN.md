# CORE-14 — Phase 1C Implementation Plan

**Phase:** 1C — Dormant Domain Foundation
**Status:** Authorized — `AUTHORIZE_CORE_14_PHASE_1C_DORMANT_DOMAIN_FOUNDATION`
**Owner note:** Phase 1B approved; Phase 1C may implement isolated domain foundation + unit tests only (dormant, unwired)
**Date:** 2026-07-22

---

## 1. Objective of Phase 1C (when authorized)

Implement a dormant, capability-local CORE-14 domain foundation under:

```text
src/features/competition-core/resource-conflict/
```

Conforming to Phase 1B / 1B-S contracts, still **non-production**:

- No root `competition-core/index.js` export
- No feature-flag ON
- No SQL
- No production wiring
- No imports from unfinished CORE-10/11/12/13 internals
- No Venue & Court internal imports

---

## 2. Proposed source layout

```text
src/features/competition-core/resource-conflict/
  domain/
    CanonicalResourceKey.js
    ResourceOccupancy.js
    ResourceFinding.js
    DetectionRequest.js
    DetectionResult.js
    ResolutionRecommendation.js
    ValidationRequest.js
    ValidationResult.js
    enums.js
  catalogs/
    findingCatalog.js
    diagnosticCatalog.js
    severityPolicy.js
    capacityPolicy.js
  time/
    interval.js
    overlap.js
  ports/
    availabilityPort.js
  services/
    normalizeRequest.js
    detectConflicts.js
    recommendResolutions.js
    validateRecommendations.js
    fingerprint.js
    canonicalSerialize.js
  errors/
    reasonCodes.js
  index.js
```

Exact file split may consolidate; logical modules above are mandatory.

---

## 3. Proposed tests (when authorized)

```text
tests/competition-core-resource-conflict-core14-phase1c.test.js
```

Cover the matrix in §5. Do not register into Integrator `unit-test-files.json` unless Owner authorizes.

---

## 4. Reviewable increments

### Increment 1 — Domain + catalogs + time

- CanonicalResourceKey serialize/validate (no silent identity transform)
- ResourceOccupancy normalize (always-required fields; activity identity)
- `Number.isSafeInteger` half-open overlap + adjacent non-conflict
- Finding/diagnostic/severity catalogs as data
- `DUPLICATE_OCCUPANCY_ID` / `DUPLICATE_ASSIGNMENT` precedence

### Increment 2 — Detection engine

- EvaluationStatus / PlanStatus / AvailabilityCertification separation
- Overlap / capacity scan / rest findings
- Venue vs generic code precedence
- Authoritative vs advisory availability handling with port fakes
- Advisory unknown → `VALID_WITH_WARNINGS` + `PARTIAL`

### Increment 3 — Recommendations + dry-run validation

- Deterministic recommendation IDs/ranks
- Locked/published flags
- Projection without alias mutation
- Secondary conflict detection

### Increment 4 — Fingerprints + boundary tests

- SHA-256 over UTF-8 canonical bytes
- Reordered equivalent input parity
- No illegal imports (static test)
- CORE-10 projector DTO mapping test doubles only

---

## 5. Test contract matrix (Phase 1C+)

| # | Case |
|---|------|
| 1 | Resource key independent of time |
| 2 | Deterministic resource key serialization |
| 3 | Same resource with multiple occupancies |
| 4 | Canonical safe-integer epoch millisecond validation |
| 5 | Invalid / non-safe-integer / fractional / string time rejected |
| 6 | Adjacent half-open intervals do not conflict |
| 7 | Partial overlap conflicts |
| 8 | Three-way overlap |
| 9 | Slot-to-interval success (adapter) |
| 10 | Unresolved slot failure |
| 11 | No implicit duration |
| 12 | Explicit duration diagnostic |
| 13 | Referee overlap HARD |
| 14 | Mandatory rest HARD |
| 15 | Preferred rest SOFT |
| 16 | Severity downgrade rejected |
| 17 | Caller severity raise accepted |
| 18 | Same venue with free independent courts → no venue conflict |
| 19 | Venue capacity exceeded |
| 20 | No generic + specialized duplicate finding |
| 21 | Authoritative availability failure → DATA_UNAVAILABLE / NOT_EVALUATED |
| 22 | Advisory availability unknown → COMPLETED + VALID_WITH_WARNINGS + PARTIAL |
| 23 | Locked assignment protection |
| 24 | Published assignment protection |
| 25 | Deterministic recommendation order |
| 26 | Original conflict resolved in dry-run |
| 27 | Secondary conflict introduced in dry-run |
| 28 | Dry-run mutation safety |
| 29 | evaluationStatus versus planStatus |
| 30 | Deterministic IDs |
| 31 | Reordered equivalent input → same fingerprint |
| 32 | CORE-10 projector boundary (consume-only mapping) |
| 33 | No imports from unfinished adjacent CORE modules |
| 34 | `DUPLICATE_OCCUPANCY_ID` primary over `DUPLICATE_ASSIGNMENT` when both apply |
| 35 | `ACTIVITY_IDENTITY_MISSING` when assignmentId/activityId/matchId all absent |
| 36 | `ASSIGNMENT_ID_MISSING` only when `requireAssignmentId` |
| 37 | Identity strings not silently trimmed / lower-cased / Unicode-normalized |
| 38 | Always-required `capacityUnits` / `locked` / `published` / `source` |

---

## 6. Entry criteria for Phase 1C

1. Phase 1B contracts Owner-accepted (**done**: approved with pre-Phase-1C gates)
2. Phase 1B-S sync + contract consistency certified
3. Clean worktree authorization for implementation phase
4. Explicit Owner authorization text for Phase 1C source/tests
5. No Production wiring in the same authorization unless separately named

---

## 7. Explicit non-goals for Phase 1C

- Persistence / SQL
- UI
- Notifications
- Deploy
- Applying recommendations to live schedules
- Global optimizer implementation inside CORE-14

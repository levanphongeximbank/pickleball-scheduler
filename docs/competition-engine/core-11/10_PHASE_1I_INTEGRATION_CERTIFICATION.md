# CORE-11 Phase 1I — Final End-to-End Integration Certification

| | |
|--|--|
| **Phase** | **1I — Public-chain integration certification** |
| **Date** | 2026-07-22 |
| **Path** | `CORE_11_PHASE_1I_PATH_A_TESTS_AND_CERTIFICATION_DOCS_ONLY` |
| **Prior** | Phase 1E-R1 rest-aware placement (`09_PHASE_1I_BLOCKER_REST_AWARE_PLACEMENT.md`) |
| **Status** | Implementation complete (not committed) |
| **Document number** | `10` (document `09` reserved for blocker remediation) |

---

## 1. Objective

Certify that the **public** competition-core chain is sufficient to schedule and assign courts for a canonical three-match fixture without production orchestration helpers and without modifying runtime modules.

Certified chain:

```text
CORE-09 MatchPlan
→ CORE-11 MatchPlan adapter
→ CORE-11 ScheduleRequest
→ CORE-11 rest-aware baseline scheduler
→ CORE-11 hard-constraint certification
→ integration certified-schedule handoff
→ CORE-12 deterministic court assignment
```

Primary success must reach CORE-12 `SUCCESS`.

---

## 2. Scope and exclusions

**In scope**

* Tests: `tests/competition-core-core09-core11-core12-integration-certification.test.js`
* Docs: this file
* Public barrels only

**Out of scope / explicitly not claimed**

* Venue persistence / Supabase authority
* Production cutover / UI / publication
* CORE-10 optimization loop
* Runtime orchestration helper (`certifyCompetitionPlanPipeline.js` not created)
* Changes to CORE-09 / CORE-11 / integration / CORE-12 / Venue / CORE-10 / CORE-13 / CORE-14 runtime

---

## 3. Public API chain

| Stage | Public entry |
|--|--|
| A | `assembleMatchPlan`, `assertMatchPlanValid`, `fingerprintMatchPlan` |
| B | `createScheduleRequestFromMatchPlan`, `validateScheduleRequest`, `fingerprintScheduleRequest` |
| C | `buildBaselineScheduleCandidate`, `fingerprintBaselineScheduleCandidate` |
| D | `certifyBaselineScheduleCandidateConstraints` |
| E | `createCourtAssignmentRequestFromCertifiedSchedule`, `fingerprintCourtAssignmentRequest` |
| F | `assignCourtsFromCertifiedSchedule` |

---

## 4. Rest-aware blocker resolution reference

Phase 1I was previously blocked because baseline placement ignored `minParticipantRestMinutes` under zero buffers. Phase 1E-R1 remediated placement so:

```text
m3 earliest = m1.actualEnd + 15 minutes → 08:45
```

See: `docs/competition-engine/core-11/09_PHASE_1I_BLOCKER_REST_AWARE_PLACEMENT.md`.

This Phase 1I document certifies the **post-remediation** public chain.

---

## 5. Model A Venue trust boundary

Availability trust model constant:

```text
MODEL_A_EXTERNAL_AUTHORITATIVE_SNAPSHOT
```

The fixture supplies a shape-valid `availabilitySnapshotRef` and prebuilt `AvailableCourtInput[]` as if from an external Venue composition root.

**Not certified:** live Venue CAA, descriptor persistence, or Supabase snapshot authority.

---

## 6. Canonical success fixture

| Field | Value |
|--|--|
| `competitionId` | `comp-1i-e2e-001` |
| Timezone | `Asia/Ho_Chi_Minh` |
| Civil date | `2026-08-01` |
| Window | `08:00–18:00` (480–1080) |
| Scope | `tenant-1i` / `club-1i` / `venue-1i` |
| Policy | rest 15, buffers 0, capacity 2, duration 30 |
| Matches | m1 P1–P2; m2 P3–P4; m3 P1–P5 (shared P1) |
| Courts | `court-a`, `court-b` (indoor, active, eligible) |
| Partial | `partialAssignmentAllowed: false` |

Expected schedule:

```text
m1: 08:00–08:30 (ci 0)
m2: 08:00–08:30 (ci 1)
m3: 08:45–09:15 (ci 0)
```

---

## 7. Stage A–F results

| Stage | Status | Key assertions | PASS |
|--|--|--|--|
| A MatchPlan | valid | fingerprint stable; no forbidden schedule/court/referee/score/lifecycle fields | PASS |
| B Adapter | `ok: true` | IDs preserved; identities explicit; ScheduleRequest validates | PASS |
| C Baseline | `BASELINE_SCHEDULE_CANDIDATE` / `BASELINE_ONLY` | times as above; rest ≥15; no overlap | PASS |
| D Certification | `HARD_CONSTRAINTS_CERTIFIED` | replay input/result fingerprints match live objects | PASS |
| E Handoff | `ok: true` | request validates; deterministic ID/FP; Model A trust | PASS |
| F Assignment | `SUCCESS` | 3 assignments; no overlaps; times preserved; replay stable | PASS |

---

## 8. Failure matrix 1–32

| ID | Scenario | Earliest public boundary | PASS |
|--|--|--|--|
| F01 | Invalid MatchPlan | adapter `MATCH_PLAN_INVALID` | PASS |
| F02 | Missing identity enrichment | adapter identity/policy missing | PASS |
| F03 | Unresolved placement | `PLACEMENT_IDENTITY_MISSING` / related | PASS |
| F04 | Dependency contradiction | `MATCH_PLAN_DEPENDENCY_INCONSISTENT` | PASS |
| F05 | MatchPlan FP mismatch | `GENERATION_FINGERPRINT_MISMATCH` | PASS |
| F06 | Invalid timezone | adapter fail-closed | PASS |
| F07 | Missing duration policy | `SCHEDULE_POLICY_MISSING` | PASS |
| F08 | Dependency cycle | `CYCLIC_MATCH_DEPENDENCY` | PASS |
| F09 | Shared participant overlap | forged → `PARTICIPANT_OVERLAP` | PASS |
| F10 | Insufficient rest | forged → `INSUFFICIENT_REST` | PASS |
| F11 | Abstract capacity | forged → `CAPACITY_EXCEEDED` | PASS |
| F12 | Unscheduled non-bye | tiny window → cert reject | PASS |
| F13 | Cert replay swap | `SCHEDULE_CERTIFICATION_MISMATCH` | PASS |
| F14 | Candidate time tamper | handoff mismatch / incomplete | PASS |
| F15 | Missing tenantId | `COURT_SCOPE_MISSING` | PASS |
| F16 | Missing clubId | `COURT_SCOPE_MISSING` | PASS |
| F17 | Missing venueId | `COURT_SCOPE_MISSING` | PASS |
| F18 | Missing courts | `COURT_SNAPSHOT_MISSING` | PASS |
| F19 | Missing availability | `AVAILABILITY_SNAPSHOT_MISSING` | PASS |
| F20 | Scheduled bye | `MATCH_MAPPING_INVALID` (or earlier FP gate) | PASS |
| F21 | Forbidden physical field | `PHYSICAL_ASSIGNMENT_FIELD_PRESENT` | PASS |
| F22 | Partial assignment enabled | `COURT_ASSIGNMENT_POLICY_INVALID` | PASS |
| F23 | Bad availability FP | `AVAILABILITY_SNAPSHOT_INVALID` | PASS |
| F24 | Insufficient physical courts | `INFEASIBLE` / `COURT_ASSIGNMENT_INFEASIBLE` | PASS |
| F25 | Court scope mismatch | `COURT_SCOPE_MISMATCH` | PASS |
| F26 | Capability mismatch | `INFEASIBLE` | PASS |
| F27 | Conflicting locks | `DUPLICATE_LOCK` | PASS |
| F28 | Partial result path | policy gate (same as F22) | PASS |
| F29 | Invalid court snapshot | `COURT_SNAPSHOT_INVALID` | PASS |
| F30 | Result FP type boundary | result FP ≠ request FP | PASS |
| F31 | Assignment-time mutation | certified times unchanged | PASS |
| F32 | Duplicate courtId | `DUPLICATE_COURT_ID` | PASS |

Where an earlier gate fires first, the test asserts the **actual** earliest public diagnostic.

---

## 9. Fingerprint continuity

| Fingerprint | Object | Test |
|--|--|--|
| MatchPlan | MatchPlan | `1I-FP`, Stage A |
| ScheduleRequest | ScheduleRequest | `1I-FP`, Stage B |
| Candidate | baseline candidate | `1I-FP`, Stage C |
| Cert replay input | ScheduleRequest | Stage D |
| Cert replay result | candidate | Stage D |
| Handoff request | CORE-12 request | Stage E / `1I-FP` |
| CORE-12 result | assignment result | Stage F / `1I-FP` |

Type-swapped comparisons fail; semantic tampering fails; no projection-helper imports.

---

## 10. Determinism

| ID | Variation | Result |
|--|--|--|
| D01 | Reversed logical-match order | identical MatchPlan FP |
| D02 | Reversed order → ScheduleRequest FP | identical |
| D03 | Reversed order → candidate + certification | identical |
| D04 | Reversed courts | identical request FP + SUCCESS |
| D05 | Duration 45 | ScheduleRequest FP changes |
| D06 | Reversed courts | identical assignment mapping |

---

## 11. No mutation

| ID | Assertion |
|--|--|
| M01 | Adapter does not mutate MatchPlan/policy |
| M02 | Baseline does not mutate ScheduleRequest |
| M03 | Certification does not mutate request/candidate |
| M04 | Handoff create does not mutate inputs |
| M05 | Assign does not mutate certified times |

---

## 12. Abstract versus physical capacity

* Abstract capacity 2 allows m1∥m2 at 08:00; rest places m3 at 08:45 → CORE-11 certifies.
* One physical court → CORE-12 `INFEASIBLE`; integration `ok: false`; times unchanged; no reschedule (`1I-S07`, `1I-F24`).

---

## 13. Ownership and import boundary

| ID | Boundary |
|--|--|
| B01 | CORE-09 ↛ CORE-11 / integration / CORE-12 |
| B02 | CORE-11 core ↛ integration / CORE-12 |
| B03 | CORE-12 ↛ CORE-11 / integration |
| B04 | Integration → public barrels only |
| B05 | Adapter → public CORE-09 barrel only |
| B06 | No Supabase / TE / Court Engine / Venue / optimizer |
| B07 | Phase 1I test imports only `*/index.js` barrels |
| B08 | No `Date.now` / `Math.random` / `randomUUID` / `localeCompare` in test |

---

## 14. Traceability

Every `1I-S##`, `1I-F01`–`1I-F32`, `1I-D##`, `1I-M##`, `1I-B##`, and `1I-FP` maps 1:1 to a `test("…")` name in:

`tests/competition-core-core09-core11-core12-integration-certification.test.js`

All identifiers: **PASS**.

---

## 15. Test commands and results

```text
node --test tests/competition-core-core09-core11-core12-integration-certification.test.js
→ 59 pass

Focused baselines:
→ CORE-09: 142
→ CORE-11 (1B–1G + 1E-R1): 336
→ CORE-12: 177
→ Phase 1H-B: 33

Combined focused (baselines + Phase 1I):
→ 747 pass (= 688 + 59)
```

---

## 16. Residual risks

* Model A Venue trust remains external.
* Live capability enrichment / Venue CAA not certified.
* CORE-10 optimizer loop not in chain.
* Greedy baseline is first-feasible, not globally optimal.

---

## 17. Production-cutover exclusions

No PR, deploy, persistence, UI, publication, or Production orchestration in this phase.

---

## 18. Final certification criteria

Phase 1I Path A is review-ready when:

1. Public success chain reaches CORE-12 `SUCCESS` with the authorized rest/buffer fixture.
2. Abstract-pass / physical-fail fixture passes.
3. Failure matrix 1–32 has explicit assertions.
4. Fingerprint / determinism / mutation / ownership suites pass.
5. Exactly two authorized files exist; HEAD unchanged; nothing staged.

---

## 19. PR entry criteria

Defer to Owner. This phase stops after implementation + focused verification (no commit/push/PR).

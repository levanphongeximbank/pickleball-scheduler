# CORE-14 — Phase 1E Dormant Resolution Recommendations and Dry-Run Validation

**Phase:** 1E
**Status:** Implemented (dormant / unwired)
**Date:** 2026-07-22
**Owner authorization:** `AUTHORIZE_CORE_14_PHASE_1E_DORMANT_RESOLUTION_RECOMMENDATIONS_AND_VALIDATION`
**Prior verdict:** `CORE_14_PHASE_1D_APPROVED`

---

## 1. Recommendation ownership

CORE-14 Phase 1E owns:

- deterministic local resolution recommendation generation;
- structured recommendation deltas;
- dry-run projection of recommendation changes;
- validation against existing Phase 1D detectors;
- original-conflict resolution checks;
- secondary-conflict detection;
- deterministic recommendation ranking;
- automatic-eligibility classification;
- manual-review fallback recommendations.

CORE-14 Phase 1E does **not** own schedule generation, inventory search, global optimization, assignment mutation, persistence, SQL, UI, workflow, notifications, production adapters, publishing, or automatic recommendation application.

Module remains capability-local under `src/features/competition-core/resource-conflict/`.
Root `src/features/competition-core/index.js` is **not** modified.

---

## 2. Resolution policy

Immutable `ResolutionPolicy` V1 (`normalizeResolutionPolicy` / `createResolutionPolicy`):

| Field | Rule |
|-------|------|
| `policyVersion` | Required non-empty |
| `allowedActionTypes` | Unknown values fail closed |
| `maximumRecommendationCount` | Safe integer `> 0` |
| `maximumCandidatesPerConflict` | Safe integer `> 0` |
| `maximumChangedAssignments` | Safe integer `> 0` |
| `maximumShiftMs` | Safe integer `>= 0` |
| `allowedEvaluationStartMs` / `EndMs` | Safe-integer epoch ms; start `<` end when supplied |
| `allowTouchLocked` / `allowTouchPublished` | Default **false**; no hidden expansion |
| Candidate windows / keys / capacities | Canonical intervals / CanonicalResourceKey / safe integers `> 0` |

Caller policy input is never mutated.

---

## 3. Caller-supplied candidate requirement

Candidates may only be produced from options present in the policy/request:

- `candidateTimeWindows`
- `candidateCourtResources`
- `candidateRefereeResources`
- `candidateCapacityValues`

CORE-14 must not invent time windows, courts, referees, capacities, availability, or inventory.
If no suitable caller option exists, emit `MARK_FOR_MANUAL_REVIEW` or `NO_SAFE_AUTOMATIC_RESOLUTION`.

---

## 4. Structured deltas

Frozen action types (no `REMOVE_ASSIGNMENT`):

- `MOVE_ASSIGNMENT_TIME`
- `REASSIGN_COURT`
- `REASSIGN_REFEREE`
- `INSERT_REST_GAP`
- `REDUCE_CAPACITY_USAGE`
- `MARK_FOR_MANUAL_REVIEW`
- `NO_SAFE_AUTOMATIC_RESOLUTION`

Deltas are plain frozen structures only (no functions, callbacks, class instances, DB records, or mutable aliases).

---

## 5. Lock and published protection

Before automatic-eligible emission:

| Condition | Behavior |
|-----------|----------|
| Locked and `allowTouchLocked=false` | No automatic mutation; manual/no-safe; `violatesLock=true`; `automaticEligible=false` |
| Published and `allowTouchPublished=false` | Same with `affectsPublishedAssignment=true` |
| Explicit allow touch | Recommendation may exist; `requiresManualApproval=true`; `automaticEligible=false` |

Locked/published candidates are never silently ranked as automatic.

---

## 6. Scope protection

Court reassignment requires `resourceKind=COURT`.
Referee reassignment requires `resourceKind=REFEREE`.
Cross-scope reassignment requires `allowCrossScopeResourceChange=true`; then `crossesScopeBoundary=true`, manual only.

---

## 7. Projection behavior

`projectRecommendation` applies one recommendation to **copies** of baseline occupancies.

| Action | Permitted field changes |
|--------|-------------------------|
| Time move / rest gap | `startMs`, `endMs` |
| Court / referee reassign | targeted `resourceKey` only |
| Capacity reduce | `capacityUnits` only |

Never changes: `occupancyId`, `assignmentId`, `activityId`, `matchId`, `competitionId`, `locked`, `published`, unrelated rows, or caller input.
Missing or ambiguous targets fail closed.

---

## 8. Validation algorithm

`validateResolutionRecommendation`:

1. Validate recommendation contract.
2. Project occupancy copies.
3. Re-run Phase 1D `detectResourceConflicts` with the same detector policies / facts.
4. Compare baseline vs projected finding identities (exact ID + continuity).
5. Classify resolved / unresolved / secondary HARD / secondary SOFT.
6. Check lock, published, scope, shift, changed-assignment, and action policy limits.
7. Emit deterministic `ResolutionValidationResult` + fingerprint.

Does **not** call recommendation generation. Does **not** mutate caller data.

Validation statuses: `COMPLETED`, `REJECTED_INVALID_RECOMMENDATION`, `DATA_UNAVAILABLE`, `UNSUPPORTED`.

---

## 9. Root-conflict continuity

| Mechanism | Includes interval? | Purpose |
|-----------|--------------------|---------|
| Exact finding ID (`CORE14_FID_V1`) | Yes | Exact equality |
| Continuity key (`CORE14_RCK_V1`) | **No** | Materially equivalent root conflict |

Continuity key includes finding type, canonical resource key, sorted logical assignment/activity identities, and policy identity.
Phase 1D finding ID contract is unchanged.

---

## 10. Secondary-conflict classification

- Baseline set = baseline finding IDs / continuity keys.
- Projected set = projected finding IDs / continuity keys.
- Secondary = projected continuity keys absent from baseline.
- Resolved = baseline target IDs absent from projected ID **and** continuity sets.
- Unchanged pre-existing conflicts are not secondary.

---

## 11. Deterministic ranking

Frozen order:

1. `violatesLock` false before true
2. `affectsPublishedAssignment` false before true
3. validation completed before incomplete
4. all targets resolved before unresolved
5. zero secondary HARD before any
6. fewer secondary HARD
7. fewer secondary SOFT
8. `requiresManualApproval` false before true
9. `automaticEligible` true before false
10. fewer changed assignments
11. lower absolute `estimatedShiftMs`
12. action type ordinal
13. sorted target assignment ids
14. sorted target occupancy ids
15. `recommendationId`

Manual-review after safe mutation candidates; `NO_SAFE_AUTOMATIC_RESOLUTION` last.
Caller input order is not a tie-break.

---

## 12. Result envelope

`proposeResourceConflictResolutions` returns:

- `evaluationStatus`
- `baselineDetectionFingerprint`
- `recommendations` (ranked proposals only)
- counts (`automaticEligibleRecommendationCount`, `manualReviewRecommendationCount`, `noSafeResolutionCount`, `evaluatedCandidateCount`, `rejectedCandidateCount`, `unresolvedConflictCount`, `recommendationCount`)
- `deterministicFingerprint`
- `diagnostics`
- `metadata`
- `selectedMutationState: null`
- `appliedOccupancies: null`

`recommendationCount` never implies application.

---

## 13. Complexity

| Step | Bound |
|------|-------|
| Candidate materialization | O(F × C) findings × caller candidates |
| Dedup / limits | O(R log R) |
| Dry-run validation per candidate | Phase 1D detection cost on projected copy |
| Ranking | O(R log R) |

No global search. No recursive recommendation generation inside validation.

---

## 14. Tests

Focused suite: `tests/competition-core-resource-conflict-core14-phase1e.test.js` (86 cases).
Also preserve Phase 1C / 1D focused suites and Competition Core architecture regression used previously.

---

## 15. Non-goals

- Wiring CORE-10 / 11 / 12 / 13
- Production adapters
- SQL / UI / persistence / deploy
- Automatic application of recommendations
- Global optimizer or inventory invention
- Root `competition-core` export
- Commit / push / PR under this authorization unless Owner separately requests

# CORE-14 — ResolutionRecommendation

**Contract family:** `core14-resolution-recommendation-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Principle

Recommendations are **structured deltas only**.

CORE-14:

- **must not** apply recommendations
- **must not** mutate caller occupancies
- **may** produce ordered recommendations for consumers (CORE-10/11/12/13)

---

## 2. Shape

```text
ResolutionRecommendation {
  recommendationId: string
  conflictIds: string[]                 // sorted findingIds
  actionType: ResolutionActionType
  targetAssignmentIds: string[]         // sorted
  proposedChanges: ProposedChange[]     // canonical ordered
  affectedResourceKeys: CanonicalResourceKey[]
  estimatedShiftMinutes: number | null
  violatesLock: boolean
  affectsPublishedAssignment: boolean
  expectedResolvedConflictIds: string[]
  possibleSecondaryConflictKeys: CanonicalResourceKey[]
  requiresManualApproval: boolean
  deterministicRank: number             // 1..N stable order
  reasonCode: string
  policyVersion: string
}
```

---

## 3. ResolutionActionType (minimum)

| Action | Intent |
|--------|--------|
| `MOVE_ASSIGNMENT_TIME` | Propose new `startMs`/`endMs` for assignment occupancy |
| `REASSIGN_COURT` | Propose different court resource id |
| `REASSIGN_REFEREE` | Propose different referee resource id |
| `INSERT_REST_GAP` | Propose time shift/gap to satisfy rest |
| `REDUCE_CAPACITY_USAGE` | Propose lower `capacityUnits` or remove concurrent use |
| `MARK_FOR_MANUAL_REVIEW` | No automatic delta; escalate |
| `NO_SAFE_AUTOMATIC_RESOLUTION` | Explicitly no safe automatic move |

---

## 4. ProposedChange (minimum)

```text
ProposedChange {
  assignmentId: string
  field: "startMs" | "endMs" | "resourceId" | "capacityUnits" | "resourceKey"
  fromValue: string | number | CanonicalResourceKey | null
  toValue: string | number | CanonicalResourceKey | null
}
```

Canonical ordering of `proposedChanges`:

1. `assignmentId` ascending
2. `field` ascending
3. serialized `fromValue` / `toValue` as tie-breakers

---

## 5. Safety flags

| Flag | Rule |
|------|------|
| `violatesLock` | True if any target occupancy has `locked=true` |
| `affectsPublishedAssignment` | True if any target has `published=true` |
| `requiresManualApproval` | True if violates lock, affects published, or action is manual/no-safe |

Locked/published protection does not delete the recommendation; it marks it unsafe for automatic application.

---

## 6. Ranking

`deterministicRank` is assigned after sorting recommendations by a frozen tuple:

```text
(
  actionTypePriority,
  estimatedShiftMinutes asc (nulls last),
  recommendationId asc
)
```

Action type priority (v1):

1. `MOVE_ASSIGNMENT_TIME`
2. `INSERT_REST_GAP`
3. `REASSIGN_COURT`
4. `REASSIGN_REFEREE`
5. `REDUCE_CAPACITY_USAGE`
6. `MARK_FOR_MANUAL_REVIEW`
7. `NO_SAFE_AUTOMATIC_RESOLUTION`

Consumers may re-rank for global optimization but must not claim CORE-14 rank semantics changed.

---

## 7. Finding ↔ action permission

Only action types listed as permitted for a finding code in [05_RESOURCE_FINDING_CATALOG.md](./05_RESOURCE_FINDING_CATALOG.md) may be emitted for that finding. Multi-finding recommendations must be permitted for every included finding or escalate to `MARK_FOR_MANUAL_REVIEW` / `NO_SAFE_AUTOMATIC_RESOLUTION`.

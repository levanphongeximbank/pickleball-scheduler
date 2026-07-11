# CC-03A — Context Resolution

**Phase:** CC-03A | **Date:** 2026-07-12

---

## 1. Purpose

Constraints must be filterable by operational context before evaluation. CC-03A resolves raw input into a canonical `ConstraintContext` and filters rules via `expandApplicableRules()`.

---

## 2. ConstraintContext fields

| Field | Purpose |
|-------|---------|
| `scope` | `pairing`, `group`, `match`, `draw`, `lineup`, `entry` |
| `tenantId` | Multi-tenant isolation |
| `clubId` | Club-scoped rules |
| `tournamentId` | Tournament-scoped rules |
| `eventId` | Event/draw unit |
| `sessionId` | Session/round |
| `venueId` | Venue-specific rules |
| `competitionType` | Internal / official / daily play |
| `gender` | Gender category filter |
| `ageGroup` | Age bracket filter |
| `skillMin` / `skillMax` | Skill band filter |
| `evaluatedAt` | ISO timestamp for effective-time rules |
| `teamSize` | Team capacity (default 2) |
| `playersById` | Player snapshots (check-in, busy, skill, gender) |
| `partnerRepeatCounts` | Soft repeat history |
| `opponentRepeatCounts` | Soft opponent history |
| `lineupSlots` | Lineup validity checks |
| `entriesByPlayerId` | Entry eligibility records |

---

## 3. Constraint applicability (per rule)

Each `ConstraintDefinition.applicability` may specify the same dimensional filters plus:

- `effectiveFrom` / `effectiveTo` — time window

Rules not matching context are **skipped** (not rejected).

---

## 4. Resolution flow

```
resolveContext(rawInput)
  → canonical ConstraintContext

expandApplicableRules(constraints, context)
  → filters by enabled, scope, applicability, effective time

toRuleEvaluationContext(context, candidate)
  → merges candidate teams/groups/match into evaluator context
```

---

## 5. Example

```javascript
const context = resolveContext({
  scope: "pairing",
  clubId: "club-a",
  tournamentId: "t-123",
  evaluatedAt: "2026-07-12T10:00:00.000Z",
  teamSize: 2,
  playersById: {
    "p1": { checkedIn: true, available: true, skillLevel: 3.5, gender: "male" },
  },
});

const applicable = expandApplicableRules(ruleSet.constraints, context);
```

Rule with `applicability: { clubId: "club-b" }` → skipped when context `clubId` is `club-a`.

---

## 6. Rule set version selection

`selectRuleSetVersion(ruleSets, context)` picks the newest **active/locked** rule set whose `effectiveFrom <= evaluatedAt` and is not archived.

Lifecycle validation via `validateRuleSetLifecycle()` rejects archived or not-yet-effective sets.

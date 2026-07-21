# CORE-09 — Phase 1F Adapter Readiness Matrix

**Purpose:** Document integration boundaries that require adapters before production cutover.
**Phase:** 1F — documentation only. **Do not implement these adapters in Phase 1F.**

## Legend

| Field | Meaning |
|-------|---------|
| Adapter required | Whether a mapper must exist before production wiring |
| Dormant or production | Whether any adapter code exists today |
| Blocker status | Whether the gap blocks CORE-09 capability closure / Phase 1F docs |

---

## 1. CORE-01 evaluated rules → CORE-09 `EvaluatedMatchGenerationRules`

| Field | Value |
|-------|-------|
| Current state | CORE-01 provides `RULE_OPERATION.MATCHUP` (alias `MATCH_GENERATE`). No producer emits the exact CORE-09 `EvaluatedMatchGenerationRules` shape. CORE-09 ports use fixed / fail-closed doubles in tests. |
| Source ownership | CORE-01 Rule Engine / constraints |
| Target ownership | CORE-09 Match Generator (consumer) |
| Adapter required | **Yes** — additive mapping of evaluated MATCHUP output → `EvaluatedMatchGenerationRules` |
| Dormant or production | **Dormant recommended** — not implemented |
| Blocker status | **Not a CORE-09 capability blocker**; **production integration prerequisite** |
| Prerequisite for cutover | Owner-approved dormant adapter + fingerprint parity tests; no second Rule Engine inside CORE-09 |

**Classification language (locked):** additive dormant adapter recommended · not a CORE-09 capability blocker · production integration prerequisite.

---

## 2. CORE-08 Draw Runtime → CORE-09 `DrawSnapshot`

| Field | Value |
|-------|-------|
| Current state | CORE-08 `draw-runtime` emits `DrawResolveResult` / runtime `DrawSnapshot` with `placements`, `groups`, `brackets`, `byes`, `identityKey`, `recordedAt`. CORE-09 expects frozen `drawId` / `drawVersion` / `drawFingerprint` / `completionStatus` / `participantPlacements` / catalogs. |
| Source ownership | CORE-08 Draw / Draw Runtime |
| Target ownership | CORE-09 Match Generator (consumer) |
| Adapter required | **Yes** — additive shape mapping; must not rerun Draw or mutate placements |
| Dormant or production | **Dormant required** — not implemented |
| Blocker status | **Not a Phase 1F documentation blocker**; **production integration prerequisite** |
| Prerequisite for cutover | Owner-approved dormant adapter that preserves placement order, group/bracket coordinates, and Draw-owned bye placements |

**Classification language (locked):** additive dormant adapter required · not a Phase 1F documentation blocker · production integration prerequisite.

---

## 3. CORE-09 `MatchPlan` → Scheduling

| Field | Value |
|-------|-------|
| Current state | Scheduling uses `matchId`, `entryAId`, `entryBId`, optional times/courts. MatchPlan is logical-only (`logicalMatchKey`, slots, deps). |
| Source ownership | CORE-09 Match Generator |
| Target ownership | Scheduling (historical CC-09 / `competition-core/scheduling`) |
| Adapter required | **Yes** — downstream-owned |
| Dormant or production | **Deferred by ownership** — not CORE-09-owned |
| Blocker status | **Not a capability closure blocker**; required before production cutover that feeds scheduling from MatchPlan |
| Prerequisite for cutover | Scheduling-owned mapper; must not write schedule fields back onto MatchPlan |

---

## 4. CORE-09 `MatchPlan` → Match Lifecycle

| Field | Value |
|-------|-------|
| Current state | Match Lifecycle owns live status, scores, advancement. MatchPlan provides structure + winner/loser dependency edges only. |
| Source ownership | CORE-09 |
| Target ownership | Match Lifecycle / match runtime |
| Adapter required | **Yes** — downstream-owned |
| Dormant or production | **Deferred by ownership** |
| Blocker status | **Not a capability closure blocker** |
| Prerequisite for cutover | Lifecycle-owned consumption of LogicalMatch keys + dependency graph; no lifecycle fields on MatchPlan |

---

## 5. CORE-09 `MatchPlan` → Court Assignment

| Field | Value |
|-------|-------|
| Current state | Court assignment is a scheduling/resource concern. MatchPlan forbids `courtId`. |
| Source ownership | CORE-09 |
| Target ownership | Court assignment / scheduling |
| Adapter required | **Yes** — downstream-owned |
| Dormant or production | **Deferred by ownership** |
| Blocker status | **Not a capability closure blocker** |
| Prerequisite for cutover | Consume LogicalMatch keys without mutating MatchPlan |

---

## 6. CORE-09 `MatchPlan` → Referee Assignment

| Field | Value |
|-------|-------|
| Current state | Referee assignment is resource ownership. MatchPlan forbids `refereeId`. |
| Source ownership | CORE-09 |
| Target ownership | Referee assignment / scheduling |
| Adapter required | **Yes** — downstream-owned |
| Dormant or production | **Deferred by ownership** |
| Blocker status | **Not a capability closure blocker** |
| Prerequisite for cutover | Consume LogicalMatch keys without mutating MatchPlan |

---

## 7. CORE-09 `MatchPlan` → Scoring and Standings

| Field | Value |
|-------|-------|
| Current state | Scoring/standings consume completed match results. MatchPlan forbids score / standings fields. |
| Source ownership | CORE-09 |
| Target ownership | Scoring / Standings modules |
| Adapter required | **Yes** — downstream-owned (typically via Match Lifecycle results, not raw MatchPlan alone) |
| Dormant or production | **Deferred by ownership** |
| Blocker status | **Not a capability closure blocker** |
| Prerequisite for cutover | Result records linked by LogicalMatch key / competition identity; MatchPlan remains logical |

---

## Downstream adapters — locked language

MatchPlan requires downstream-owned mapping to Schedule and Match Lifecycle.

**Classification:** deferred by ownership · not CORE-09-owned · not a capability closure blocker · required before production cutover.

---

## Explicit non-goals for Phase 1F

- Do not implement any adapter listed above
- Do not wire production ports
- Do not export Match Generator from the root Competition Core barrel
- Do not change `MATCH_GENERATOR_IDENTITY.version`

---

## Related artifacts

- Contract matrix: `11_PHASE_1F_CONTRACT_COMPATIBILITY_MATRIX.md`
- Integration certification: `10_PHASE_1F_INTEGRATION_CERTIFICATION.md`
- Closure checklist: `15_CORE_09_CLOSURE_CHECKLIST.md`

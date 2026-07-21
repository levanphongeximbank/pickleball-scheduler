# CORE-09 — Phase 1F Contract Compatibility Matrix

**Purpose:** Classify semantic compatibility of CORE-09 contracts for integration certification.
**Phase:** 1F — documentation only. No adapters implemented.

## Classification legend

| Class | Meaning |
|-------|---------|
| **compatible** | Internally consistent; usable as-is within CORE-09 and for dormant port doubles |
| **additive adapter required** | Upstream/downstream shape differs; mapper needed before production wiring |
| **deferred by ownership** | Mapping owned by another capability; not a CORE-09 blocker |
| **blocker** | Semantic drift that prevents CORE-09 capability use even dormantly |

---

## Matrix

| Contract | Classification | Notes |
|----------|----------------|-------|
| `MatchGenerationRequest` | **compatible** | Stable request shape; strategy fail-closed; draw/rule/participant references bound |
| `MatchGenerationContext` | **compatible** | Carries frozen `drawSnapshot`, `evaluatedRules`, optional participant snapshot + ordering inputs |
| `DrawSnapshot` (CORE-09) | **compatible** (internal) | CORE-09 frozen catalog shape is consistent. vs CORE-08 runtime output → see adapter row below |
| `DrawSnapshot` vs CORE-08 Draw Runtime | **additive adapter required** | Field/name drift (`placements` vs `participantPlacements`, identity vs `drawFingerprint`, etc.). Production prerequisite only |
| `EvaluatedMatchGenerationRules` | **compatible** (internal) | CORE-09 evaluated snapshot is consistent. vs CORE-01 evaluator output → adapter recommended |
| `EvaluatedMatchGenerationRules` vs CORE-01 | **additive adapter required** | CORE-01 exposes `MATCHUP` operation; does not emit exact CORE-09 rules shape today |
| `MatchPlan` | **compatible** | Logical plan + fingerprints; no schedule/score/lifecycle fields |
| `LogicalMatch` | **compatible** | Slots, dependencies, coordinates, keys stable |
| `ParticipantSlot` | **compatible** | Kind required; bye representation fail-closed |
| `dependencyInputs` | **compatible** | Typed `MatchDependency` edges; duplicate-edge invariant (Phase 1E) |
| `winnerTo` | **compatible** | Optional advancement edge; validated |
| `loserTo` | **compatible** | Optional; used for third-place / loser paths |
| `LogicalMatchKey` | **compatible** | Deterministic key builder; no locale / clock / UUID |
| `generationFingerprint` | **compatible** | Bound to draw + rule + participant fingerprints + plan projection |

**No row is classified as `blocker` for Phase 1F / CORE-09 capability closure.**

---

## Downstream naming (informational)

Scheduling contracts today use `matchId`, `entryAId`, `entryBId`. CORE-09 uses `logicalMatchKey`, `participantSlotA`, `participantSlotB`.

| Boundary | Classification |
|----------|----------------|
| MatchPlan → Scheduling request shape | **deferred by ownership** (scheduling-owned mapper at cutover) |
| MatchPlan → Match Lifecycle | **deferred by ownership** |

These are not CORE-09 contract defects.

---

## Related artifacts

- Adapter readiness: `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md`
- Strategy support: `13_PHASE_1F_STRATEGY_SUPPORT_MATRIX.md`
- Integration certification: `10_PHASE_1F_INTEGRATION_CERTIFICATION.md`

# CC-03B-C — Group Constraint Bridge Assessment

**Phase:** CC-03B-C | **Date:** 2026-07-12

---

## Scope

Audit target: `evaluateGroupConstraints` + `avoid_same_group` in pairing constraints, used by `assignGroupsWithConstraints` during tournament draw.

---

## Finding

| Item | Status | Reason |
|------|--------|--------|
| Post-draw validation adapter | Possible | `evaluateGroupConstraints` could call Rules V2 after draw for reporting only |
| Pre-draw validation adapter | Limited value | Draw input validation already covered by tournament validation bridge |
| **Inline draw algorithm bridge** | **Deferred → CC-04** | `assignGroupsWithConstraints` mutates group assignment via swap heuristics — wiring Rules V2 scoring/penalties inside the draw loop would change draw outcomes |

---

## wired now

| Consumer | File | Bridge |
|----------|------|--------|
| Tournament draw validation | `validationEngine.js` | `evaluateLegacyTournamentDrawValidation` |
| Court Engine queue gate | `queueService.js` | `evaluateLegacyCourtEngineQueueGate` |
| Court Engine scoring | `autoCourtAssignmentEngine.js` | `evaluateLegacyCourtEngineCombinationScore` |

---

## deferred to CC-04

| Consumer | File | Reason |
|----------|------|--------|
| Group constraints (`avoid_same_group`) | `constraintEvaluator.js` → `evaluateGroupConstraints` | Requires draw-engine integration; not validation-only |
| Group assignment algorithm | `constraintGroupEngine.js` → `assignGroupsWithConstraints` | Would alter group placement algorithm and draw engine behavior |

---

## affected files (reference)

- `src/features/pairing-constraints/engines/constraintEvaluator.js`
- `src/features/pairing-constraints/engines/constraintGroupEngine.js`
- `src/tournament/engines/internalTournamentEngine.js`
- `src/tournament/engines/officialTournamentEngine.js`

---

## Constraint

Do **not** call legacy group penalty and canonical soft score simultaneously inside `assignGroupsWithConstraints` until CC-04 draw-engine merge is approved.

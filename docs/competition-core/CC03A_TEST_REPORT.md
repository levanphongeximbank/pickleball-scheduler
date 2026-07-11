# CC-03A — Test Report

**Phase:** CC-03A | **Date:** 2026-07-12

---

## Tests

| File | Cases | Focus |
|------|-------|-------|
| `competition-core-rules-engine.test.js` | 11 | Normalization, conflicts, hard/soft eval, flag gate, idempotency |
| `competition-core-feature-flags.test.js` | 4 | Defaults, sub-flag gating incl. constraints V2 |
| `competition-core-contracts.test.js` | 5 | CC-01 regression (unchanged) |

**Total CC-03A new:** 11 rules-engine + 2 flag assertions  
**Combined run:** 20 pass / 0 fail

---

## Commands

```bash
node --test tests/competition-core-rules-engine.test.js tests/competition-core-feature-flags.test.js tests/competition-core-contracts.test.js
```

---

## Results (2026-07-12)

```
✔ normalizeRuleDefinition maps legacy avoid_same_group alias
✔ detectConstraintConflicts finds contradictory must/must-not
✔ detectConstraintConflicts flags unsatisfiable multiple hard must-partner targets
✔ evaluateHardRules rejects hard avoid_partner on same team
✔ evaluateHardRules rejects skill cap breach without negative totalScore hack
✔ scoreSoftRules applies prefer_partner bonus without rejecting candidate
✔ evaluateCanonicalRules is no-op when constraints v2 flag off
✔ evaluateCanonicalRules returns infeasible on conflict before candidate eval
✔ evaluateCanonicalRules idempotent re-apply on same candidate
✔ preflightRuleSet detects conflicts only when flag on
✔ gender eligibility hard rule validates mixed doubles teams
✔ (feature flags + contracts — 9 additional cases)

ℹ tests 20 | pass 20 | fail 0
```

---

## Runtime behavior

**Unchanged** — no wiring to `teamPairingEngine`, `ai/scoring.js`, or pairing-constraints in CC-03A.

---

## Out of scope

- CC-03B consumer integration tests
- CC-04 Draw Engine merge tests
- Staging/production migration

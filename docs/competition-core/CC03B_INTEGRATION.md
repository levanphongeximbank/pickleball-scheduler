# CC-03B — Legacy Integration

**Phase:** CC-03B | **Date:** 2026-07-12

---

## Pipeline

```
Legacy payload
  → normalize legacy rules (legacyRuleMappers)
  → map to canonical RuleSet
  → resolve context
  → evaluateCandidate (Rules V2)
  → adapt result (adaptLegacyResult)
  → decision trace
  → legacy consumer
```

Entry: `evaluateLegacyRulesBridge()` in `constraints/adapters/constraintsEvaluationBridge.js`

---

## Integrated consumers

| # | Consumer | File wired | Bridge |
|---|----------|------------|--------|
| 1 | Pairing constraints | `pairing-constraints/engines/constraintEvaluator.js` | `evaluateLegacyPairingConstraints` |
| 2 | AI scoring | `ai/scoring.js` | `evaluateLegacyAiPairScore` |
| 3 | Founder constraints | Via pairing + AI policy mapping | `mapAiContextToRuleSet` |
| 4 | Tournament validation | `tournament/engines/validationEngine.js` | `evaluateLegacyTournamentDrawValidation` |
| 5 | Daily Play eligibility | `tournament/engines/dailyPlayEngine.js` | `evaluateLegacyDailyPlayPlayer` |
| 6 | Court Engine | `queueService.js`, `autoCourtAssignmentEngine.js` | `evaluateLegacyCourtEngineQueueGate`, `evaluateLegacyCourtEngineCombinationScore` |
| 7 | Decision trace | All bridge paths | `decisionTrace.js` |

**Not in scope:** Draw Engine merge (CC-04).

---

## Flag behavior

| Flag | Behavior |
|------|----------|
| OFF (default) | `legacyEvaluate()` only — zero production change |
| ON | Canonical engine + legacy adapter + trace |

---

## Adapter modules

| File | Role |
|------|------|
| `legacyRuleMappers.js` | Founder/pairing, AI policies, court config, daily play → RuleSet |
| `adaptLegacyResult.js` | Canonical → pairing eval / AI score / validation shapes |
| `decisionTrace.js` | Trace records |
| `constraintsEvaluationBridge.js` | Orchestrator |

---

## Tests

`tests/competition-core-rules-integration.test.js` — flag alias, pairing bridge, AI bridge, legacy fallback.

Regression: `pairing-constraints.test.js`, `scoring.test.js` — pass with flag OFF.

---

## Deferred

- Group constraints / draw algorithm (`assignGroupsWithConstraints`) — see `CC03B_C_GROUP_CONSTRAINT_ASSESSMENT.md` → CC-04
- Replace `courtPolicyAdapter.js` dual-path in SelectPlayers UI

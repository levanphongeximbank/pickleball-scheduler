# CC-03B — Decision Trace

**Phase:** CC-03B | **Date:** 2026-07-12

---

## Purpose

Every canonical reject/score decision through the legacy bridge records a **Decision Trace** for audit and debugging.

## Trace shape

```javascript
{
  traceVersion: "cc03b-v1",
  records: [
    {
      id, consumer, action, usedCanonical,
      feasible, eligible, softScore,
      engineVersion, ruleSetId, ruleSetVersion,
      explanations[], evaluatedAt, metadata?
    }
  ]
}
```

## Actions

| action | Meaning |
|--------|---------|
| `legacy_fallback` | Flag OFF — legacy evaluator used |
| `reject` | Hard constraint failed |
| `score` | Feasible — soft score applied |

## Consumers

| consumer | Bridge function |
|----------|-----------------|
| `pairing_constraints` | `evaluateLegacyPairingConstraints` |
| `ai_scoring` | `evaluateLegacyAiPairScore` |
| `tournament_validation` | `evaluateLegacyTournamentValidation` |
| `daily_play` | `evaluateLegacyDailyPlayPlayer` |
| `court_engine` | `evaluateLegacyCourtEngineRules` |

## AI scoring attachment

When flag ON, `calculatePairScore` attaches `decisionTrace` on the returned score object.

## Helpers

- `createDecisionTrace()`
- `appendDecisionTrace(trace, record)`
- `summarizeDecisionTrace(trace)`

Path: `src/features/competition-core/constraints/adapters/decisionTrace.js`

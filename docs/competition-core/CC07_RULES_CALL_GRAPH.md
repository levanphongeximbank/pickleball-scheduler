# CC-07 Rules Call Graph

```
Consumer (pairing / draw / TT / court / daily play)
  → evaluateLegacy*Bridge
  → evaluateCanonicalRulesRuntime (flag ON)
      → normalize context
      → map legacy RuleSet
      → preflight + conflict detect
      → evaluateCandidate
      → adapt legacy output
      → decision trace
  → legacy output preserved (flag OFF: direct legacy)
```

## Orchestrator entry

`evaluateCanonicalRulesRuntime()` — single CC-07 runtime entry. Consumers must not call `evaluateCandidate` directly when Rules V2 is ON.

## Source

`rulesRuntimeOrchestrator.js`, `constraintsEvaluationBridge.js`

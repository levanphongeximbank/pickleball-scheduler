# CC-07 Runtime Orchestrator

## Function

`evaluateCanonicalRulesRuntime(input)`

## Flow

1. Flag gate (OFF → legacy direct)
2. Normalize RuleSet + context
3. Preflight conflicts
4. `evaluateCandidate` (unchanged CC-03A pipeline)
5. Double-count / unsupported hard rule detection
6. Adapt for legacy consumer
7. CC-07 decision trace record

## Error model

Standard codes in `rulesErrorModel.js` — mapping, context missing, conflict, unsupported legacy hard rule, duplicate decision, double count.

## Source

`src/features/competition-core/constraints/adapters/rulesRuntimeOrchestrator.js`

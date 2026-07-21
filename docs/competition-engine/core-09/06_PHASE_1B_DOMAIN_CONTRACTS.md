# CORE-09 Phase 1B — Domain Contracts Delivery

**Status:** Implemented (capability-local, dormant)  
**Production impact:** NONE

## Delivered contracts

| Contract | Factory |
|----------|---------|
| `MatchGenerationRequest` | `createMatchGenerationRequest` |
| `MatchGenerationContext` | `createMatchGenerationContext` |
| `MatchGenerationStrategy` | `MATCH_GENERATION_STRATEGY` + `resolveSupportedStrategy` |
| `LogicalMatch` | `createLogicalMatch` |
| `MatchPlan` | `createMatchPlan` |
| `MatchDependency` | `createMatchDependency` |
| `ParticipantSlot` | `createParticipantSlot` |
| `MatchGenerationResult` | `createMatchGenerationResult` / `matchGenerationOk` / `matchGenerationFail` |
| `MatchGenerationIssue` | `createMatchGenerationIssue` |
| `DrawSnapshot` (CORE-09 frozen) | `createDrawSnapshot` |
| `EvaluatedMatchGenerationRules` | `createEvaluatedMatchGenerationRules` |

## Anticipated strategies (no executors yet)

- `ROUND_ROBIN`
- `GROUP_ROUND_ROBIN`
- `SINGLE_ELIMINATION`
- `TEAM_FIXTURE`

Deferred / unsupported (fail closed): `SWISS`, `DOUBLE_ELIMINATION`, unknown strings.

## Tests

`tests/competition-core-match-generation-core09-phase1b.test.js`

Run:

```powershell
node --test tests/competition-core-match-generation-core09-phase1b.test.js
```

Not added to Integrator `unit-test-files.json` in this phase.

## Non-goals (confirmed)

- No Production wiring / executor implementation
- No SQL / RPC / UI / feature-flag ON
- No root `competition-core/index.js` Integrator edits

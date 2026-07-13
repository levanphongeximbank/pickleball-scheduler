# CC-09 — Strategy Model

Source: `src/features/competition-core/scheduling/strategyCapabilities.js`

## Strategy types

`ROUND_ROBIN`, `GROUP_STAGE`, `KNOCKOUT`, `DOUBLE_ELIMINATION`, `SWISS`, `TEAM_TOURNAMENT`, `COURT_FIRST`, `TIME_FIRST`, `BALANCED`, `MANUAL`, `HYBRID`, `CUSTOM`

## Runtime support (`runtimeSupported: true`)

| Strategy | Wired path |
|---|---|
| ROUND_ROBIN | `buildRoundRobinRounds` shadow |
| GROUP_STAGE | `buildGroupStageSchedule` shadow |
| TEAM_TOURNAMENT | TT matchups shadow |
| BALANCED | TE 4.0 `generateSchedule` shadow |

## Contract-only (`runtimeSupported: false`)

KNOCKOUT, DOUBLE_ELIMINATION, SWISS, COURT_FIRST, TIME_FIRST, MANUAL, HYBRID, CUSTOM — capabilities declared for future CC phases; no runtime claim.

## Capability matrix (all strategies expose)

`supportsCourts`, `supportsTimeSlots`, `supportsByes`, `supportsRestRules`, `supportsVenues`, `supportsManualOverrides`, `supportsReferees`, `supportsRescheduling`

Use `getStrategyCapabilities(strategy)` and `isRuntimeSupportedStrategy(strategy)` at adapter boundary.

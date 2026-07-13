# CC-10 — Execution Modes

Source: `src/features/competition-core/config/executionMode.js`

## Modes

| Mode | Production | Staging | Business output |
|---|---|---|---|
| LEGACY | yes (default) | when flags off | legacy |
| SHADOW | no | yes (Stage 1) | legacy |
| CANONICAL_TEST | no | isolated fixtures only | canonical_test (non-business) |
| CANONICAL_PRIMARY | blocked CC-10 | blocked CC-10 | would be canonical |

## Resolver rules

1. `CORE=false` or module flag off → **LEGACY**
2. `isProduction=true` → **LEGACY** always
3. `CANONICAL_PRIMARY` requested → downgraded to **SHADOW** in CC-10
4. Module unsupported → **LEGACY**
5. Default when flags on (non-prod) → **SHADOW**, business owner **legacy**

## Adapter mapping

`mapAdapterExecutionMode()` normalizes adapter strings (`shadow`, `legacy`, `canonical-primary`) to canonical modes.

## API exports

`EXECUTION_MODE`, `resolveCompetitionCoreExecutionMode`, `isModuleV2Enabled`, `normalizeExecutionMode`

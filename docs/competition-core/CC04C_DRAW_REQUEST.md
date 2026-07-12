# CC-04C — Draw Request Model

**Phase:** CC-04C | **Persistence:** None

## StrategyDrawRequest

| Field | Type | Description |
|-------|------|-------------|
| `tournamentId` | string? | Tournament scope |
| `eventId` | string? | Event scope |
| `clubId` | string? | Club scope |
| `configuration` | DrawConfiguration | Draw setup |
| `selection` | StrategySelection? | Pre-selected strategy |
| `distributionPolicy` | DistributionPolicy? | Distribution hints |
| `constraintPolicy` | ConstraintPolicy? | Constraint hints |
| `balancePolicy` | BalancePolicy? | Balance hints |
| `seedPolicy` | SeedPolicy? | Seed requirements |
| `entries` | object[] | Participants (opaque) |
| `seeds` | object[] | Seed objects (opaque) |
| `options` | object? | Legacy keys / hints |

Factory: `createStrategyDrawRequest()`  
Clone: `cloneStrategyDrawRequest()`  
Validate: `validateStrategyDrawRequestShape()`

## Nested contracts

### DrawConfiguration (`createStrategyDrawConfiguration`)

`drawMode`, `groupCount`, `courtCount`, `randomSeed`, `ruleSetVersion`, `options`

### StrategySelection (`createStrategySelection`)

`strategyId`, `distributionType`, `reason`, `strategy`

Selection helper: `selectDrawStrategy(request)` maps legacy keys via `mapLegacyStrategyKeyToCatalogId()`.

### DistributionPolicy

See `CC04C_DISTRIBUTION_MODEL.md`.

### ConstraintPolicy

`enabled`, `categories[]`, `repairAllowed`, `params`

### BalancePolicy

`enabled`, `metric`, `targetSpread`, `params`

### SeedPolicy

`required`, `sourcePreference`, `allowManualOverride`, `params`

## CC-04A relationship

CC-04A `DrawRequest` (drawContracts) remains unchanged. CC-04C `StrategyDrawRequest` is the enriched strategy-layer contract.

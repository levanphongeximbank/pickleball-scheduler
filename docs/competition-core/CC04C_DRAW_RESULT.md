# CC-04C — Draw Result Model

**Phase:** CC-04C | **Runtime groups:** NOT produced

## StrategyDrawResult

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Strategy resolved successfully |
| `groups` | DrawGroup[] | Group assignments (empty in foundation) |
| `placements` | DrawPlacement[] | Final slot map |
| `distributionSteps` | DistributionStep[] | Step trace |
| `warnings` | string[] | Non-fatal notices |
| `explanations` | DrawExplanation[] | Explainability path |
| `audit` | StrategyDrawAudit? | Audit envelope |
| `metadata` | object? | Engine metadata |

Factory: `createStrategyDrawResult()`  
Validate: `validateStrategyDrawResultShape()`  
Serialize: `serializeStrategyDrawContract()`

Foundation builder: `buildFoundationStrategyDrawResult(request)` — returns metadata envelope with empty `groups` / `placements` / `distributionSteps`.

## DrawPlacement

`entryId`, `teamId`, `groupId`, `groupIndex`, `seedNumber`, `slotIndex`, `metadata`

Factory: `createDrawPlacement()`

## DistributionStep

`order`, `action`, `entryId`, `groupId`, `reason`, `details`

Factory: `createDistributionStep()`

## Explainability path

```
Strategy → Seed policy → Distribution → Constraint resolution → Final placement
```

Produced by `createStrategyDrawExplanation()` and attached to foundation results.

## CC-04A relationship

CC-04A `DrawResult` unchanged. CC-04C adds strategy-layer result with placements, steps, and enriched audit.

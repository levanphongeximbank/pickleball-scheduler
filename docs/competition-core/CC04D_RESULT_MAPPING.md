# CC-04D — Result Mapping

**Phase:** CC-04D | **Group membership:** Preserved

## Legacy → Canonical

| Function | Input | Output |
|----------|-------|--------|
| `mapLegacyGroupToDrawGroup()` | Legacy group record | `DrawGroup` |
| `mapLegacyGroupsToDrawGroups()` | `groups[]` | `DrawGroup[]` |
| `mapLegacyDrawResultToDrawResult()` | `{ ok, groups, warnings }` | `DrawResult` |

Legacy group fields mapped:

- `entryIds` / `entries[].id` / `teamIds` → `entryIds`
- `label` / `name` → `label`
- `playerIds` or entry playerIds → `playerIds`

## Canonical → Legacy consumer

| Function | Purpose |
|----------|---------|
| `mapDrawGroupToLegacyGroup()` | Single group back to legacy shape |
| `mapDrawGroupsToLegacyGroups()` | Uses legacy templates to preserve extra fields |
| `adaptDrawResultForLegacyConsumer()` | Full legacy result envelope |

## Parity

`isLegacyDrawOutputPreserved(directLegacy, adaptedLegacy)` compares normalized group membership and `ok` flag.

Flag ON path must produce identical group assignment as direct legacy call.

## Strategy result envelope

`mapDrawResultToStrategyDrawResult()` adds `placements`, `distributionSteps` from mapped groups.

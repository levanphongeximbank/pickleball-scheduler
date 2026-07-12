# CC-04D — Request Mapping

**Phase:** CC-04D

## LegacyDrawPayload → DrawRequest

Mapper: `mapLegacyDrawPayloadToDrawRequest()`

| Legacy field | Canonical field |
|--------------|-----------------|
| `strategyKey` / `legacyStrategyKey` | `drawMode` via `mapLegacyDrawModeToCanonical()` |
| `tournamentId` | `tournamentId` |
| `eventId` | `eventId` |
| `clubId` | `clubId` |
| `groupCount` | `groupCount` |
| `entries[]` | `entries[]` |
| `players[]` | `players[]` |
| `seeds[]` | `seeds[]` |
| `constraints[]` | `constraints[]` |
| `options` | `options.legacyStrategyKey` preserved |

## LegacyDrawPayload → StrategyDrawRequest

Mapper: `mapLegacyDrawPayloadToStrategyDrawRequest()`

Adds:

- `configuration.drawMode` from strategy key
- `selection` via `selectDrawStrategy()`
- `seedPolicy` from seed presence

## CompetitionEngineInput

Mapper: `mapCompetitionEngineInputToDrawRequest()` merges engine input scope ids with payload.

## Clone safety

`cloneLegacyDrawPayload()` — JSON round-trip for executor snapshots.

`isLegacyDrawPayloadPreserved()` — parity check helper.

## Note

Request mapping does not mutate legacy payload passed to `legacyExecutor`.

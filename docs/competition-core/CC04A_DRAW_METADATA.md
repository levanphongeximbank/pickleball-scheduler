# CC-04A — Draw Metadata

`createDrawMetadata()` fields:

| Field | Notes |
|-------|-------|
| drawId | Opaque id |
| drawVersion | Contract version |
| engineVersion | `cc04a-v1` |
| randomSeed | Deterministic seed token |
| startedAt / finishedAt | ISO timestamps |
| durationMs | Elapsed ms |
| retryCount | Heuristic retries |
| heuristicScore | Aggregate score |
| drawMode | Canonical mode |
| strategy / strategies | Strategy contracts |
| ruleSetVersion | Rules linkage |
| competitionVersion | Competition core version |
| random | `DrawRandomMetadata` |

Random contract: same `randomSeed` + generator → same result (implementation deferred to CC-04B). Generators: `mulberry32`, `legacy_math_random`, `injected`, `unknown`.

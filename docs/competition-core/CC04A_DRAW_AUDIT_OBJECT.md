# CC-04A — Draw Audit Object

`createDrawAudit()` — in-memory only, no persistence.

| Field | Purpose |
|-------|---------|
| requestSnapshot | Cloned request context |
| resolvedSeeds | Final seed list |
| distributionPath | Human-readable placement path |
| constraintEvaluation | Constraint evaluation summary |
| retryHistory | Heuristic attempt records |
| selectedCandidate | Chosen grouping |
| finalScore | Selected score |
| randomSeed | RNG seed used |
| engineVersion | `cc04a-v1` |
| explanations | Explainability records |
| recordedAt | Timestamp |

CC-04A does not write audits to storage or attach them to live draw runs.

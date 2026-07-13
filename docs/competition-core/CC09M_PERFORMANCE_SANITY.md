# CC-09M — Performance Sanity (Post-Merge)

Measured on `integration/cc09-final-merge` after merge with TT-5 baseline.

| Scenario | legacy ms | adapter ms | shadow ms |
|---|---:|---:|---:|
| 8 matches / 2 courts | 0.598 | 1.006 | 0.902 |
| 24 matches / 4 courts | 0.263 | 0.149 | 0.342 |
| 64 matches / 8 courts | 0.240 | 0.349 | 0.632 |
| Team Tournament fixture | — | — | 0.389 |

## Verdict

No major regression vs CC-09 isolated branch baselines. Adapter/shadow overhead remains sub-millisecond to low single-digit ms for representative fixtures. No optimization applied in merge phase.

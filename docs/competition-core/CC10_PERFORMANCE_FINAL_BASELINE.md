# CC-10 — Performance Final Baseline

Measured on `feature/competition-core-cc10-readiness` (Node local).

## Scheduling

| Fixture | legacy ms | shadow ms | overhead |
|---|---:|---:|---:|
| 8 matches / 2 courts | 0.61 | 3.01 | ~394% (sub-ms absolute) |
| 24 matches / 4 courts | 0.26 | 0.34 | ~31% |
| 64 matches / 8 courts | 0.24 | 0.63 | ~163% |

## Standings

| Fixture | canonical ms |
|---|---:|
| 8 entries / 1 match | 9.02 |

## Thresholds (readiness)

| Metric | Threshold | Status |
|---|---|---|
| Adapter absolute overhead | < 10ms typical fixtures | PASS |
| Shadow duplicate executor | 0 duplicate calls | PASS (memoized) |
| Memory growth | no unbounded clone chains | PASS (JSON clone documented) |
| User-facing impact | none (shadow only) | PASS |

No P0 performance defects found. No optimization in CC-10 scope.

Draw/Formation/Matchmaking baselines documented in CC-04/05/06 reports; remain within staging-acceptable bounds.

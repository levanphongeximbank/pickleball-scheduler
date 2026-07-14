# PR-4.5 — Simulation Benchmarks

Command:

```bash
node --test tests/private-pairing-rules-pr45-benchmark.test.js
```

Measured on local worktree (seeded match mode, `maxCandidates=200`, `timeoutMs=2000`):

| players | eligible | matches (top) | candidatesGenerated | rejected | ranked | executionTimeMs | searchLimitReached |
|--------:|---------:|--------------:|--------------------:|---------:|-------:|----------------:|:-------------------|
| 8 | 8 | 2 | 200 | 0 | 10 | ~27 | true |
| 16 | 16 | 4 | 200 | 0 | 10 | ~9 | true |
| 24 | 24 | 6 | 200 | 0 | 10 | ~11 | true |
| 32 | 32 | 8 | 200 | 0 | 10 | ~15 | true |

Notes:

- Non-exhaustive search by design.
- `searchLimitReached=true` expected when cap hit before full enumeration.
- No hang observed under 2.5s wall time for 32 players.
- Memory: candidates capped; no persistent allocations beyond ranked Top N output.

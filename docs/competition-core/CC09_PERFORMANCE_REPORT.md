# CC-09 — Performance Report

Measured on isolated branch `feature/competition-core-cc09-scheduling` (Node local, 2026-07-13).

| Scenario | legacyDurationMs | adapterDurationMs | shadowDurationMs | assignmentCount | conflictCount |
|---|---:|---:|---:|---:|---:|
| 8 matches / 2 courts (4-team group) | 0.669 | 1.051 | 1.230 | 6 | 6 |
| 24 matches / 4 courts (2×6 teams) | 0.252 | 0.142 | 0.344 | 15 | 30 |
| 64 matches / 8 courts (4×8 teams) | 0.207 | 0.351 | 0.571 | 28 | 112 |
| Team Tournament fixture (1 matchup) | 0.002 | 0.771 | 0.716 | 1 | 0 |
| Group-to-knockout | n/a | n/a | n/a | — | — |

**Group-to-knockout:** not a single wired path in CC-09; knockout scheduling remains contract-only.

## Notes

- Overhead is mapping + validation + shadow compare only — no algorithm rewrite.
- Conflict counts reflect UNASSIGNED soft conflicts on fixture-only rows without court/time (expected for group-stage shadow).
- Memory: no significant allocation beyond JSON clone of payload; no optimization attempted per CC-09 scope.

Do not optimize algorithms in CC-09.

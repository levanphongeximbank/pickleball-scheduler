# CC-08C — Test Report

## Required test cases (owner checklist)

| # | Requirement | Status | Test reference |
|---|-------------|--------|----------------|
| 1 | Latest standardization imports CC-08 cleanly | PASS | CC08C-1 |
| 2 | Competition Core exports remain valid | PASS | CC08C-2 |
| 3 | Legacy adapter routing remains valid | PASS | CC08C-3, cc08 #39 |
| 4 | TT-4 forfeit win/loss fields preserved | PASS | CC08C-4 |
| 5 | Withdrawal result does not corrupt standings | PASS | CC08C-5 |
| 6 | Team ranking parity | PASS | CC08C-6 |
| 7 | Individual group ranking parity | PASS | CC08C-7 |
| 8 | TE 4.0 ranking parity (base builder) | PASS | CC08C-8 |
| 9 | Multi-way mini-table | PASS | CC08C-9, cc08 #4–5 |
| 10 | Deterministic draw-lot | PASS | CC08C-10, cc08 #6 |
| 11 | Manual overrides preserved | PASS | CC08C-11, cc08 #20 |
| 12 | Qualification status preserved | PASS | CC08C-12, cc08 #21 |
| 13 | Season/session wired or bypassed | PASS | CC08C-13, CC08C-15 |
| 14 | Flag OFF retains legacy | PASS | CC08C-14, cc08 #27–28 |
| 15 | Flag ON does not capture unsupported paths | PASS | CC08C-15 |
| 16 | Existing CC-07 tests pass | PASS | CC08C-16 (30 nested) |
| 17 | Existing CC-06 tests pass | PASS | CC08C-17 (22 nested) |
| 18 | Existing TT-4 tests pass | PASS | CC08C-18 (9 nested) |
| 19 | Draw/Formation/Rating tests pass | PASS | CC08C-19 (nested) |
| 20 | Package test runner contains new tests | PASS | CC08C-20 |

## Additional shadow scenarios

| Scenario | Status |
|----------|--------|
| Forfeit group match shadow | PASS |
| Team canonical row field mapping | PASS |

## Test files

- `tests/competition-core-standings-cc08.test.js` — 161 tests
- `tests/competition-core-standings-cc08c.test.js` — 142 tests (22 direct + nested regression imports)

## package.json

`test:unit` includes both `competition-core-standings-cc08.test.js` and `competition-core-standings-cc08c.test.js`.

## Verdict

All 20 required cases **PASS**. No new regressions in competition-core standings scope.

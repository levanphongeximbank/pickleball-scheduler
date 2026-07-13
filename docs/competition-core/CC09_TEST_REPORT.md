# CC-09 — Test Report

Suite: `tests/competition-core-scheduling-cc09.test.js` — **204 pass / 0 fail**

## Mandatory matrix (38 owner cases + extras)

| # | Case | Status |
|---|---|---|
| 1 | Flag OFF direct legacy | PASS |
| 2 | Master OFF overrides scheduling flag | PASS |
| 3 | Flag ON adapter path | PASS |
| 4 | Shadow output remains legacy | PASS |
| 5 | Group-stage parity | PASS |
| 6 | Round-robin parity | PASS |
| 7 | Team Tournament schedule parity | PASS |
| 8 | TE 4.0 base schedule parity | PASS |
| 9 | Court assignment parity | PASS |
| 10 | Time-slot parity | PASS |
| 11 | BYE does not consume court | PASS |
| 12 | Pending dependency handled | PASS |
| 13 | Withdrawn participant handling | PASS |
| 14 | Forfeit advancement handling | PASS |
| 15 | Participant time conflict | PASS |
| 16 | Team time conflict | PASS |
| 17 | Court conflict | PASS |
| 18 | Venue conflict | PASS |
| 19 | Referee conflict | PASS |
| 20 | Insufficient rest | PASS |
| 21 | Court unavailable | PASS |
| 22 | Invalid round order | PASS |
| 23 | Duplicate match assignment | PASS |
| 24 | Unassigned match reporting | PASS |
| 25 | Manual override preservation | PASS |
| 26 | Override conflict reporting | PASS |
| 27 | Timezone preservation | PASS |
| 28 | Map/Set/randomFn preservation | PASS |
| 29 | Custom legacy fields preserved or warned | PASS |
| 30 | Decision Trace complete | PASS |
| 31 | Decision Trace secret redaction | PASS |
| 32 | No input mutation | PASS |
| 33 | Deterministic output | PASS |
| 34–38 | CC-08, CC-07, CC-04/05/06, rating-v2 imports | PASS |

## Nested regression imports

CC-08, CC-07, CC-06, CC-05, CC-04, CC-03, rating-v2, team-tournament seed — all importable and passing within suite.

## Performance smoke

Included: 8 matches / 2 courts baseline timing assertion.

## Feature flag tests

Extended in `tests/competition-core-feature-flags.test.js` for `SCHEDULING_V2`.

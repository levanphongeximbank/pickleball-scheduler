# CC-10 — Final Test Gate Report

Branch: `feature/competition-core-cc10-readiness`

## npm test

| Metric | Value |
|---|---|
| Total | 2212 |
| Pass | 2201 |
| Fail | 11 |
| New regressions | **0** |

Baseline failures (unchanged): club-governance, club-management, club-membership-request (import), rbac (4), v5-menu-audit (2).

Flaky under full-suite load (passes isolated): formation-cc05c performance timing assertion.

## Scoped Competition Core suites

| Suite | Result |
|---|---|
| CC-10 readiness | 12/12 |
| CC-09 scheduling | 204/204 |
| CC-08 standings | PASS |
| CC-07 rules | PASS |
| CC-06 matchmaking | PASS |
| CC-05 formation | PASS |
| CC-04 draw | PASS |
| Rating V2 | PASS |
| Feature flags | PASS |

## npm run build

**PASS**

## Lint

| Scope | Result |
|---|---|
| Full repo | 319 problems (baseline) |
| Competition Core scoped | **0 errors** |

Acceptance: **PASS**

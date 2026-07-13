# CC-08E — Post-Merge Regression

Branch: `integration/cc08-final-merge` (merged to `feature/competition-core-standardization`)

## Full npm test

| Metric | Value |
|--------|-------|
| Passed | 1771 |
| Failed | 18 |
| New regressions | **0** |

Baseline failures (unchanged): RBAC menuAccess, v5-menu-audit, club governance tests, core-platform-runtime, fixture matrix performance, mobile PWA, court claim, phase 5 engines.

## Scoped suites

| Suite | Tests | Pass |
|-------|-------|------|
| competition-core-standings-cc08 | 161 | 161 |
| competition-core-standings-cc08c | 143 | 143 |
| team-tournament-tt4 | 9 | 9 |
| competition-core-rules-cc07 | 30 | 30 |
| competition-core-matchmaking-cc06 | 22 | 22 |
| competition-core-feature-flags | pass | pass |
| competition-core-draw-cc04e | pass | pass |
| competition-core-formation-cc05c | pass | pass |

## Build

**PASS** (after step 1 and after full merge)

## Lint

| Scope | Result |
|-------|--------|
| Full | 323 problems (133 errors, 190 warnings) — baseline + CC-08 test file imports fixed |
| CC-08 standings + legacyAdapter + cc08 tests + router.jsx | **0 errors** |

## Feature flag verification

| Config | Behavior |
|--------|----------|
| CORE=false | Legacy only ✅ |
| CORE=true + STANDINGS_V2=false | Legacy only ✅ |
| CORE=true + STANDINGS_V2=true | Wired paths shadow; season/session/league legacy-primary ✅ |

Tests: cc08 #27–28, CC08C-14/15, CC08D unsupported consumers.

## Standings verification (10 cases)

| # | Case | Status |
|---|------|--------|
| 1 | Legacy group standings | PASS |
| 2 | Team tournament standings | PASS |
| 3 | TE 4.0 base shadow | PASS |
| 4 | TT-4 forfeit/withdrawal | PASS |
| 5 | Two-team head-to-head | PASS |
| 6 | Three-plus mini-table | PASS |
| 7 | Manual override | PASS |
| 8 | Qualification cutoff | PASS |
| 9 | Deterministic draw-lot | PASS |
| 10 | Duplicate match protection | PASS |

## Acceptance

| Criterion | Status |
|-----------|--------|
| New regressions | ✅ 0 |
| Build PASS | ✅ |
| CC-08 scoped tests | ✅ |
| TT-4 regression | ✅ |
| New lint in merged files | ✅ 0 |

Preview deployment: NOT DEPLOYED  
Production: NOT DEPLOYED  
Production migration: NOT APPLIED  
Feature flags production: OFF

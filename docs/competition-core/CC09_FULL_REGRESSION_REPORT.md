# CC-09 — Full Regression Report

Base: `4df0a529e0d56b08e00cae28983cb785481c0935`  
Branch: `feature/competition-core-cc09-scheduling`

## npm test

| Metric | Value |
|---|---|
| Total tests | 2067 |
| Pass | 2058 |
| Fail | 9 |
| New regressions from CC-09 | **0** |

### Baseline failures (pre-existing, unrelated to CC-09)

| Test | Cause |
|---|---|
| `tests/club-governance.test.js` | suite import failure |
| `tests/club-management.test.js` | suite import failure |
| `tests/club-membership-request.test.js` | suite import failure |
| `tests/rbac.test.js` (4 cases) | menuAccess path expectations |
| `tests/v5-menu-audit.test.js` (2 cases) | sidebar item count / spec labels |

### CC-09 + CC regression subset

| Suite | Pass |
|---|---|
| competition-core-scheduling-cc09 | 204/204 |
| CC-08, CC-07, CC-06, CC-05, CC-04 + rating-v2 + TT | 750/750 (subset run) |

## npm run build

**PASS** — `vite build` completed in ~1.7s.

## npm run lint

| Scope | Result |
|---|---|
| Full repo | 319 problems (129 errors, 190 warnings) — baseline |
| CC-09 scoped files | **0 errors** |

## Acceptance

- New regressions: **0**
- Build: **PASS**
- New lint errors from CC-09 files: **0**

Preview deployment: NOT DEPLOYED  
Production: NOT DEPLOYED  
Production migration: NOT APPLIED  
Feature flags production: OFF

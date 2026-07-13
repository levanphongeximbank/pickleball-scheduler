# CC-09M — Post-Merge Regression

Branch: `integration/cc09-final-merge` @ merge commit `97f6d02`

## npm test

| Metric | Value |
|---|---|
| Total tests | 2200 |
| Pass | 2191 |
| Fail | 9 |
| **New regressions** | **0** |

### Baseline failures (pre-existing)

- `tests/club-governance.test.js` — suite import failure
- `tests/club-management.test.js` — suite import failure
- `tests/club-membership-request.test.js` — suite import failure
- `tests/rbac.test.js` — 4 menuAccess cases
- `tests/v5-menu-audit.test.js` — 2 sidebar spec cases

### Scoped suites

| Suite | Result |
|---|---|
| CC-09 scheduling | 204/204 PASS |
| CC-08 standings | PASS |
| CC-07 rules | PASS |
| CC-06 matchmaking | PASS |
| Draw / Formation | PASS |
| Rating V2 | PASS |
| Team Tournament + TT scheduling | PASS |
| Scoped regression batch (650 tests) | 650/650 PASS |

## npm run build

**PASS** (~28s, vite build + PWA)

## npm run lint

| Scope | Result |
|---|---|
| Full repo | 319 problems (129 errors, 190 warnings) — baseline |
| CC-09 scoped files | **0 errors** |

## Acceptance

- New regressions: **0** ✓
- Build: **PASS** ✓
- CC-09 scoped tests: **PASS** ✓
- Team Tournament regression: **PASS** ✓
- New lint errors in CC-09 files: **0** ✓

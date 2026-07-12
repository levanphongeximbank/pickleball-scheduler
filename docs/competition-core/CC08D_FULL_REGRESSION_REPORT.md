# CC-08D — Full Regression Report (Integration Simulation)

Branch: `integration/cc08-standings-readiness` @ `3e8b305`

## npm test (full)

| Metric | Value |
|--------|-------|
| Passed | 1772 |
| Failed | 18 |
| New regressions | **0** (baseline 19 → 18; one fewer failure after build fix) |

Baseline failures unchanged in category (RBAC menu, v5-menu-audit, club tests, etc.).

## Scoped suites

| Suite | Tests | Pass |
|-------|-------|------|
| `competition-core-standings-cc08` | 161 | 161 |
| `competition-core-standings-cc08c` | 143 | 143 |
| `team-tournament-tt4` | 9 | 9 |
| `competition-core-rules-cc07` | 30 | 30 |
| `competition-core-matchmaking-cc06` | 22 | 22 |
| `competition-core-feature-flags` | included | pass |

## npm run build

**PASS** (after build fix + CC-08 merge)

## Lint

| Scope | Result |
|-------|--------|
| Full | 319 problems (baseline) |
| CC-08 standings + legacyAdapter + cc08 tests | **0 errors** |
| Build-fix `src/router.jsx` | **0 errors** |

## Acceptance gate

| Criterion | Status |
|-----------|--------|
| Build PASS | ✅ |
| New regressions | ✅ 0 |
| CC-08 tests | ✅ |
| TT-4 regression | ✅ |
| Scoped lint | ✅ |

Preview deployment: NOT DEPLOYED  
Production: NOT DEPLOYED  
Production migration: NOT APPLIED  
Feature flags production: OFF

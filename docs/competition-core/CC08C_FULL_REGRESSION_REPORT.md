# CC-08C — Full Regression Report

Integrated branch: `feature/competition-core-cc08-standings` @ `7ac732a`  
Standardization base: `cb32ae2669182a81ac1cc1f41ad00f51b58b933c`

## npm test

| Metric | Value |
|--------|-------|
| Total (TAP lines) | ~1767 |
| Passed | ~1748 |
| Failed | 19 |
| New regressions | **0** |

### Baseline failures (pre-existing, not CC-08)

- `phase 5 engines expose canonical service contracts`
- `createPlatformEventDispatcher writes audit and notification entries`
- `MyClubPage uses membership resolver not profiles.club_id`
- Club governance/management test files (6)
- `fixture matrix performance baseline`
- `core-platform-runtime.test.js`
- `court claim request`
- `mobile phase 8 product — PWA assets`
- RBAC menuAccess (4 tests)
- v5 menu audit (2 tests)

No failures in `competition-core-standings-cc08*` or competition-core standings modules.

## Scoped CC-08 / CC-08C tests

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| `competition-core-standings-cc08.test.js` | 161 | 161 | 0 |
| `competition-core-standings-cc08c.test.js` | 142 | 142 | 0 |

## npm run build

**Result: FAIL (baseline inherited from standardization)**

```
[UNRESOLVED_IMPORT] Could not resolve './pages/dev/RefereeV5PreviewPage' in src/router.jsx
```

`RefereeV5PreviewPage` is referenced in `router.jsx` on standardization branch but the page file is not committed (exists only in main worktree WIP). **Not introduced by CC-08.**

## npm run lint

| Metric | Value |
|--------|-------|
| Full lint | 319 problems (129 errors, 190 warnings) — baseline |
| CC-08 scoped lint | **0 errors** |

Scoped paths: `src/features/competition-core/standings/**`, `legacyAdapter.js`, `competition-core-standings-cc08*.test.js`

## Acceptance gate

| Criterion | Status |
|-----------|--------|
| New test regressions | PASS (0) |
| CC-08/CC-08C tests | PASS |
| Build | FAIL — baseline (RefereeV5PreviewPage) |
| New CC-08 lint errors | PASS (0) |

## Deployment status

Preview deployment: NOT DEPLOYED  
Production: NOT DEPLOYED  
Production migration: NOT APPLIED  
Feature flags production: OFF  
Main worktree/stash: UNCHANGED  
TT-4: COMPLETED  
CC-09: NOT STARTED

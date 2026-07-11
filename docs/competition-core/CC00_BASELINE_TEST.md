# CC-00 — Baseline Test Report

**Phase:** CC-00 | **Date:** 2026-07-11  
**Branch:** `feature/competition-core-standardization`  
**Commit context:** Audit-only — no application code changes.

---

## 1. Environment

| Item | Value |
|------|-------|
| OS | Windows 10.0.26200 |
| Package | `pickleball-scheduler@5.3.34` |
| Test runner | `node --test` (unit suite via `npm run test:unit`) |
| Build | Vite 8.1.0 |

---

## 2. Commands executed

```bash
npm test
npm run lint
npm run build
```

---

## 3. Unit tests (`npm test`)

| Metric | Result |
|--------|--------|
| Total tests | **1182** |
| Pass | **1174** |
| Fail | **8** |
| Suites | 73 |
| Duration | ~3.4s |

### 3.1 Failing tests (pre-existing, unrelated to CC-00)

| Test file | Failure summary |
|-----------|-----------------|
| `tests/club-governance.test.js` | Suite failure (see file output) |
| `tests/club-management.test.js` | Suite failure |
| `tests/club-membership-request.test.js` | Suite failure |
| `tests/rbac.test.js` | `menuAccess — getDefaultHomePath theo role` |
| `tests/rbac.test.js` | `menuAccess — resolvePostAuthRedirectPath PLAYER chưa CLB` |
| `tests/rbac.test.js` | `menuAccess — CLUB_OWNER thấy CLB & Giải, không Live Courts` |
| `tests/v5-menu-audit.test.js` | Missing sidebar item "Danh sách CLB" |
| `tests/v5-menu-audit.test.js` | Sidebar leaf count > 105 limit |

### 3.2 Competition-related tests — ALL PASS

Relevant passing suites (sample):

- `tests/ai-core.test.js`, `tests/scoring.test.js`, `tests/performance.test.js`
- `tests/tournament-engine.test.js`, `tests/tournament-seeding.logic.test.js`
- `tests/tournament-internal.test.js`, `tests/tournament-open-random.test.js`
- `tests/tournament-bracket.test.js`, `tests/tournament-daily-play.test.js`
- `tests/tournament-regression.test.js`, `tests/tournament-standings.logic.test.js`
- `tests/elo-engine.test.js`, `tests/skill-level-engine.test.js`
- `tests/skill-level-service.test.js`, `tests/skill-level-change-service.test.js`
- `tests/pairing-constraints.test.js`, `tests/pairing-intervention.test.js`
- `tests/team-group-seed.test.js`, `tests/team-standings-tiebreak.test.js`
- `tests/ai-assistant-sprint7.test.js`

**Note:** Daily Play Elo skip verified in `skill-level-change-service.test.js`.

---

## 4. Lint (`npm run lint`)

| Metric | Result |
|--------|--------|
| Exit code | **1** (fail) |
| Problems | **324** (132 errors, 192 warnings) |

Categories (pre-existing):

- `no-unused-vars` in tests and some src files
- `react-hooks/rules-of-hooks` / `exhaustive-deps`
- `react-refresh/only-export-components`
- `no-undef` in scripts/tests (`process`, `cluster`, `SCOPED_DIRECTOR_KEY`)

**No lint run was required to pass for CC-00 audit** — recorded as baseline debt.

---

## 5. Build (`npm run build`)

| Metric | Result |
|--------|--------|
| Exit code | **0** (success) |
| Duration | ~815ms (+ PWA generate) |
| Output | `dist/` produced, PWA precache 364 entries |

Warnings (non-blocking):

- Large chunk > 500 kB (`index-DvoZzEH8.js` ~571 kB)
- `node:crypto` externalized for browser in team tournament compare

---

## 6. Specialized competition tests (included in suite)

Already part of `npm test`; no separate command required.

| Area | Test files |
|------|------------|
| Snake / seeding | `tournament-seeding.logic.test.js` |
| Draw TE 4.0 | `tournament-engine.test.js` |
| Open random draw | `tournament-open-random.test.js` |
| Elo | `elo-engine.test.js` |
| Skill monthly | `skill-level-engine.test.js` |
| Pairing constraints | `pairing-constraints.test.js` |
| Daily fair match | `tournament-daily-play.test.js`, `daily-fair-match-animation.test.js` |
| Regression | `tournament-regression.test.js` |

---

## 7. Baseline snapshot for CC-11

| Gate | CC-00 status | CC-11 target |
|------|--------------|--------------|
| Unit pass rate | 1174/1182 (99.3%) | 100% or documented waivers |
| Lint | 324 problems | Reduce or scope eslint |
| Build | PASS | PASS |
| Competition tests | PASS | PASS + new CC suite |
| Deterministic draw | Partial (TE 4.0 only) | Golden tests all modes |

---

## 8. Actions NOT taken (per CC-00 rules)

- Did not fix failing menu/RBAC/club tests
- Did not fix lint errors
- Did not deploy preview or production
- Did not apply SQL migration

---

## 9. Verdict (baseline subsection)

**PARTIAL** — Build passes; competition test subset passes; **8 unit failures** and **lint fail** are pre-existing baseline debt, not introduced by CC-00.

Overall **CC-00 audit verdict: PASS** (see `CC00_CODEBASE_AUDIT.md`).

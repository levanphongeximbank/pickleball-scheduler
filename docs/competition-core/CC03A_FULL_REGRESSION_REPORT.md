# CC-03A-V — Full Regression Report

**Phase:** CC-03A-V | **Branch:** `feature/competition-core-standardization` | **Date:** 2026-07-12

---

## 1. Pre-flight

| Check | Result |
|-------|--------|
| Branch | `feature/competition-core-standardization` ✅ |
| HEAD baseline | `7b666df` (CC-03A) — verification commit follows separately ✅ |
| Stash | `wip-before-competition-core-cc02-2026-07-11` unchanged ✅ |
| TT1B / team-tournament | Not staged / not committed ✅ |
| CC-03B / CC-04 | Not started ✅ |

---

## 2. Feature flag

- **Current:** `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED`
- **Proposed canonical (deferred):** `VITE_COMPETITION_CORE_RULES_V2_ENABLED`
- Default OFF, sub-flag gated, flag OFF = no behavior change ✅

See `CC03A_FEATURE_FLAG_VERIFICATION.md`.

---

## 3. Full npm test

```bash
npm test
```

| Metric | Baseline (pre CC-03A-V) | After CC-03A-V |
|--------|-------------------------|----------------|
| Total tests | 1222 | **1268** (+46 CC-03A tests added to runner) |
| Pass | 1214 | **1260** |
| Fail | 8 | **8** |
| **New regressions** | — | **0** ✅ |

### 8 failing tests (pre-existing, unchanged)

1. `tests/club-governance.test.js` (file)
2. `tests/club-management.test.js` (file)
3. `tests/club-membership-request.test.js` (file)
4. `menuAccess — getDefaultHomePath theo role` (`rbac.test.js`)
5. `menuAccess — resolvePostAuthRedirectPath PLAYER chưa CLB` (`rbac.test.js`)
6. `menuAccess — CLUB_OWNER thấy CLB & Giải, không Live Courts` (`rbac.test.js`)
7. `v5 menu audit — mục sidebar chính theo spec V5` (`v5-menu-audit.test.js`)
8. `v5 menu audit — thống kê live / partial / planned (sidebar)` (`v5-menu-audit.test.js`)

**Ghi chú:** Trước CC-03A-V, `competition-core-rules-engine.test.js` **chưa** nằm trong `npm test`. Verification gate đã bổ sung vào runner.

---

## 4. Build

```bash
npm run build
```

**Result:** ✅ PASS

---

## 5. Lint

### Full repo

```bash
npm run lint
```

| Metric | Baseline (CC-00) | Current |
|--------|------------------|---------|
| Total problems | 324 | **322** |
| Errors | ~130 | 130 |
| Warnings | ~192 | 192 |

Pre-existing issues outside competition-core.

### CC-03A files only

```bash
npx eslint src/features/competition-core/constraints/ ...
```

**New lint errors from CC-03A files:** **0** ✅ (3 unused-var issues fixed during verification)

---

## 6. Test runner integrity

| Check | Result |
|-------|--------|
| Old tests removed from npm test | No ✅ |
| `test.only` / `describe.only` | None found ✅ |
| `test.skip` to hide failures | None ✅ |
| Global timeout changed | No ✅ |
| CC-03A tests added to npm test | Yes (verification fix) ✅ |

---

## 7. CC-03A dedicated tests

| File | Cases | Pass |
|------|-------|------|
| `competition-core-rules-engine.test.js` | 22 | 22 |
| `competition-core-rules-engine-verification.test.js` | 24 | 24 |
| `competition-core-feature-flags.test.js` | 4 | 4 |
| `competition-core-contracts.test.js` | 5 | 5 |

---

## 8. Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Full npm test run | ✅ |
| Build pass | ✅ |
| New regressions = 0 | ✅ |
| CC-03A lint errors = 0 | ✅ |
| Flag default OFF | ✅ |
| No import side effects | ✅ |
| No input mutation | ✅ |
| Hard/soft invariants | ✅ |
| Context boundary | ✅ |
| Rule-set version domain | ✅ |
| Explainability complete | ✅ |
| No deploy / migration | ✅ |
| CC-03B not started | ✅ |

---

## 9. Verdict

**CC-03A-V: PASS**

CC-03A architecture accepted; final verification gate complete. Ready for owner GO on CC-03B (when allowed).

---

Preview deployment: **NOT DEPLOYED**  
Production: **NOT DEPLOYED**  
Production migration: **NOT APPLIED**  
Feature flags production: **OFF**  
Stash: **UNCHANGED**  
CC-03B: **NOT STARTED**  
CC-04: **NOT STARTED**  
Waiting for owner GO

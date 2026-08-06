# Phase 4 Independent Implementation Review

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Independent review (no commit)  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Base HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Implementation claim:** `CANONICAL_NAVIGATION_PHASE4_IMPLEMENTATION_COMPLETE_READY_FOR_REVIEW`  
**Machine-readable:** [`PHASE4_INDEPENDENT_REVIEW_REPORT.json`](./PHASE4_INDEPENDENT_REVIEW_REPORT.json)

## Final Verdict (original review)

**`CANONICAL_NAVIGATION_PHASE4_INDEPENDENT_REVIEW_CHANGES_REQUIRED`**

OD-B01 and OD-B02 hold. OD-B03 and OD-PLURAL-AUTHZ had material gaps at review time.

No runtime files were modified during the original review. No commit / push / PR / deploy / Production changes.

### Remediation follow-up (same worktree)

See [`PHASE4_REMEDIATION_REPORT.md`](./PHASE4_REMEDIATION_REPORT.md).

**Remediation verdict:** `CANONICAL_NAVIGATION_PHASE4_REMEDIATION_COMPLETE_READY_FOR_REREVIEW`

| Defect | Post-remediation |
|--------|------------------|
| BR-PLURAL-01 | **CLOSED** — Engine forces `tournament.update` + ownership when auth active |
| BR-PLURAL-02 | **CLOSED** — `/tournaments/` public |
| BR-B03-01 | **CLOSED** — admin page tech-eval allows flag OFF |
| BR-TEST-01 | **CLOSED** — behavioral unit + UI gate/page tests |
| BR-DOC-01 | **CLOSED** — inventory + ACTIVE_MENU **76** documented |

Post-remediation inventory: exact **46** (modified **17** / untracked **29** / staged **0**); runtime **17** / test **8** / manifest **1** / docs **20** / unrelated **0**. Unit **6892/6892**.

---

## 1. Inventory

| Class | Count | Notes |
|-------|------:|-------|
| Modified tracked | **17** | Unstaged |
| Untracked files | **23** | Implementation + prior phase4 docs |
| Staged | **0** | |
| **Exact total changed** | **40** | |
| Reported approximate | 25 | Porcelain lines (dirs collapsed) — **under-count** |
| Runtime | **17** | |
| Test | **6** | |
| Manifest | **1** | `scripts/ci/unit-test-files.json` |
| Documentation (pre-review) | **16** | `docs/.../phase4/*` |
| Unrelated | **0** | |
| package/lock changed | **0** | |
| SQL / env / deploy / Production config | **0** | |
| Owner untracked preserved | **10** | |

### Runtime (17)

`src/auth/authGuard.js`, `menuAccess.js`, `tournamentEngineRouteAccess.js`, `src/components/auth/RouteAccessGate.jsx`, `src/config/navigationConfig.js`, canonical-shell config/services (6), `SkillAssessmentV5Page.jsx`, `TournamentEnginePage.jsx`, `router.jsx`, `SkillAssessmentV5RouteGuard.jsx`, `skillAssessmentV5RouteAccess.js`

### Tests (6) + manifest (1)

Phase 2/3 updates; phase4 b01/b03/tournament-authz; UI a11y; `unit-test-files.json`

---

## 2. OD-B01 — PASS

| Check | Result |
|-------|--------|
| `/messages` = Messaging Experience | PASS |
| `/crm/messages` = CRM Messages | PASS |
| No redirect either direction | PASS |
| Distinct menu / search / breadcrumbs | PASS |
| Distinct RBAC (`[]` vs booking/customer) | PASS |
| No duplicate same-path active entry | PASS |
| Semantic regression | None found |

---

## 3. OD-B02 — PASS

| Check | Result |
|-------|--------|
| Audited unresolved retained | PASS (42) |
| Catalog mounts incl. entry-fee alias | PASS (**43**) |
| No route deleted / no invented redirect / no fabricated id | PASS |
| Direct mounts remain | PASS |
| Legacy writers retained under flag OFF | PASS (documented observation) |
| No legacy hub in canonical menu/search | PASS |

---

## 4. OD-B03 — CHANGES REQUIRED

| Matrix cell | Result |
|-------------|--------|
| Unauthenticated → login | PASS (guard) |
| SUPER_ADMIN allow | PARTIAL — guard allows; **page blocks when V5 flag OFF** |
| PLATFORM_ADMIN allow | PARTIAL — same |
| PLAYER + flag ON + enrollment | PASS (uses `resolveRatingV5Access`) |
| PLAYER + flag ON + no enrollment | PASS → 403 (guard) |
| PLAYER + flag OFF | PASS — controlled unavailable |
| Other roles → 403 | PASS |
| Unknown role fail-closed | PASS (non-PLAYER/non-admin deny) |
| Hidden desktop/mobile/search | PASS |
| No invented auth source | PASS — reuses Rating V5 enrollment |

**Defect BR-B03-01:** `SkillAssessmentV5Page.jsx` denies admin tech-eval workspace when `VITE_PICK_VN_RATING_V5_ENABLED` is OFF, contradicting OD-B03 “allow SUPER_ADMIN / PLATFORM_ADMIN” (guard allows; page blocks).

**Defect BR-B03-02:** Phase 4 B03 tests never render `SkillAssessmentV5RouteGuard` or exercise async enrollment / admin-flag-off.

---

## 5. Plural Tournament Authorization — CHANGES REQUIRED

| Check | Result |
|-------|--------|
| Nested Engine not public via prefix | PASS (removed from `PUBLIC_PATH_PREFIXES`) |
| Exact `/tournaments` public | PASS |
| `/tournaments/` trailing slash public | **FAIL** — not treated as catalog |
| Auth required when authz enforced | PASS if `authProduction \|\| rbac` |
| `tournament.update` required | **FAIL when `rbacEnabled=false`** (skipped) |
| Ownership/tenant required | **WEAK when `rbacEnabled=false`** (`guardClubAccess` short-circuits ok) |
| Unauthorized denied (RBAC on) | PASS path exists |
| Unknown role fail-closed (RBAC on) | PASS via permission deny |
| Weaker than claimed under auth-prod + RBAC-off | **YES — material** |

**Defect BR-PLURAL-01 (P1):** `RouteAccessGate` only runs `shouldRedirectToForbidden` when `rbacEnabled` is true. With `authProductionEnabled=true` and `rbacEnabled=false`, authenticated users skip `tournament.update` and ownership uses `rbacEnabled=false`, so club/tenant guard is not enforced.

**Defect BR-PLURAL-02:** `isPublicTournamentsCatalogPath` rejects `/tournaments/` (trailing slash), so the public catalog deep-link can force login incorrectly.

**Defect BR-PLURAL-03:** Tournament authz tests are helper/source-text only; they do not render `RouteAccessGate` for missing permission, cross-club ID, or RBAC-off bypass.

---

## 6. Route / RBAC regression

| Metric | Result |
|--------|--------|
| Inventory reconciliation | **179/179 PASS** |
| Active menu nodes | **76** (was 75; **intentional** +1 `/messages` dual-canonical) |
| Contextual routes | **7** |
| Duplicate active entries | **0** |
| B01 dual-canonical / B02 hubs hidden / B03 shadow hidden | Consistent with Owner decisions |
| Private Pairing protected | PASS (Phase 3 tests) |
| Flag OFF = legacy only / ON = canonical only | PASS (`MainLayout` exclusive) |
| Rollback = flag OFF | PASS |

---

## 7. Accessibility — PASS WITH NOTES

| Check | Result |
|-------|--------|
| Escape close + focus restore | PASS (Phase 3 UI) |
| Shift+Tab trap test | PASS — asserts focus stays in drawer panel / not on trigger |
| Meaningful (not pure MUI trivia) | Acceptable for observation closure |
| Keyboard dead-end / viewport regression | None found |

Note: a11y UI mocks `RouteAccessGate` (appropriate for shell a11y scope; not auth coverage).

---

## 8. Static import observation — OBSERVATION

- No unauthorized bundle refactor  
- Inter still dynamic-import on canonical shell mount  
- Vite chunk-size warning remains non-blocking / accurately reported  

---

## 9. Test quality — CHANGES REQUIRED

| Check | Result |
|-------|--------|
| `.only` / skipped | None in Phase 4 files |
| Weakened Phase 2/3 for dual-canonical | Intentional and consistent with OD-B01 |
| Critical auth mocked away / source-only | **YES** for Engine gate + V5 guard matrix gaps |
| False-positive PASS risk | **YES** — suite green while BR-PLURAL-01 / BR-B03-01 exist |

---

## 10. Documentation review

| Claim | Agreement |
|-------|-----------|
| Owner decisions | Consistent |
| 42 audited vs 43 mounts | Consistent when stated; some prose says “42+” |
| 0 new redirects / 7 protected / public catalog | Consistent |
| 6884/6884 / Production OFF / mutations 0 | Consistent |
| File count “~25” | **Inexact** vs exact **40** |
| Active menu still “75” | **Not restated in implementation report**; runtime is **76** (intentional) |

---

## 11. Independent validation (re-run)

| Gate | Result |
|------|--------|
| Focused Phase 4 unit | PASS 13/13 |
| Phase 3 + Phase 4 focused | PASS 27/27 |
| `npm run test:unit` | PASS **6884/6884** |
| UI a11y + Phase 3 shell | PASS 5/5 |
| `lint:no-new` | PASS |
| `build` | PASS |
| Secret scan | PASS (0) |
| Package/lock | PASS Inter `^5.3.0` / `5.3.0` |
| `git diff --cached` | Empty (staged = 0) |

---

## 12. Scope integrity — PASS

Unrelated = 0; no package-lock / SQL / env / deploy / Production config changes; owner 10 untracked preserved.

---

## Required changes before commit

1. **BR-PLURAL-01:** Enforce `tournament.update` + real ownership/tenant checks for Engine routes whenever auth production is on (not only when RBAC is on); do not pass a mode that short-circuits club access.  
2. **BR-PLURAL-02:** Treat `/tournaments` and `/tournaments/` as public catalog.  
3. **BR-B03-01:** Align page tech-eval with OD-B03 — admins allowed even when flag OFF (or document Owner waiver; currently conflicts).  
4. **BR-TEST-01:** Add behavioral tests rendering `RouteAccessGate` / `SkillAssessmentV5RouteGuard` for the failing matrix cells (RBAC-off Engine, missing permission, admin flag-off, enrollment deny).  
5. **BR-DOC-01:** Correct file inventory to exact 40; state ACTIVE_MENU **76** as intentional OD-B01 delta.

---

## Blockers / Warnings

**Blockers (must fix or Owner-waive before commit):**

1. BR-PLURAL-01 — Engine protection bypass under auth-prod + RBAC-off  
2. BR-B03-01 — Admin tech-eval blocked by page when flag OFF  

**Warnings:**

1. BR-PLURAL-02 trailing slash catalog  
2. BR-TEST-01 coverage gaps  
3. BR-DOC-01 inventory / ACTIVE_MENU documentation precision  
4. Static import observation retained  
5. Vite chunk-size warning non-blocking  

---

## Safety attestation

| Check | Value |
|-------|------:|
| Production mutations | **0** |
| SQL execution | **0** |
| Deployments | **0** |
| Production feature flag changes | **0** |
| Runtime modified by review | **NO** |
| Commit / push / PR | **NO** |

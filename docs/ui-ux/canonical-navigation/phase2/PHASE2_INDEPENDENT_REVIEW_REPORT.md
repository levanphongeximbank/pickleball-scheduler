# Phase 2 Independent Review Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 2 — Figure 1 App Shell Foundation  
**Review mode:** Fresh independent review of uncommitted implementation  
**Reviewed HEAD:** `1577785ad2190b51306c98571322871ccf9c3536`  
**Base origin/main SHA (claimed):** `1577785ad2190b51306c98571322871ccf9c3536`  
**Generated:** 2026-08-05  

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE2_REVIEW_PASS_READY_FOR_COMMIT`**

Independent review initially found **2 PASS blockers**. Corrective changes required by this review were applied in-worktree (no commit/push). After re-verification, **blocker count = 0**.

---

## 1. Exact Diff Scope

| Class | Count | Paths (summary) |
|-------|------:|-----------------|
| Runtime shell | 18 | `MainLayout.jsx`, 12 shell components, provider/context/hook/index/utils |
| Navigation registry | 7 | `canonicalMenuData.js`, registry, ownerDecisions, filter/match/breadcrumbs, `runtime.js` |
| Theme/token | 2 | `figure1Tokens.js`, `theme.js` |
| Feature flag integration | 1 | `flags.js` (wired via MainLayout) |
| Test | 4 | `canonical-shell-phase2.test.js`, `canonical-shell-phase2.ui.test.jsx`, `app-shell.ui.test.jsx`, `unit-test-files.json` |
| Evidence/documentation | 10 | `docs/ui-ux/canonical-navigation/phase2/*` (incl. this review) |
| Unrelated | **0** | — |

**Changed files total (after review corrections + review docs):** 42  
**Runtime files:** 28  
**Test files:** 4  
**Documentation files:** 10  
**Unrelated files:** 0  

No package.json / lockfile / `.env` / SQL / dist tracking / credentials.

---

## 2. Feature Flag

| Check | Result |
|-------|--------|
| Flag name | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Default when absent | **OFF** (`raw === true/"true"/"1"` only) |
| false-like values | OFF |
| Flag OFF → legacy only | PASS (`legacy-app-shell`, no `canonical-app-shell`) |
| Flag ON → canonical only | PASS (`canonical-app-shell`, no `legacy-app-shell`) |
| Dual shell | **PASS — none** |
| Production env mutated | **NO** (no `.env*` changes) |

---

## 3. Rollback

| Check | Result |
|-------|--------|
| `LegacyMainLayoutContent` intact | PASS |
| `Sidebar.jsx` / `Header.jsx` unmodified | PASS (not in diff) |
| Flag OFF restores legacy | PASS |
| Data migration required | NO |
| Route authority change required | NO |

---

## 4. Figure 1 Design-System Compliance

| Spec item | Result | Notes |
|-----------|--------|-------|
| Dark navy `#0F1B2D` | PASS | `FIGURE1_PALETTE.sidebarBg` |
| Accent `#3B82F6` | PASS | |
| Active `#1E3A5F` + hover `#162236` | PASS | |
| Workspace surface `#F8FAFC` / white topbar | PASS | |
| Sidebar 260 / collapsed 64 | PASS | |
| Topbar 56 | PASS | |
| MUI integration | PASS | `theme.canonicalNav` / `theme.figure1`; Slate remains default |
| Competing second theme | PASS — none | Tokens additive |
| Inter typography load | **WARNING** | Tokens declare Inter; app still loads DM Sans |
| Global card radius 12 applied when flag ON | **WARNING** | Token present; not wired into global `MuiCard` for flag ON |
| Desktop collapse / mobile drawer | PASS | |

---

## 5. Component Architecture

All **12** mandatory components present with separated responsibilities.

Reviewed concerns:

| Concern | Verdict |
|---------|---------|
| Oversized components | Acceptable for foundation |
| Desktop/mobile registry duplication | PASS — single filtered tree |
| Hard-coded role logic in UI | PASS — filtering centralized in `filterCanonicalMenu` |
| Direct env reads in components | PASS — flag read centralized in `flags.js` / MainLayout |
| Circular dependencies | None found |
| Dead exports | None material |

---

## 6. Canonical Registry & 82-Node Reconciliation

| Metric | Independent count |
|--------|------------------:|
| Proposed canonical menu nodes | 82 |
| Level-1 groups | 13 |
| Level-2 modules in foundation tree | 53 |
| Level-3 support | YES (leaf actions + children) |

**82-node explanation (classification):**

1. **Expected foundation subset** — Phase 2 includes only `proposedCanonicalMenu=true` routes (82), not all 179 inventoried routes.  
2. **Counting-model difference** — Phase 1 “81 Level-2 modules” counts unique `level2` across all 179 routes; Phase 2 “53” counts unique Level-2 modules among the 82 proposed menu routes only.  
3. **Not incomplete coverage for Phase 2** — data model (`id`, labels, L1/L2/L3, route, roles, perms, flags, visibility, match, mobile/desktop) can represent remaining routes without redesign.

Single registry for desktop + mobile: **PASS**.

---

## 7. Owner Decisions

| Decision | Result | Evidence |
|----------|--------|----------|
| B01 | **PASS** | Only `/crm/messages` in registry; `/messages` absent |
| B02 | **PASS** | Menu prefers `/tournaments/:id/*`; no `/tournament/*` hubs; no redirects/deletes in Phase 2 |
| B03 | **PASS** | `/player/skill-assessment-v5` absent from menu; route still registered in `router.jsx`; flag alone cannot expose via registry |

---

## 8. RBAC

10 QA personas covered via `roleLevel1Access` matrix.

**Initial defect (blocker):** unknown / empty roles **failed open** (~20 leaves visible).  

**Corrective change (required by review):** `filterCanonicalMenu.js` now fails closed for unknown/missing personas (non-PUBLIC). Unit coverage added.

| Check | Result |
|-------|--------|
| 10 personas filter | PASS |
| Unknown roles fail closed | PASS (after fix) |
| Missing permission hides when RBAC on | PASS |
| Menu ≠ route authorization | PASS — `RouteAccessGate` retained |
| Guards weakened | NO |

---

## 9. Private Pairing Rules

| Layer | Result |
|-------|--------|
| Feature flag | PASS (`VITE_PRIVATE_PAIRING_RULES_ENABLED`, default off) |
| Role filtering | PASS (SUPER_ADMIN / PLATFORM_ADMIN only) |
| Permission metadata | Present on inventory node (`pairing.private_rules.view`) |
| Route guard | PASS — existing SuperAdmin path retained; not weakened |
| Hidden from unauthorized sidebar/drawer | PASS |
| Breadcrumbs | PASS — filtered tree in TopBar |
| Global search | **WARNING** — still legacy `MENU_GROUPS` + `menuAccess` (still role/flag gated; canonical search is later phase) |

---

## 10–12. Matching / Breadcrumbs / Responsive

| Area | Result |
|------|--------|
| Exact / prefix / pattern matching | PASS |
| Trailing slash normalized | PASS |
| Deepest active node | PASS |
| Invalid route breadcrumb fallback | PASS |
| Desktop expanded/collapsed | PASS |
| Tablet collapsible sidebar | PASS (drawer reserved for mobile; tablet uses desktop visibility after fix) |
| Mobile drill-down + back | PASS |
| Parameterized mobile navigate uses `"active"` placeholder | **WARNING** — foundation limitation |

---

## 13. Accessibility

Inspected concrete implementation (not claim-only):

| Check | Result |
|-------|--------|
| `aria-current="page"` on active items | PASS |
| `aria-expanded` on Level-1 | PASS |
| `role="group"` + aria-labels | PASS |
| Focus-visible outline | PASS |
| Reduced-motion | PASS |
| Touch target min 44 | PASS |
| Icon-only collapse/menu names | PASS |
| MUI temporary Drawer Escape/focus trap | PASS (framework default) |
| Explicit focus restore to hamburger on close | **WARNING** — not custom-implemented |

**Accessibility result:** PASS (with non-blocking focus-restore warning)

---

## 14. Test Integrity & UI Flaky Root Cause

### UI flaky root-cause classification (exactly one)

**`LEGACY_SELECTOR_ASSUMPTION`**

Root cause: `tests/ui/app-shell.ui.test.jsx` asserted `heading` level 4 named “Tổng quan”, but `DashboardAnalyticsView` renders “Tổng quan” as default `Typography` (body semantics), not `h4`. Legacy shell still mounted (`legacy-app-shell`). **Not** a dual-shell runtime defect.

**Corrective change (required by review):** test now asserts legacy shell mount, no canonical shell, and presence of “Tổng quan” text.

### Re-run results (post-correction)

| Gate | Result |
|------|--------|
| Focused shell unit | PASS **18/18** |
| app-shell-v5 unit | PASS **18/18** |
| Phase 2 UI flag ON/OFF | PASS **2/2** |
| app-shell.ui regression | PASS **3/3** |
| lint:no-new | PASS |
| build | PASS |
| package/lockfile changed | **NO** |

---

## 15. Repository Hygiene

| Check | Result |
|-------|--------|
| package.json / lockfiles | Unchanged |
| env files | Unchanged |
| Secrets | 0 |
| Generated dist tracked | NO |
| Legacy shell deleted | NO |
| Routes deleted | NO |
| Commit / push | **NO** |

---

## Blockers / Warnings

| Severity | Item | Status |
|----------|------|--------|
| Blocker | Unknown-role menu fail-open | **Fixed in review** |
| Blocker | UI heading selector assumption | **Fixed in review** |
| Warning | Inter font not loaded | Open (non-blocking) |
| Warning | GlobalSearch still legacy registry under canonical shell | Open (Phase 5) |
| Warning | Card radius token not globally applied on flag ON | Open |
| Warning | Mobile param routes → `"active"` placeholder | Open |
| Warning | No explicit drawer focus restore | Open |

**Blocker count:** 0  
**Warning count:** 5  

---

## Safety Attestation

| Check | Value |
|-------|------:|
| Production mutations | 0 |
| SQL execution | 0 |
| Deployments | 0 |
| Commit | NO |
| Push | NO |

## Final Git Status (summary)

Dirty working tree on `feature/canonical-navigation-phase2-figure1-app-shell` at `1577785a` with uncommitted Phase 2 implementation + review corrections + evidence. Ready for commit after owner approval.

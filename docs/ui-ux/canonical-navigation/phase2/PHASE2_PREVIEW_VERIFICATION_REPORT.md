# Phase 2 Preview & Merge-Readiness Verification Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 2 — Figure 1 App Shell Foundation  
**Mode:** Verification only (no Production mutation, no SQL, no merge, no rebase)  
**Generated:** 2026-08-05  

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE2_PREVIEW_PASS_READY_FOR_OWNER_MERGE`**

---

## Identity

| Field | Value |
|-------|-------|
| PR | **#375** |
| URL | https://github.com/levanphongeximbank/pickleball-scheduler/pull/375 |
| Branch | `feature/canonical-navigation-phase2-figure1-app-shell` |
| PR head SHA | `49b5256adbe8cb12e2cfdfb8b99192d490ba1233` |
| Fresh `origin/main` SHA | `48c89233ef771f65fd65de0f4c2268299bad37d9` |
| Branch behind / ahead | **2 behind / 1 ahead** |
| PR state | OPEN |
| Draft | YES |
| Mergeable | **MERGEABLE** (`mergeStateStatus: CLEAN`) |
| Changed files | **42** |
| Commits on PR | **1** |

---

## Base Compatibility (no rebase)

| Check | Result |
|-------|--------|
| Fresh `git fetch origin main` | Done |
| Behind commits | PR **#374** rating V5 published-authority readiness audit (**docs only**) |
| Overlap with Phase 2 shell files | **NONE** |
| `git merge-tree` conflict risk | Docs-only add; no shell/theme/test conflict |
| Auto-rebase performed | **NO** |
| Branch modified for base correction | **NO** |

Compatibility proven without modifying the branch. GitHub reports CLEAN mergeability.

---

## CI / Preview Checks

| Check | Result | Evidence |
|-------|--------|----------|
| Production CI Gate (`verify`) | **SUCCESS** | Actions run `31003984375` |
| Vercel Preview | **SUCCESS** | Ready |
| Vercel Preview Comments | **SUCCESS** | Neutral/supportive |
| Netlify `deploy-preview` | **SUCCESS** | Deploy `6a73268d1f718600095e317c` |
| Netlify Header/Pages rules | **NEUTRAL** | Expected informational |
| Netlify Redirect rules | **SUCCESS** | |

### Preview URLs

| Provider | URL | Preview SHA match |
|----------|-----|-------------------|
| **Netlify (primary)** | https://deploy-preview-375--stirring-bombolone-280231.netlify.app | **YES** — PR comment Latest commit `49b5256adbe8cb12e2cfdfb8b99192d490ba1233` |
| Vercel | https://pickleball-scheduler-git-feature-ca-bd31b0-pickleball-scheduler.vercel.app | Tied to PR deployment Ready for same head |

Preview bundle includes both `canonical-app-shell` and `legacy-app-shell` markers and flag key (Vite bake-time). Preview env keeps **`VITE_CANONICAL_APP_SHELL_ENABLED` OFF** (Production vars untouched).

---

## Feature Flag

| Item | Result |
|------|--------|
| Flag | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Production env changed | **NO** (0) |
| Preview Production flag enable | **NO** |
| Flag ON exercise | Controlled local Vite only (`127.0.0.1:5180`) |
| Flag OFF exercise | Preview login + controlled local Vite (`127.0.0.1:5181`) |

---

## Browser Smoke — Flag OFF

| Surface | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Preview `/login` (Netlify + Vercel) | PASS | PASS | PASS |
| Controlled local authenticated legacy shell | PASS | PASS | PASS |
| Exclusive legacy (`legacy-app-shell`, no canonical) | PASS | PASS | PASS |
| Login reachable | PASS | PASS | PASS |
| Horizontal overflow (shell route `/settings`) | PASS | PASS | PASS |
| Console errors (filtered known MUI DOM-prop noise) | **0** | **0** | **0** |

Preview SPA login does not mount app shell (expected). Authenticated legacy exclusivity verified on controlled local with flag OFF.

---

## Browser Smoke — Flag ON (controlled local)

| Check | Desktop | Tablet | Mobile |
|-------|---------|--------|--------|
| Exclusive canonical shell | PASS | PASS | PASS |
| Dark navy sidebar `#0F1B2D` | PASS | N/A (drawer) | N/A (drawer) |
| Top bar present | PASS | PASS | PASS |
| Expanded / collapse | PASS | — | — |
| Drawer open/close | — | PASS | PASS |
| Level-1 / Level-2 nav interaction | PASS | PASS | PASS |
| Breadcrumbs (`Đường dẫn điều hướng`) | PASS (desktop settings) | Present in shell tree | Present in shell tree |
| Horizontal overflow on `/settings` | PASS | PASS | PASS |
| Console errors | **0** | **0** | **0** |

Note: Dashboard chart content can exceed mobile viewport width; shell-owned routes (`/settings`) show **no** horizontal overflow. Classified as page-content, not Phase 2 shell blocker.

---

## RBAC Smoke

| Role | Result | Notes |
|------|--------|-------|
| SUPER_ADMIN | PASS | 71 leaves; `/crm/messages` once; Private Pairing hidden (flag default off) |
| VENUE_OWNER | PASS | 20 leaves |
| CLUB_MANAGER | PASS | 17 leaves |
| REFEREE | PASS | 16 leaves |
| PLAYER | PASS | 18 leaves |
| Unknown role | PASS | **0 leaves** (fail closed) |

| Invariant | Result |
|-----------|--------|
| Private Pairing hidden unauthorized | **PASS** |
| B01 `/crm/messages` once; no `/messages` | **PASS** |
| B02 no second `/tournament/*` menu authority | **PASS** (`legacyTournamentHubCount: 0`) |
| B03 V5 skill assessment hidden from menus | **PASS** |

---

## Known Warnings W01–W05 (reconfirmed)

| ID | Status | Merge blocker? |
|----|--------|----------------|
| W01 Inter font not loaded (DM Sans still loaded) | WARNING | **NO** |
| W02 Global Search remains legacy under canonical top bar | WARNING | **NO** |
| W03 Card radius 12 not global `MuiCard` | WARNING | **NO** |
| W04 Mobile parameterized route label fallback `"active"` | WARNING | **NO** |
| W05 Drawer focus-restore test absent | WARNING | **NO** |

**Blocker count:** 0  
**Warning count:** 5  

---

## Quality Gates (re-run on PR head)

| Gate | Result |
|------|--------|
| Focused shell unit `tests/canonical-shell-phase2.test.js` | **PASS 18/18** |
| Navigation / RBAC contracts (same suite) | **PASS** |
| `tests/app-shell-v5.test.js` | **PASS 18/18** |
| `tests/ui/canonical-shell-phase2.ui.test.jsx` + `app-shell.ui.test.jsx` | **PASS 5/5** |
| `npm run lint:no-new` | **PASS** |
| `npm run build` | **PASS** |
| Diff check vs `origin/main` | 42 files; shell/docs/tests only |
| Secret scan on PR diff | **PASS** (0 credential hits) |
| package.json / lockfile changed | **NO** |

---

## Safety Attestation

| Item | Value |
|------|-------|
| Production mutations | **0** |
| SQL execution | **0** |
| Production feature flag changes | **0** |
| Deployment from local machine | **0** |
| Route deletion | **0** |
| Legacy shell deletion | **0** |
| Commit / push during verification | **NO** |
| Reset / rebase / amend / force-push | **NO** |
| Merge performed | **NO** |

---

## Owner Merge Notes

1. PR remains **Draft** until Owner explicitly marks Ready + merges.  
2. Branch is 2 commits behind `main` (docs-only). GitHub CLEAN — optional update-from-main is Owner choice; not required for compatibility.  
3. Keep `VITE_CANONICAL_APP_SHELL_ENABLED` **OFF** in Production until a later enablement decision.  
4. W01–W05 remain tracked non-blockers for follow-up phases.

# Wave 1 Batch 1E — Final Closure Report

**WORKSTREAM:** PICK_VN — AUTHENTICATED WEB APP EXPERIENCE  
**WAVE:** WAVE 1 — CANONICAL APP SHELL + NAVIGATION  
**PR:** #463 (`feat/web-app-wave1-shell-navigation-01`)  
**EXPECTED_PRE_HEAD:** `3087cbcfa0e57f98802c8c3ca808aebaac4eb9cc`  
**OWNER_GO:** YES  
**PR_MERGED:** NO — Owner merge approval required  

## Main sync

| Field | Value |
|---|---|
| CURRENT_BRANCH_HEAD (pre-1E docs) | `3087cbcf…` |
| CURRENT_ORIGIN_MAIN | `0fefcb7d…` |
| COMMITS_MAIN_AHEAD | 0 |
| COMMITS_BRANCH_AHEAD | 5 (1A–1D) |
| MAIN_SYNC_REQUIRED | NO |
| MAIN_SYNC_RESULT | ALREADY_CONTAINS_ORIGIN_MAIN |
| MAIN_SYNC_CONFLICT | NO |

## PR scope audit (`origin/main...HEAD` at certification)

- **TOTAL_PR_CHANGED_FILES:** 95 (pre-1E artifact commit) + Batch 1E evidence/scripts when landed  
- **UNEXPECTED_DIFF_FILE_COUNT:** 0  
- Scope: shell/layout, menu IA, topbar Help, responsive chrome, tests, evidence docs, capture harnesses  
- Not in PR: SQL, backend, domain writers, Tournament Experience 23 internals, Public Web redesign  

## Batch certifications (final)

### 1A — Shell exclusivity

- `AUTHENTICATED_MAINLAYOUT_BYPASS_COUNT=0` (Coming Soon under MainLayout)  
- Flag ON: CanonicalAppShell=1 / Legacy=0  
- Flag OFF: Canonical=0 / Legacy=1  
- `SIMULTANEOUS_APP_SHELL_RENDER=NO`  
- `ROLLBACK_PATH_PRESERVED=YES`  
- `NEW_SHELL_FLAG_CREATED=NO` (`VITE_CANONICAL_APP_SHELL_ENABLED` only)  

### 1B — Sidebar / Menu IA

- `SAME_USER_UNJUSTIFIED_DUPLICATE_COUNT=0`  
- `DUPLICATE_MENU_ROUTES_FINAL=20` (role-gated / distinct contracts retained)  
- `ROLE_MENU_AUTH_MISMATCH=0` · `CASHIER_OVEREXPOSED_MENU=0` · `CAPTAIN_NULL_VISIBLE_LEAVES=0`  
- `/messages` ≠ `/crm/messages`  
- Tournament strangler hubs preserved; Experience-23 sidebar leaves added = 0  

### 1C — Topbar

- Help → `/support` · `HELP_ROUTE_ACCESS=PASS` · `SUPPORT_AUTH_GAP_FOUND=NO`  
- Reused: AccountMenu, CanonicalGlobalSearch, CanonicalNotificationButton, Tenant/Club switchers  
- `TOPBAR_ROLE_VISIBILITY_MISMATCH=0`  

### 1D — Responsive shell

- Desktop ≥1200 expanded ~260 · Tablet 900–1199 rail ~64 · Mobile ≤899 no persistent sidebar  
- Drawer + MobileBottomNav reused  
- Shell horizontal overflow = 0 (evidence + tests)  
- Bottom nav: null path = 0; CASHIER check-in excluded  

### 1E — Closure

- Full local matrix PASS (see below)  
- Remote Vercel + Netlify deploy-preview SUCCESS at HEAD `3087cbcf`  
- Visual evidence under this folder  

## WAVE6 page-responsive gaps (sample; not fixed in Wave 1)

| ID | Surface | Note |
|---|---|---|
| W6-PAGE-001 | `src/pages/courtManagement/calendar/CourtCalendarWeekMatrix.jsx` | `minWidth: 900` — page-owned horizontal layout on narrow viewports |
| W6-PAGE-002 | `src/pages/AuditLogPage.jsx` | Dense table cells with `nowrap` / ellipsis — page content, not shell |

`WAVE6_PAGE_RESPONSIVE_GAP_COUNT=2`  
Shell responsiveness closed in 1D; page content belongs to later authenticated Web App waves.

## Freezes

- `WAVE0_AUTHORIZATION_CHANGED=NO` (route permission model / RouteAccessGate / TOURNAMENT_VIEW|UPDATE unchanged; only `/messages` PUBLIC_MENU_PATHS for menu IA)  
- `TOURNAMENT_23_INTERNAL_UI_CHANGED=NO`  
- `PUBLIC_WEB_CHANGED=NO` (PR diff)  
- `DOMAIN_CODE_CHANGED=NO` · `BACKEND_CHANGED=NO` · `DATABASE_CHANGED=NO`  

## Local gates

| Gate | Result |
|---|---|
| Batch 1A–1D targeted + Wave0 + menu + Tournament A1–F + wave4 | PASS (199) |
| Full unit | PASS (9225 tests / 0 fail) |
| Foundation lock | PASS |
| lint:no-new | PASS |
| Build | PASS |
| Authenticated shell UI smoke (`web-app-wave1-batch1a-shell-exclusivity.ui.test.jsx`) | PASS (11) |
| Batch 1E visual capture | PASS (7 shots) |

## Remote gates (PR #463 @ `3087cbcf`)

| Check | Status |
|---|---|
| Vercel | SUCCESS |
| Netlify deploy-preview | SUCCESS |
| Production CI `verify` | SUCCESS |

## Accessibility (shell-level source audit)

Collapse control, rail tooltips, hamburger, drawer Escape/focus (MUI Modal), Help/Search/Notification/Account `aria-label`s, bottom-nav `aria-current` — **SHELL_A11Y_CRITICAL_GAPS=0**.

## Stop

`BATCH_1E_COMPLETE=YES` · `WAVE_1_COMPLETE=YES` (pending Owner merge)  
`OWNER_FINAL_REVIEW_REQUIRED=YES` · `OWNER_MERGE_GO_REQUIRED=YES` · `STOP_NOW=YES`  
**Do not merge PR #463 in this batch.**  
**Do not start Wave 2.**

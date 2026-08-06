# Phase 4 Readiness Audit — Legacy Runtime Redirect & Cutover

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Audit first (no runtime changes)  
**Generated:** 2026-08-06  
**Fresh `origin/main` SHA:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\ui-ux\canonical-navigation-phase4`  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Phase 3 status:** `CANONICAL_NAVIGATION_PHASE3_POST_MERGE_CLEANUP_VERIFIED` · `PHASE3=CLOSED`

Machine-readable twin: [`PHASE4_READINESS_AUDIT.json`](./PHASE4_READINESS_AUDIT.json)

---

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE4_READY_WITH_BLOCKERS`**

Phase 3 canonical menu/search authority under flag ON is sound. Phase 4 may plan implementation, but must not ship B01/B02 redirects or Preview flag-ON cutover until the blockers below are resolved.

---

## Setup attestation

| Check | Result |
|-------|--------|
| `git fetch origin --prune` | Done |
| Fresh `origin/main` SHA | `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93` |
| Expected base SHA match | YES |
| Owner untracked files | **10** preserved |
| Owner tracked diff | Clean |
| Worktree registered | YES |
| Branch | `feature/canonical-navigation-phase4-runtime-cutover` |
| HEAD == `origin/main` | YES |
| Runtime code changed | **NO** |
| Redirects created | **NO** |
| PR / deploy / Production | **NO** |

---

## A. Legacy route inventory

Source: Phase 1 inventory (179 routes) + live `src/router.jsx` + Phase 3 registry.

| Class | Count |
|-------|------:|
| LEGACY | 48 |
| SHADOW | 1 |
| DUPLICATE | 1 |
| **Audit scope (deduped)** | **50** |
| B02 controlled `/tournament/*` | 43 |

Full per-route field matrix is in `PHASE4_READINESS_AUDIT.json` → `routeInventory` and [`PHASE4_ROUTE_REDIRECT_MATRIX.md`](./PHASE4_ROUTE_REDIRECT_MATRIX.md).

Minimum coverage confirmed:

| Path / family | Runtime today | Menu/search (flag ON) | Menu/search (flag OFF) | Phase 4 action |
|---------------|---------------|------------------------|-------------------------|----------------|
| `/messages` | `MessagingExperiencePage` (active) | Absent | Active legacy messaging leaf | **Blocked** — see B01 |
| `/crm/messages` | `CrmMessagesPage` | Sole authority | Also in CRM menu | Retain |
| `/tournament/*` (43) | Full legacy mounts | Absent | Active V5 tournament menu | Retain; no invented redirects |
| `/tournaments/:tournamentId/*` (7) | `TournamentEnginePage` | Contextual canonical | Available via direct links | Retain; fix authz |
| `/player/skill-assessment-v5` | `SkillAssessmentV5Page` | Hidden | Can expose to PLAYER if V5 flag on | Guard only — see B03 |
| Pre-existing redirects (4) | `<Navigate replace>` | N/A | N/A | Verify query/hash policy |

---

## B. B01 — `/messages` → `/crm/messages`

**Classification:** `BLOCKED_PENDING_OWNER_RECONFIRM`

| Claim | Proven? | Evidence |
|-------|---------|----------|
| `/crm/messages` sole canonical menu/search authority (flag ON) | YES | `buildCanonicalSearchIndex.js`, Phase 3 tests |
| `/messages` not independently active in canonical menu/search | YES | Phase 3 invariants |
| Owner disposition `REDIRECT_LEGACY` | YES | Inventory `redirectTo=/crm/messages` |
| Runtime already redirects | NO | `router.jsx:481` still mounts page |
| Semantic equivalence of surfaces | **NO** | Distinct components + COMMS note |

Critical conflict:

- `/messages` → `MessagingExperiencePage` (COMMS Messaging Experience; `MESSAGING_ROUTE_PATH`; menu note: **distinct from CRM outreach**)
- `/crm/messages` → `CrmMessagesPage` (CRM outreach; RBAC `booking.view | customer.view`)
- `/messages` currently has empty permission list in `navigationConfig` route map

Blind redirect would:

1. Collapse a certified messaging surface into CRM outreach  
2. Apply CRM RBAC to former messaging users (likely `/403`)  
3. Risk losing COMMS query/hash semantics  

**Proposed redirect type (only if owner reconfirms collapse):** `replace` Navigate with explicit `search` + `hash` preservation; back stack must skip legacy.

**Phase 4 action:** Do **not** implement until owner reconfirms either (a) collapse COMMS into CRM, or (b) revise B01 to keep `/messages` as a separate canonical communication route.

---

## C. B02 — Tournament route cutover

**Classification:** `CONTROLLED_RETAIN_NO_PROVEN_PLURAL_MAPPINGS`

Canonical family (retain):

- `/tournaments/:tournamentId/{engine,seed,draw,schedule,courts,ranking,logs}`

Legacy family (43): disposition `CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION`.

| Mapping class | Count | Action |
|---------------|------:|--------|
| Proven plural redirects ready now | **0** | — |
| Within-legacy alias (`/tournament/entry-fee` → `/tournament/config/fee`) | 1 | Verify only |
| Unresolved hub/setup/portal/admin paths | **42** | `RETAIN_NO_REDIRECT` |

Parameter name `:tournamentId` is shared syntactically with Engine routes. That does **not** prove semantic replacement for daily/internal/official/team/register/public/director/bracket hubs.

Do not invent redirects. Additional authz debt before Preview flag ON:

- `PUBLIC_PATH_PREFIXES` includes `/tournaments` → plural engine paths treated as public-auth  
- `menuAccess` prefix RBAC matches `/tournament/` but not `/tournaments/:id/*`  
- `TournamentEnginePage` missing-ID / breadcrumb still `navigate("/tournament")`

---

## D. B03 — Shadow `/player/skill-assessment-v5`

**Classification:** `HIDE_SHADOW_WITH_GUARD_GAP`

| Check | Result |
|-------|--------|
| Hidden from canonical menu/search (flag ON) | YES |
| Redirect required | NO |
| SUPER_ADMIN-only direct access (required) | **NO** — currently authenticated-only |
| Flag-OFF legacy exposure risk | YES — PLAYER menu/mobile when `VITE_PICK_VN_RATING_V5_ENABLED` |

**Phase 4 action:** Add SUPER_ADMIN route guard; keep route; ensure rating flag alone never exposes it; no redirect.

---

## E. Canonical shell flag readiness

Flag: `VITE_CANONICAL_APP_SHELL_ENABLED` (`src/features/canonical-shell/flags.js`)

| Input | Result |
|-------|--------|
| Absent | OFF |
| false-like | OFF |
| `true` / `"true"` / `"1"` | ON |
| OFF | Legacy shell only |
| ON | Canonical shell only |
| Dual shell render | **No** (`MainLayout` exclusive branch) |
| Rollback migration | **None** (flag OFF) |
| Production default | OFF (unchanged) |

Preview flag-ON blockers: B01 semantic decision, B02 no invented redirects + plural authz, B03 guard gap.

---

## F. Static import warning

**Classification:** `OBSERVATION_NOT_BLOCKER`

- `MainLayout` statically imports `CanonicalAppShell` (Phase 2 inheritance)  
- Flag OFF: shell module graph present; shell **not** mounted  
- Inter CSS: dynamic `import()` on mount only → **does not load under OFF**  
- Dynamic import of shell itself: **not required** for Phase 4  
- Bundle impact: observation only

---

## G. Accessibility warning

**Classification:** `OBSERVATION_NOT_BLOCKER`

- Missing branch: dedicated Shift+Tab / focus-trap RTL assertion  
- Current behavior: MUI Modal/Drawer default trap; Escape restore covered in Phase 3  
- Dedicated test before rollout: **not a Phase 4 blocker** (retain as observation / optional test)

---

## H. Writer & link authority

High-confidence **runtime writers** still targeting legacy paths (non-exhaustive; see JSON `writers`):

- `src/config/tournamentRoutes.js`, `src/utils/tournamentNavigation.js`  
- `src/config/v5Menu/tournamentMenu.js`, `messagingMenu.js`  
- `src/pages/tournament/TournamentHome.jsx` + setup/portal pages  
- `src/components/tournament/ActiveTournamentsPanel.jsx`  
- `src/features/communication/experience/constants.js` (`/messages`)  
- `src/router.jsx`, `src/auth/authGuard.js`, `src/auth/menuAccess.js`

Canonical readers (flag ON): `filterCanonicalMenu`, `buildCanonicalSearchIndex`, catalog/ownerDecisions.

Legacy runtime writer occurrences recorded in audit JSON: **26** runtime_writer rows (plus readers/tests/docs classifications).

---

## I. Test plan

See [`PHASE4_TEST_PLAN.md`](./PHASE4_TEST_PLAN.md) — 30 cases covering redirects, query/hash, RBAC, authn/z, deep links, back, invalid params, menu/search uniqueness, breadcrumbs, flag OFF/ON, rollback, desktop/tablet/mobile, a11y, console errors.

---

## J. Production safety

| Check | Value |
|-------|------:|
| Production flag remains OFF | YES |
| Production deployment required for audit | NO |
| SQL required | NO |
| Data migration required | NO |
| Database mutation required | NO |
| Production GO exists | NO |
| Production mutations | **0** |
| SQL execution | **0** |
| Deployments | **0** |
| Production feature flag changes | **0** |

---

## Blockers

1. **BLK-B01-SEMANTIC** — Owner redirect conflicts with distinct COMMS vs CRM products/RBAC  
2. **BLK-B02-NO-MAP** — 42 unmapped `/tournament/*` paths; inventing redirects forbidden  
3. **BLK-B03-GUARD** — Shadow route not SUPER_ADMIN-gated; legacy exposure under V5 flag  
4. **BLK-PLURAL-AUTHZ** — `/tournaments` public-auth prefix + missing plural RBAC matcher  

## Warnings (observations)

1. Static `CanonicalAppShell` import / bundle graph under flag OFF  
2. Shift+Tab RTL matrix gap  
3. Existing Navigate redirects lack explicit query/hash preservation  
4. Engine fallback still writes legacy `/tournament`  
5. Broad legacy runtime writers under flag OFF  

---

## Proposed implementation scope (after blockers)

| Metric | Value |
|--------|------:|
| Proposed implementation files | **10** |
| Proposed test files | **4** |

Suggested focus: B03 guard + plural authz fix + B01 only after owner decision + redirect helper with query/hash policy + orphan cleanup (P4-04) + telemetry hook. **No bulk B02 redirects.**

---

## Safety attestation

| Check | Value |
|-------|------:|
| Commit | **NO** |
| Push | **NO** |
| PR | **NO** |
| Runtime code changed | **NO** |

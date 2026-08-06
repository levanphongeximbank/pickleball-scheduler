# Phase 4 Owner Decision Package

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Blocker resolution planning (read-only)  
**HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Verdict:** `CANONICAL_NAVIGATION_PHASE4_BLOCKER_RESOLUTION_PLAN_READY_FOR_OWNER_DECISIONS`

Machine-readable twin: [`PHASE4_OWNER_DECISION_PACKAGE.json`](./PHASE4_OWNER_DECISION_PACKAGE.json)

Owner must approve or revise each decision below **before** Phase 4 runtime implementation.

---

## OD-B01-MESSAGES

**Question:** Should Communication inbox (`/messages`) and CRM outreach (`/crm/messages`) stay as two separate business functions, or be collapsed?

| | |
|--|--|
| **Recommended** | **A — Keep both as separate canonical business functions** |
| **Rejected** | **B** — Make `/messages` an alias of `/crm/messages` (equivalence **NOT** proven) |
| **Rejected** | **C** — Retire one function and migrate in Phase 4 (CRM migration is a separate program; retiring COMMS destroys certified messaging) |
| **Consequence** | Revise Phase 1 B01: **do not** redirect. Restore `/messages` as canonical Communication; keep `/crm/messages` as canonical CRM outreach. |
| **Risk** | Registry currently treats CRM as sole messaging owner; labels must clearly separate inbox vs outreach. |
| **Implementation impact** | No alias redirect. Update owner decisions, catalog, menu, search; keep both pages mounted. |

**Equivalence proven:** **NO**

---

## OD-B02-TOURNAMENT-RETAIN

**Question:** Approve retaining all 42 unmapped `/tournament/*` routes with zero invented redirects until semantic successors exist?

| | |
|--|--|
| **Recommended** | **RETAIN_ALL_42_NO_REDIRECT** |
| **Rejected** | Bulk redirect hubs/setup to Engine tabs (semantic map unproven) |
| **Rejected** | Invent/guess `tournamentId` for hub redirects (forbidden) |
| **Consequence** | Phase 4 implements **no** B02 redirects. Legacy mounts stay for compatibility. Flag ON menu/search continue excluding `/tournament/*`. |
| **Risk** | Legacy deep links and flag-OFF writers remain until a later migration program. |
| **Implementation impact** | Matrix only; optional Engine breadcrumb/back writer hygiene after plural authz decision. |

**Safely mappable now:** **0 / 42**

---

## OD-B03-V5-SHADOW-AUTHZ

**Question:** Who may open `/player/skill-assessment-v5` by direct URL — SUPER_ADMIN only (Phase 1 B03 text), or enrolled PLAYER pilots under the V5 product contract?

| | |
|--|--|
| **Recommended** | **PILOT_ALIGNED_SHADOW** — Hide from all menus/search; SUPER_ADMIN/PLATFORM_ADMIN always for tech eval; PLAYER only when `VITE_PICK_VN_RATING_V5_ENABLED` + active pilot enrollment; others → 403; flag alone never exposes menu |
| **Rejected** | Strict SUPER_ADMIN-only for all direct access (breaks V5 PLAYER pilot) |
| **Rejected** | Keep status quo (authenticated-only + PLAYER menu when flag on) |
| **Consequence** | Revises B03 direct-access wording; menu/search stay hidden in every shell. |
| **Risk** | If Owner insists on strict SUPER_ADMIN-only, Rating V5 pilot UX breaks until a separate PLAYER entry exists. |
| **Implementation impact** | `authGuard` / `menuAccess` / `navigationConfig`; keep page `resolveRatingV5Access`; denial tests; **no redirect**. |

---

## OD-PLURAL-AUTHZ-PARITY

**Question:** Should `/tournaments/:tournamentId/*` Engine routes require authentication and tournament permissions at least as strong as legacy `/tournament/*` before Preview flag ON?

| | |
|--|--|
| **Recommended** | **PARITY_MIN_AUTH_PLUS_TOURNAMENT_UPDATE** — Protect parameterized Engine family (auth required; route-level `tournament.update` matching page gate or documented split; tenant/club ownership check before engine load). Keep public catalog `/tournaments` public. |
| **Rejected** | Leave `/tournaments/*` public-auth (weaker than legacy) |
| **Rejected** | Only require `tournament.view` (weaker than page `tournament.update` for mutating tabs) |
| **Consequence** | Closes Preview blocker BLK-PLURAL-AUTHZ. |
| **Risk** | Anonymous Engine deep links will require login — intentional hardening. |
| **Implementation impact** | `authGuard.js`, `menuAccess.js`, optional ownership assert, authz tests. |

**Parity today:** PASS **0** / GAP **7**

---

## Approval checklist

- [ ] OD-B01-MESSAGES  
- [ ] OD-B02-TOURNAMENT-RETAIN  
- [ ] OD-B03-V5-SHADOW-AUTHZ  
- [ ] OD-PLURAL-AUTHZ-PARITY  

After approval, proceed per [`PHASE4_BLOCKER_RESOLUTION_PLAN.md`](./PHASE4_BLOCKER_RESOLUTION_PLAN.md) implementation plan.

---

## Safety

| Check | Value |
|-------|------:|
| Production mutations | 0 |
| SQL / deployments / Production flag changes | 0 |
| Runtime / guards / redirects / tests changed | NO |
| Commit / push / PR | NO |

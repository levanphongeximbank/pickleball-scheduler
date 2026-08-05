# PICK_VN Canonical Navigation — Phase 1 Route Inventory

**Program:** PICK_VN Canonical Navigation  
**Branch:** `feature/canonical-navigation-and-shell-redesign`  
**Phase:** 1 — Independent Review Complete  
**Generated:** 2026-08-05  
**Mode:** Audit & documentation only — no runtime changes

Machine-readable inventory: [`CANONICAL_ROUTE_INVENTORY.json`](./CANONICAL_ROUTE_INVENTORY.json)

---

## Review Verdict

**`CANONICAL_NAVIGATION_PHASE1_REVIEW_PASS_READY_FOR_COMMIT`**

Prior verdict `CANONICAL_NAVIGATION_INVENTORY_COMPLETE_READY_FOR_REVIEW` superseded after owner decisions B01–B03 bound.

---

## Executive Summary

| Metric | Count |
|--------|------:|
| Router path declarations (`src/router.jsx`) | 180 |
| Routes inventoried (classified) | **179** |
| Dead orphan pages (no route) | 4 |
| Level-1 business domains | **13** |
| Level-2 modules (unique) | **81** |
| Level-3 actions | **179** |
| Proposed canonical menu routes | **82** |
| CANONICAL | 89 |
| HIDDEN_ACTIVE | 40 |
| LEGACY | 48 |
| DUPLICATE | 1 |
| SHADOW | 1 |
| DEAD_ROUTE (orphan pages) | 4 |
| UNRESOLVED | **0** |
| Owner blockers (B01–B03) | **0** (all resolved) |
| Warnings | 9 |
| Duplicate active canonical menu entries | **0** |
| RBAC roles covered | **10 / 10** |

**Count consistency:** JSON classification sum = 179 = `meta.inventoriedRoutes` ✅

---

## Owner Decisions — Bound

### B01 — Messages Route Ownership ✅ RESOLVED

| Field | Value |
|-------|-------|
| Canonical route | `/crm/messages` |
| Legacy route | `/messages` |
| Disposition | `REDIRECT_LEGACY` |
| Menu owner | CRM & Chăm sóc khách hàng |
| Rule | `/messages` must not remain a separate active menu item |

**Registry impact:** `proposedCanonicalMenu=true` only for `/crm/messages`. `/messages` → `proposedMenuActive=false`.

### B02 — Tournament Engine 4.0 Routes ✅ RESOLVED

| Field | Value |
|-------|-------|
| Canonical route family | `/tournaments/:id/*` |
| Legacy route family | `/tournament/*` |
| Disposition | `CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION` |
| Rule | New navigation points only to canonical family; legacy for compatibility redirects; no dual active menu |

**Registry impact:** 7 `/tournaments/:tournamentId/*` routes → CANONICAL. 43 `/tournament/*` routes → LEGACY (`proposedMenuActive=false`).

### B03 — V5 Skill Assessment Shadow ✅ RESOLVED

| Field | Value |
|-------|-------|
| Route | `/player/skill-assessment-v5` |
| Disposition | `HIDE_SHADOW` |
| Rule | Remove from PLAYER/user-facing menus; flag alone must not expose; SUPER_ADMIN direct access only; route not deleted |

**Registry impact:** `proposedMenuActive=false`, `rbacVisibility=["SUPER_ADMIN"]`. Canonical assessment selection under Rating consolidation program (`/player/skill-assessment`).

---

## Required Fields — All 179 Routes

Every inventory record includes:

| Field | Coverage |
|-------|----------|
| `path` | 179/179 |
| `routeOwner` | 179/179 |
| `level1` + `level1Label` | 179/179 |
| `level2` | 179/179 |
| `level3` | 179/179 |
| `classification` | 179/179 |
| `disposition` | 179/179 |
| `rbacVisibility` | 179/179 |
| `proposedMenuActive` | 179/179 |
| `proposedCanonicalMenu` | 179/179 |

---

## Canonical Navigation Registry

Desktop, mobile, global search, and breadcrumbs **must derive from the same proposed registry** in Phase 2+.

- **Source:** `canonicalNavigationRegistry` in JSON (82 routes with `proposedCanonicalMenu=true`)
- **Principle:** Single registry; no dual authority; no duplicate active canonical menu entries
- **Breadcrumbs/search:** Must use canonical paths only (not legacy `/tournament/*` or `/messages`)

---

## Level-1 Groups (13/13 Covered)

| ID | Label | Route count |
|----|-------|------------:|
| 01 | Tổng quan | 3 |
| 02 | Vận hành sân | 18 |
| 03 | Khách hàng & VĐV | 14 |
| 04 | CLB & Huấn luyện | 20 |
| 05 | Giải đấu | 55 |
| 06 | Rating & Xếp hạng | 7 |
| 07 | Tài chính | 14 |
| 08 | Báo cáo & Phân tích | 2 |
| 09 | AI Assistant | 3 |
| 10 | Thông báo | 7 |
| 11 | Public Portal | 8 |
| 12 | Quản trị nền tảng | 35 |
| 13 | Hỗ trợ | 3 |

---

## Private Pairing Rules — Authorization Audit

| Check | Result |
|-------|--------|
| Permission matrix | PLATFORM_ADMIN only |
| Menu roles filter | PLATFORM_ADMIN, SUPER_ADMIN only |
| Feature flag required | `VITE_PRIVATE_PAIRING_RULES_ENABLED` |
| Route guard | `SuperAdminRouteGuard` |
| UI gate | `SuperAdminFeatureGate` (fail-closed) |
| In proposed canonical menu | SUPER_ADMIN only (`proposedCanonicalMenu=true` when flag on) |

**Status: PASS** — hidden from all 9 non-super-admin roles.

---

## Shadow / Partial / Unfinished Features — Menu Policy

| Item | Current runtime | Proposed registry |
|------|-----------------|-------------------|
| `/player/skill-assessment-v5` | Flag-gated in PLAYER menu | **HIDDEN** (B03) |
| CRM items (5) | PARTIAL badge, active sidebar | `proposedMenuActive=true` with PARTIAL honesty — not generally available |
| `/reports` | PARTIAL badge | Same |
| Coming-soon tech (3) | SYSTEM_TECHNICIAN only | Labeled placeholder — correct |
| `/messages` | Active sidebar (messaging group) | **REMOVED** from proposed menu (B01) |
| `/tournament/*` hub routes | Active sidebar | **REMOVED** from proposed menu (B02) |

---

## V2/V5 Duplication (Post-Review)

| Area | Canonical (proposed) | Legacy |
|------|---------------------|--------|
| Messaging | `/crm/messages` | `/messages` → redirect |
| Tournament engine | `/tournaments/:id/*` | `/tournament/*` → compatibility only |
| Skill assessment | `/player/skill-assessment` (Rating program) | `/player/skill-assessment-v5` → hidden shadow |
| Roles | `PLATFORM_ADMIN`, `TENANT_OWNER` | `SUPER_ADMIN`, `VENUE_OWNER` aliases |

---

## Warnings (9 — Non-blocking)

1. **W01** — PARTIAL CRM/reports in current runtime sidebar
2. **W02** — Global search must index canonical registry in Phase 2
3. **W03** — BreadcrumbProvider needed in Phase 2
4. **W04** — Runtime `tenant` group maps to Level-1 07
5. **W05** — NavMenuFlat unused
6. **W06** — No catch-all 404 route
7. **W07** — ROLE_MENU_MAP legacy key duplication
8. **W08** — RBAC-off permissive mode
9. **W09** — B02: `/tournament/*` hubs lack 1:1 `/tournaments/:id/*` targets — incremental migration in Phase 4

---

## Safety Attestation

| Check | Status |
|-------|--------|
| Runtime files changed | **0** |
| Production mutations | **0** |
| Deployments | **0** |
| SQL | **0** |
| Routes deleted | **0** |
| Commit | **NO** |
| Push | **NO** |

**File scope:** `docs/ui-ux/canonical-navigation/**`, `scripts/generate-canonical-nav-inventory.mjs` only.

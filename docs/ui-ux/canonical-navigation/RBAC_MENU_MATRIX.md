# RBAC Menu Matrix — Canonical Navigation Phase 1 (Review Binding)

Machine-readable matrix: [`RBAC_MENU_MATRIX.json`](./RBAC_MENU_MATRIX.json)  
Route inventory: [`CANONICAL_ROUTE_INVENTORY.json`](./CANONICAL_ROUTE_INVENTORY.json)

**Review verdict:** `CANONICAL_NAVIGATION_PHASE1_REVIEW_PASS_READY_FOR_COMMIT`  
**Roles covered:** 10 / 10

---

## Owner Decision Impact on RBAC Menu

### B01 — Messaging (all roles)

| Role | `/crm/messages` | `/messages` |
|------|:---------------:|:-----------:|
| SUPER_ADMIN | ✅ CRM group | ❌ Removed |
| VENUE_OWNER | ✅ | ❌ |
| VENUE_MANAGER | ✅ | ❌ |
| CASHIER | ❌ | ❌ |
| CLUB_OWNER/MGR | ❌ | ❌ |
| COACH | ❌ | ❌ |
| REFEREE | ❌ | ❌ |
| PLAYER | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ❌ | ❌ |

**Menu owner:** CRM & Chăm sóc khách hàng

### B02 — Tournament (roles with tournament access)

| Role | `/tournaments/:id/*` (canonical) | `/tournament/*` (legacy) |
|------|:--------------------------------:|:------------------------:|
| SUPER_ADMIN | ✅ Proposed menu | ❌ Removed |
| VENUE_OWNER | ✅ | ❌ |
| VENUE_MANAGER | ✅ | ❌ |
| CLUB_OWNER/MGR | ✅ | ❌ |
| REFEREE | Referee zone only | ❌ |
| PLAYER | Player tournament leaves | ❌ Legacy hubs removed |
| CASHIER, COACH, SYS_TECH | ❌ | ❌ |

### B03 — V5 Skill Assessment

| Role | `/player/skill-assessment-v5` | `/player/skill-assessment` |
|------|:-----------------------------:|:--------------------------:|
| SUPER_ADMIN | Direct URL only (no menu) | ✅ Rating program |
| All other roles | ❌ Hidden | ✅ Where applicable |

**PLAYER mobile bottom nav:** Remove `player-skill-assessment-v5` tab in Phase 2.

---

## Role × Level-1 Access Matrix

| Level-1 | SUPER_ADMIN | VENUE_OWNER | VENUE_MANAGER | CASHIER | CLUB_OWNER/MGR | COACH | REFEREE | PLAYER | SYS_TECH |
|---------|:-----------:|:-----------:|:-------------:|:-------:|:--------------:|:-----:|:-------:|:------:|:--------:|
| 01 Tổng quan | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| 02 Vận hành sân | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| 03 Khách hàng & VĐV | ✓ | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ |
| 04 CLB & Huấn luyện | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — |
| 05 Giải đấu | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | — |
| 06 Rating & Xếp hạng | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ |
| 07 Tài chính | ✓ | ✓ | — | ✓ | — | — | — | — | — |
| 08 Báo cáo | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — |
| 09 AI Assistant | ✓* | ✓* | ✓* | — | — | — | — | — | — |
| 10 Thông báo | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| 11 Public Portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 12 Quản trị | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| 13 Hỗ trợ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Flag-gated: `VITE_ENABLE_AI_ENGINE=true`

---

## Private Pairing Rules — RBAC Verdict

| Role | Access |
|------|--------|
| SUPER_ADMIN | ✅ (when flag on) |
| VENUE_OWNER | ❌ |
| VENUE_MANAGER | ❌ |
| CASHIER | ❌ |
| CLUB_OWNER / CLUB_MANAGER | ❌ |
| COACH | ❌ |
| REFEREE | ❌ |
| PLAYER | ❌ |
| SYSTEM_TECHNICIAN | ❌ |

**Status: PASS** — 4-layer gate intact; not in proposed menu for any non-super-admin role.

---

## Proposed Canonical Menu Registry

- **82 routes** with `proposedCanonicalMenu=true`
- **0** duplicate active canonical menu entries
- Desktop + mobile derive from same registry (Phase 2)
- Global search + breadcrumbs use canonical paths only

### Removed from proposed menu (owner binding)

1. `/messages` (B01)
2. All 43 `/tournament/*` legacy hub routes (B02)
3. `/player/skill-assessment-v5` (B03)

### PARTIAL — not generally available

CRM items (5) + `/reports` retain PARTIAL badge in proposed registry until feature complete.

---

## Mobile Bottom Nav — Post-Review Changes (Phase 2)

| Profile | Remove | Keep |
|---------|--------|------|
| `player` | `player-skill-assessment-v5` (B03) | home, schedule, tournament*, QR, skill, profile |
| `manager` | Legacy tournament tab → `/tournament` | Replace with tournament list entry to canonical family |
| `referee` | — | matches, score, results, profile |

\* Tournament tab must resolve to canonical `/tournaments/:id/*` entry point when tournament context is known.

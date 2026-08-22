# Wave 1 Batch 1B — Sidebar / Menu IA Convergence

**PRE_HEAD:** `f921c69141eff58a4904739350c6618d1ea37d6f`  
**Branch:** `feat/web-app-wave1-shell-navigation-01`  
**PR:** #463  

## Objective

Converge duplicate sidebar leaves, Vietnamese label coherence, messaging rollback parity, CASHIER chrome trim, captain null-path decision — **navigation/chrome only**.

## Canonical top-level IA (existing registry — no parallel hierarchy)

Represented via V5/canonical L1 groups (no new L1 invented):

| Owner module | Registry mapping |
|---|---|
| Tổng quan | `dashboard` |
| Vận hành sân | `venue-ops` |
| Khách hàng & VĐV | `customers` |
| CLB & Huấn luyện | `club` |
| Giải đấu | `tournament` |
| Tài chính | `finance` |
| Tổ chức | `tenant` |
| Báo cáo | `reports` |
| Chăm sóc khách hàng | `crm` |
| Trợ lý thông minh | `ai` (feature-flagged) |
| Quản trị | `admin` |
| Tài khoản | `profile` |
| Hỗ trợ | `support` |
| Giao tiếp (Tin nhắn) | `messaging` (distinct from CRM) |

**Structural blocker:** none for representing Owner IA without a second menu tree. Extra L1s (Xếp hạng / Thông báo / Cổng công khai) remain as existing registry nodes where classified — not rewritten in 1B.

## Duplicate destination decisions

| ROUTE | ACTION | Notes |
|---|---|---|
| `/manage/clubs` | KEEP_ONE_CANONICAL_LEAF | Label **Quản lý CLB**; removed Tạo/Quản trị duplicate leaves |
| `/coaching/coaches` vs `/coaching/coach-list` | KEEP_SEPARATE_WITH_REASON | Ops vs PLAYER list — role-gated |
| `/dashboard/rankings` | KEEP_ONE_CANONICAL_LEAF (per role) | Ops: Xếp hạng VPR; platform: Admin › Quản trị VPR; CASHIER excluded |
| `/court-management/courts` | KEEP_ONE_CANONICAL_LEAF | Venue-ops only; admin duplicate removed |
| `/platform/clubs` | KEEP_ONE_CANONICAL_LEAF | CLB › Tất cả CLB only |
| `/support` | KEEP_ONE_CANONICAL_LEAF | Removed captain/tech duplicates |
| `/tournaments` | KEEP_SEPARATE_WITH_REASON | Player vs ops dual-entry (excludeRoles) |
| `/mobile/check-in` | KEEP_SEPARATE_WITH_REASON | Venue Check-in vs captain Điểm danh đội |
| `/players` | KEEP_ONE_CANONICAL_LEAF | Removed tech-zone duplicate |
| `/player/skill-assessment` | KEEP_ONE_CANONICAL_LEAF | Existing customers destination |
| `/messages` vs `/crm/messages` | KEEP_SEPARATE_WITH_REASON | Labels: Tin nhắn / Tin nhắn CRM |

## Messaging parity

- Added `MENU_GROUP_IDS.MESSAGING` to `ROLE_MENU_MAP` for roles with legitimate `/messages` access.
- Added `/messages` to `PUBLIC_MENU_PATHS` so RBAC-on empty route perms still show the leaf (route auth unchanged: `[]`).
- `MESSAGING_ROUTE_AUTH_CHANGED=NO`

## Captain null path

- **PRE:** `resolvePath` → `null` without `tournamentId` (home/my-team/lineup).
- **POST:** home → `/tournament/list` fallback; my-team/lineup remain null (filtered out).
- Messages → `/messages` (not CRM).
- **DECISION:** A (home) + B (hide team/lineup without context).

## CASHIER

- **PRE overexposed chrome:** Check-in, Danh sách chờ, Điều phối sân, Xếp hạng VPR (when RBAC-on + perms).
- **POST:** those leaves `excludeRoles: CASHIER`.
- **AUTH_GAP:** NO (did not change route permission model). RBAC-off still skips `ROLE_MENU_MAP` group filtering (pre-existing Wave 0 behavior — not expanded in 1B).

## Tournament strangler

Hubs preserved. Experience-23 sidebar leaves added: **0**.

## Diff boundary

- `src/config/v5Menu/*`, `navigationConfig.js`, `menuAccess.js` (PUBLIC_MENU_PATHS `/messages` only)
- canonical labels/menu data for Quản lý CLB
- tests + `docs/v5/web-app-experience/wave1/batch-1b/`

`DOMAIN_CODE_CHANGED=NO` · `AUTHORIZATION_CHANGED=NO` (route/permission model) · `TOPBAR_CHANGED=NO`

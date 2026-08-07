# Wave 2 — Whole-Platform Canonical Feature Exposure Parity

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Base:** `b58829d025c804cb1cc2ae7608f5d79f9503e5c5`  
**Starting HEAD:** `40f975fa` (Wave 1 PASS)  
**Scope:** all Level-1 groups except Group 05 (frozen from Wave 1)

## Owner bindings preserved

| Binding | Result |
|---------|--------|
| Wave 1 Tournament promoted targets | 13 PRESERVED |
| B02 route retention | PRESERVED |
| B02 fail-closed hub allowlist | 11 |
| Unapproved legacy Tournament menu exposure | 0 |
| Contextual Engine generic menu exposure | 0 |
| B03 `/player/skill-assessment-v5` | PRESERVED (shadow; not promoted) |
| Public-only portal detail routes | PRESERVED (not forced into auth sidebar) |
| Private Pairing admin restrictions | PRESERVED |
| Invented redirects | 0 |
| RBAC / permissions / feature flags / guards | Reused from existing route inventory |

## Counts

| Metric | Before | After |
|--------|-------:|------:|
| PROPOSED_CANONICAL_NODE_COUNT | 94 | 120 |
| VISIBLE_CANONICAL (ACTIVE_MENU reconcile) | 76 | 102 |
| TOTAL_WAVE2_PROMOTED_FEATURES | — | 26 |
| SAFE_IMPLEMENTED_ADMIN_FEATURE_HIDDEN_WITHOUT_JUSTIFICATION | — | 0 |
| CANONICAL_VALID_FEATURE_WITHOUT_EXPOSURE_DECISION | — | 0 |
| DUPLICATE_CANONICAL_AUTHORITY_COUNT | — | 0 |
| ACCIDENTAL_SHADOW_EXPOSURE_COUNT | — | 0 |
| ACCIDENTAL_DEAD_OR_BROKEN_EXPOSURE_COUNT | — | 0 |

## Per Level-1 summary

| L1 | Group | Previous proposed | Final proposed | Promoted | Notes |
|----|-------|------------------:|---------------:|---------:|-------|
| 01 | Tổng quan | 2 | 2 | 0 | Already complete |
| 02 | Vận hành sân | 8 | 11 | 3 | ops-log, future, qr-generate |
| 03 | Khách hàng & VĐV | 6 | 7 | 1 | customer-groups |
| 04 | CLB & Huấn luyện | 14 | 14 | 0 | Already complete; detail routes contextual |
| 05 | Giải đấu | 20 | 20 | 0 | FROZEN_FROM_WAVE1 |
| 06 | Rating & Xếp hạng | 6 | 6 | 0 | B03 remains shadow |
| 07 | Tài chính | 8 | 12 | 4 | billing root/invoices/usage + marketplace catalog |
| 08 | Báo cáo & Phân tích | 2 | 2 | 0 | Already complete |
| 09 | AI Assistant | 2 | 2 | 0 | Private pairing access unchanged; reject `/dev/*` |
| 10 | Thông báo | 8 | 8 | 0 | Already complete |
| 11 | Public Portal | 6 | 6 | 0 | PUBLIC_ONLY preserved |
| 12 | Quản trị nền tảng | 11 | 27 | 16 | billing/marketplace/integrations admin hubs |
| 13 | Hỗ trợ | 1 | 3 | 2 | FAQ + guide |

### Evidence arithmetic correction (independent review P3)

Independent Wave 2 review found a **documentation-only** Group 12 arithmetic error (`11 → 25` / `promoted=14`).  
**Runtime / source-of-truth remained correct** (`11 → 27` / `promoted=16`; overall still `94 → 120` with `TOTAL_WAVE2_PROMOTED_FEATURES=26`).  
This section and the table above were corrected to match the recomputed Wave1→Wave2 menu diff. No `scripts/`, `src/`, `tests/`, or `CANONICAL_ROUTE_INVENTORY.json` changes were required.

## Promoted routes by group

### 02 Vận hành sân
- `/court-management/ops-log` — Nhật ký vận hành
- `/court-management/future` — Sân tương lai
- `/mobile/qr-generate` — Tạo mã QR

### 03 Khách hàng & VĐV
- `/court-management/customer-groups` — Nhóm khách hàng

### 07 Tài chính
- `/billing` — Thanh toán gói
- `/billing/invoices` — Hóa đơn
- `/billing/usage` — Mức sử dụng
- `/marketplace` — Cửa hàng (`VITE_MARKETPLACE_ENABLED`)

### 12 Quản trị nền tảng
- `/admin/billing`, `/admin/billing/tenants`, `/admin/billing/plans`, `/admin/billing/invoices`, `/admin/billing/payments`, `/admin/billing/audit`
- `/admin/marketplace`, `/admin/marketplace/products`, `/admin/marketplace/orders`
- `/admin/integration-logs`, `/admin/payment-transactions`, `/admin/webhook-events`
- `/admin/api-clients`, `/admin/api-logs` (`VITE_API_ENABLED`)
- `/settings/integrations/payments`, `/settings/integrations/zalo-oa`

### 13 Hỗ trợ
- `/support/faq` — Câu hỏi thường gặp
- `/support/guide` — Hướng dẫn sử dụng

## Rejected promotion candidates (selected)

| Route / family | Disposition | Reason |
|----------------|-------------|--------|
| All Wave 1 Tournament hubs + Engine `/:tournamentId/*` | FROZEN / CONTEXTUAL_ONLY | Wave 1 freeze |
| Remaining `/tournament/*` out-of-menu legacy | HIDDEN_BY_DESIGN (B02) | Fail-closed allowlist only |
| `/player/skill-assessment-v5` | SHADOW | B03 |
| `/`, `/clubs/:publicId`, `/courts/:publicId` | PUBLIC_ONLY | Not auth sidebar |
| `/athletes/:playerId`, `/players/profile/:playerId`, `/manage/clubs/:clubId`, `/marketplace/:productId` | CONTEXTUAL_ONLY | Detail params |
| `/billing/support` | HIDDEN_BY_DESIGN | Overlaps Support; avoid duplicate authority |
| `/dev/pairing-intervention-preview`, `/court-management/calendar/preview` | HIDDEN_BY_DESIGN | Dev/preview unsafe |
| Auth `/login`…`/403`, `/coming-soon/:moduleKey`, `/internal/*` | HIDDEN_BY_DESIGN | System/technical |
| Legacy redirects (`/courts-ops`, `/clubs/discover`, …) | DEAD / REDIRECT | Not hubs |

## Source-of-truth chain

1. `scripts/generate-canonical-nav-inventory.mjs` — `WAVE2_CANONICAL_HUB_MENU_ALLOWLIST`
2. `docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.json` — regenerated
3. `scripts/apply-wave2-canonical-menu-nodes.mjs` — menu node insertion
4. `src/features/canonical-shell/config/canonicalMenuData.js` — 120 nodes
5. `scripts/generate-canonical-menu-phase3.mjs` — catalog sync + PARTIAL/contextual patches
6. `src/features/canonical-shell/config/canonicalRouteCatalog.js` — regenerated

`GENERATED_ARTIFACT_DRIFT=0` (menu/catalog/inventory proposed counts all 120).

## Verification evidence

| Gate | Result |
|------|--------|
| Wave 1 focused tests | 3/3 PASS |
| Wave 2 focused tests | 8/8 PASS |
| Canonical-shell phase3/4 (incl. B03) | PASS |
| Scoped ESLint on changed runtime/scripts/tests | PASS |
| `npm run build` / `lint:no-new` | PASS |
| WAVE2_NEW_LINT_ERRORS | 0 |
| Full-repo ESLint | Pre-existing unrelated baseline; not remediated |

## Safety

| Gate | Value |
|------|-------|
| Production / Vercel / SQL / auth / data mutations | NO |
| Push / PR / cleanup | NO |
| Route authority rewrite / invented redirects | NO |
| Whole-platform localization (Wave 3) | NOT DONE |
| Topbar remediation | NOT DONE |

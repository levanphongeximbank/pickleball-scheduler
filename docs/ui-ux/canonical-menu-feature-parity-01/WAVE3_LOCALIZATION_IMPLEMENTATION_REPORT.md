# Wave 3 — Whole-canonical Vietnamese UI normalization

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Starting HEAD:** `140b9aca` (Wave 2 evidence correction)  
**Scope:** GAP-02 localization + GAP-03 technical text leakage  
**Topbar layout remediation:** NOT DONE (Wave 4)

## Gates

| Gate | Value |
|------|------:|
| VISIBLE_USER_UI_VIETNAMESE_COVERAGE | 100% |
| UNAPPROVED_ENGLISH_CANONICAL_LABEL_COUNT | 0 |
| USER_VISIBLE_BAD_TECHNICAL_CODE_COUNT | 0 |
| USER_VISIBLE_BAD_REMAINING | 0 |
| PROPOSED_CANONICAL_NODE_COUNT | 120 |
| WAVE1_TOURNAMENT_TARGET_COUNT | 13 |
| B02_FAIL_CLOSED_ALLOWLIST_COUNT | 11 |
| B03_PRESERVED | YES |
| DUPLICATE_CANONICAL_AUTHORITY_COUNT | 0 |
| GENERATED_ARTIFACT_DRIFT | 0 |

## Source of truth

1. `src/features/canonical-shell/config/canonicalVietnameseLabels.js` — label maps + technical reason messages  
2. `scripts/apply-wave3-canonical-vietnamese-labels.mjs` — applies labels into `canonicalMenuData.js` without changing authority  
3. `scripts/generate-canonical-nav-inventory.mjs` — Level-1 Vietnamese labels  
4. `scripts/generate-canonical-menu-phase3.mjs` — badge label `Một phần` (was `PARTIAL`)

## Coverage

| Metric | Count |
|--------|------:|
| VISIBLE_CANONICAL_LABEL_COUNT | 379 |
| VIETNAMESE_CANONICAL_LABEL_COUNT | 379 |
| Coverage | 100% |

(Count = 13 Level-1 + 120×(label+level1Label+level2Label) + 6 partial badges.)

## Approved untranslated terms

`PICK_VN`, `AI`, `VPR`, `VPL`, `VPT`, `VPC`, `Zalo OA`, plus product/acronym exemptions where kept in context: `API`, `CRM`, `QR`, `CLB`, `Check-in`.

## Tenant / venue terminology

| Term | User-visible |
|------|----------------|
| Tenant | **Tổ chức** (selector: **Chọn tổ chức…**) |
| Tenant management | **Quản lý tổ chức** |
| Venue | **Sân** |

## Representative label changes

| Route / surface | Before | After |
|-----------------|--------|-------|
| L1 09 | AI Assistant | Trợ lý AI |
| L1 11 | Public Portal | Cổng công khai |
| L1 06 | Rating & Xếp hạng | Xếp hạng |
| `/players` | Staff Directory | Danh sách nhân sự |
| `/admin/tenants` | Manage Tenants | Quản lý tổ chức |
| `/audit` | Activity Log | Nhật ký kiểm tra |
| `/admin/ai-pairing/private-rules` L2 | Private Pairing Rules | Quy tắc ghép cặp riêng |
| `/admin/hours` L2 | Venue Config | Cấu hình sân |
| `/court-management/bookings` | Manage Bookings | Quản lý đặt sân |
| `/reports` | Reports Hub | Trung tâm báo cáo |
| `/ai` | Assistant | Trợ lý AI |
| `/referee` | Hub | Trọng tài |
| Badge PARTIAL | PARTIAL | Một phần |
| Sidebar chip | Figure 1 | Chuẩn |
| Mobile drawer root | Menu | Điều hướng |
| TenantSwitcher | Chọn tenant… | Chọn tổ chức… |

Full route overrides live in `ROUTE_VIETNAMESE_LABELS` / `LEVEL2_VIETNAMESE_LABELS`.

## Technical codes

| Code | Classification | User rendering |
|------|----------------|----------------|
| `dashboard_no_live_rows` | INTERNAL_ONLY (logic) / fixed BAD UI | Chưa có dữ liệu trực tiếp để hiển thị. |
| Other snake_case provenance reasons | INTERNAL_ONLY → mapped | `getTechnicalReasonUserMessage()` |
| Unmapped snake_case | fail-closed message | Không thể hiển thị chi tiết kỹ thuật… |

Fixed render paths:

- `ReportingSourceStateBadge.jsx`
- `DashboardEmptyState.jsx` (`DashboardUnavailableState`)
- `ReportsWorkspacePage.jsx`

Internal `fallbackReason: "dashboard_no_live_rows"` retained in `dashboardService.js`.

## Preservation

- Wave 1 tournament targets: 13  
- Wave 2 proposed nodes: 120  
- B02 allowlist: 11; unapproved legacy: 0  
- B03 shadow: not in menu  
- Private pairing roles/flags/guards unchanged  
- RBAC / permissions / feature flags / route guards: presentation-only changes  

## Verification

| Gate | Result |
|------|--------|
| Wave1 + Wave2 + Wave3 + phase3/4 tests | PASS |
| Scoped ESLint | PASS |
| WAVE3_NEW_LINT_ERRORS | 0 |
| `npm run build` / lint:no-new | PASS |

## Safety

Production / Vercel / SQL / auth / data mutations: **NO**  
Push / PR: **NO**

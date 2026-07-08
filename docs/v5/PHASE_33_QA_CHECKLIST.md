# Phase 33 — Chủ sân RBAC + Profile Menu QA

**Mục tiêu:** `TENANT_OWNER` tùy chỉnh quyền nhân viên, route guard đúng, menu Hồ sơ hiển thị trên desktop.

**Tiên quyết**

- [ ] `VITE_RBAC_ENABLED=true`
- [ ] SQL Phase 33 đã apply: `npm run verify:phase33-tenant-owner-rbac-staging`
- [ ] User test: `VENUE_OWNER` / `COURT_OWNER` trên staging

---

## A. Database (staging)

| # | Bước | Kỳ vọng |
|---|------|---------|
| A1 | `npm run verify:phase33-tenant-owner-rbac-staging` | Tất cả ✅ |
| A2 | `permissions.tenant.role.customize` | Có row |
| A3 | `role_permissions` VENUE_OWNER + COURT_OWNER | Có quyền customize |

## B. Chủ sân — Vai trò & Quyền

| # | Bước | Kỳ vọng |
|---|------|---------|
| B1 | Menu **Quản trị → Vai trò & Quyền** | Vào `/admin/roles` |
| B2 | Dropdown role | Chỉ nhân viên (Quản lý sân, Thu ngân, VĐV…) — không có Platform Admin |
| B3 | Sửa quyền `VENUE_MANAGER` → Lưu | OK |
| B4 | Gõ URL `/admin/tenants` | **403** |

## C. Chủ sân — Menu Hồ sơ (desktop)

| # | Bước | Kỳ vọng |
|---|------|---------|
| C1 | Sidebar — mục **Hồ sơ của tôi** | Hiện cùng cấp menu chính |
| C2 | Chân sidebar — nút **Hồ sơ của tôi** | Luôn thấy khi đăng nhập |
| C3 | Header — avatar → **Hồ sơ** | Vào `/profile` |
| C4 | Trang `/profile` | Load thông tin user |

## D. Chủ sân — Vận hành

| # | Bước | Kỳ vọng |
|---|------|---------|
| D1 | `/mobile/operations` (nếu test mobile) | Mode **owner** |
| D2 | Marketplace admin (nếu bật flag) | Vào được |
| D3 | `/users` | Vào được (`user.manage`) |
| D4 | `/billing/*` | Xem được, không mark paid |

## E. Regression

| # | Bước | Kỳ vọng |
|---|------|---------|
| E1 | `npm run test:unit` — `rbac.test.js` | Pass |
| E2 | `tests/tenant-role-permissions.test.js` | Pass |
| E3 | PLAYER không thấy `/admin/roles` | 403 |

---

**SQL:** [`PHASE_33_TENANT_ROLE_CUSTOMIZE.sql`](PHASE_33_TENANT_ROLE_CUSTOMIZE.sql)  
**Ma trận:** [`docs/RBAC-MATRIX.md`](../RBAC-MATRIX.md)

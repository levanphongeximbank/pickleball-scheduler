# RBAC Permission Matrix — V5.2

Ma trận quyền production. Nguồn code: `src/features/identity/matrix/rolePermissions.js`, `src/features/identity/constants/permissions.js` (re-export qua `src/auth/`).

> **Club governance vs Auth roles (V5):** RBAC roles (`CLUB_MANAGER`, `TENANT_OWNER`, …) kiểm soát đăng nhập và route. Quy tắc nghiệp vụ CLB (Chủ sở hữu, Chủ tịch, …) — **spec v1.1** tại [`docs/v5/CLUB_GOVERNANCE_SPEC.md`](v5/CLUB_GOVERNANCE_SPEC.md). Enforced trong `src/features/club/`.

## Roles (canonical app)

| Canonical (runtime) | DB legacy (`profiles.role`) | Tên hiển thị | Phạm vi |
|---------------------|----------------------------|--------------|---------|
| `PLATFORM_ADMIN` | `SUPER_ADMIN` | Quản trị nền tảng | Toàn hệ thống |
| `SYSTEM_TECHNICIAN` | — | Kỹ thuật viên hệ thống | Platform (giới hạn) |
| `TENANT_OWNER` | `VENUE_OWNER`, `COURT_OWNER` | Chủ đơn vị / Chủ sân | Tenant / venue |
| `VENUE_MANAGER` | `VENUE_MANAGER`, `COURT_MANAGER` | Quản lý sân | Vận hành venue |
| `CLUB_MANAGER` | `CLUB_OWNER` | Quản lý CLB | CLB trong venue |
| `PLAYER` | `PLAYER` | VĐV | Self-service |
| … | … | Xem `src/features/identity/constants/roles.js` | |

`normalizeRole()` khi đọc profile; `denormalizeRoleForDb()` khi ghi (`TENANT_OWNER` → `VENUE_OWNER`).

## Chủ tịch CLB (`CLUB_MANAGER`)

Auth legacy: `CLUB_OWNER`. Phạm vi: `profiles.club_id` — một CLB được gán.

### Quyền auth mặc định

`club.view/update`, `season.update`, `league.update`, `player.view/create/update/delete`, `skill_level.view_private`, `skill_level.verify_club`, `tournament.*`, `director.use`, `match.update`, `scheduling.view/run`, `court_engine.*`, `statistics.view/export`, `settings.view`, `marketplace.view`, `integration.view`, team-tournament permissions.

**Không có:** `club.delete`, `club.create` (RBAC), `customer.view`, `court.view`, `booking.*`, `finance.*`, `user.manage`, `ranking.view`, `billing.view`.

**Ngoại lệ governance:** `CLUB_MANAGER` chưa có `club_id` có thể **tự đăng ký CLB** qua `/my-club` (`canSelfRegisterClub` → `pending_approval`). Quyền xóa/chuyển sở hữu/chủ tịch theo `ownerUserId` — xem bảng governance bên dưới.

### Quyền governance (ngoài RBAC)

| Hành động | Chủ tịch | Chủ sở hữu CLB (`ownerUserId`) | Chủ sân |
|-----------|:--------:|:------------------------------:|:-------:|
| Xem/sửa thành viên đầy đủ | ✓ | ✓ | Chỉ khi là owner |
| Đổi Chủ tịch | ✗ | ✓ | ✓ |
| Xóa CLB | ✗ | ✓ (`canDeleteClub`) | ✓ (`club.delete`) |
| Gán Chủ sở hữu (lần đầu) | ✗ | ✗ | ✓ |
| Chuyển quyền sở hữu | ✗ | ✓ (`transferClubOwnership`) | ✓ |

Enforced: `src/features/club/services/clubGovernanceService.js` (`canChangeClubPresident`, `canDeleteClub`, `transferClubOwnership`).

### Menu sidebar

Nhóm: Tổng quan, Khách hàng & VĐV (VĐV + điểm trình độ), CLB & Huấn luyện (**Lịch sinh hoạt** `/club`, **CLB của tôi** `/my-club`, Danh sách CLB, Vui chơi mỗi ngày), Giải đấu, Hỗ trợ (Hồ sơ).

**Không có:** Vận hành sân, Tài chính, Báo cáo, Quản trị.

Home mặc định: `/club`.

## Chủ sân (`TENANT_OWNER`)

### Quyền vận hành (`VENUE_OPS` — dùng chung với `VENUE_MANAGER`)

`venue.view`, `court.view/create/update`, `booking.view/create/update`, `customer.view`, `finance.view`, `club.view`, `player.view*`, `skill_level.view_private`, `tournament.view/create/update`, `director.use`, `match.update`, `scheduling.view/run`, `court_engine.*`, `statistics.view`, `settings.view`, `ranking.view`, team-tournament permissions.

### Quyền riêng chủ sân

`venue.update`, `user.manage`, `tenant.role.customize`, `subscription.view`, `billing.view` (+ invoice/payment/subscription view), `finance.edit`, `club.create/update/delete`, `club.governance.assign_owner`, `club.governance.approve`, `season.update`, `league.update`, `player.create/update/delete`, `court.delete`, `booking.delete`, `customer.create/update/delete`, `tournament.delete`, `statistics.export`, `system.setting`, `integration.view/manage`, `marketplace.view/manage`, `api.manage`.

### Không có (platform / ngoài phạm vi)

| Quyền | Hệ quả |
|-------|--------|
| `role.manage`, `role.view`, `permission.view` | Không quản lý role platform |
| `tenant.view`, `cluster.manage` | Không quản lý tenant/cụm toàn hệ thống |
| `billing.manage`, `subscription.update` | Billing chỉ xem |
| `ranking.manage`, `tournament.certify` | Không duyệt VPR |
| `skill_level.approve` | Không duyệt trình độ platform |

### Tùy chỉnh quyền nhân viên

- Permission: `tenant.role.customize` (chỉ `TENANT_OWNER`).
- Route: `/admin/roles` (OR với `role.manage` cho platform).
- Chỉ sửa các role trong `TENANT_CUSTOMIZABLE_ROLES` (`VENUE_MANAGER`, `CASHIER`, `PLAYER`, …).
- Ma trận `TENANT_OWNER` read-only — không tự bớt quyền mình.
- Override lưu qua `tenantRolePermissionService` → `rbac.roleHasEffectivePermission()`.

## Court clusters (Phase 32)

| Permission | TENANT_OWNER | VENUE_MANAGER |
|------------|--------------|---------------|
| `cluster.view` | — | — |
| `cluster.manage` | — | — |

Chủ sân vận hành sân trên cụm được gán; không tạo/sửa cụm (`/admin/court-clusters`).

## Route guards (chủ sân)

| Route | Truy cập |
|-------|----------|
| `/admin/roles` | ✓ (`tenant.role.customize`) |
| `/admin/tenants` | ✗ (cần `tenant.view` — platform only) |
| `/users` | ✓ (`user.manage`) |
| `/billing/*` | ✓ (view) |
| `/marketplace/*` | ✓ (`marketplace.manage`) |

## Enforcement points (client)

| Layer | File |
|-------|------|
| Route | `RouteAccessGate.jsx` + `menuAccess.js` |
| Sidebar | `filterMenuGroups()` |
| UI action | `PermissionGate.jsx` |
| Domain | `guardAction.js` |
| Tenant overrides | `tenantRolePermissionService.js` → `rbac.roleHasEffectivePermission()` |

## Bật RBAC production

### Env

```env
VITE_RBAC_ENABLED=true
```

### SQL

Chạy theo checklist: `docs/SUPABASE-STAGING-CHECKLIST.md`, `docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql`.

### Admin đầu tiên

```sql
update public.profiles
set role = 'SUPER_ADMIN', status = 'active'
where email = 'admin@yourdomain.com';
```

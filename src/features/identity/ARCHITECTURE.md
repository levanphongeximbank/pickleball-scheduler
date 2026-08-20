# Identity & Permission — v4.0 Sprint 1 Phase A

**Trạng thái:** Foundation hoàn tất — chờ review trước Phase B (Auth flows UI).

## Mục tiêu Phase A

1. Module `src/features/identity/` — source of truth roles/permissions/matrix.
2. Refactor permission sang CRUD (`player.view`, `court.create`, …) — không alias legacy.
3. Role alias `VENUE_*` ↔ `COURT_*` trong app layer (DB giữ nguyên).
4. `REFEREE` là RBAC role chính thức.
5. SQL additive + rollback script.

## Kiến trúc

```
src/features/identity/
  index.js                      # Public API
  constants/
    permissions.js              # PERMISSIONS (CRUD keys)
    permissionScope.js          # Scope meta + multi-scope OR
    roles.js                    # ROLES, normalizeRole, denormalizeRoleForDb
  matrix/
    rolePermissions.js          # ROLE_PERMISSIONS map (client enforcement)

src/auth/                       # Thin re-export (không phá import cũ)
  permissions.js  → identity
  roles.js        → identity
  rolePermissions.js → identity
  rbac.js         # can() + multi-scope + REFEREE
```

### Luồng authorize (client)

```
User login → profileService (normalizeRole)
          → AuthContext.can(permission, scope)
          → rbac.can()
               ├─ roleHasPermission (matrix)
               └─ matchesScope (venue/club/self/global, OR multi-scope)
```

Khi `VITE_RBAC_ENABLED=false` → mọi `can()` trả `true` (workflow cũ không đổi).

## Role model

| Canonical (app) | Legacy DB | Ghi chú |
|-----------------|-----------|---------|
| `TENANT_OWNER` | `VENUE_OWNER`, `COURT_OWNER` | `normalizeRole()` khi đọc |
| `VENUE_MANAGER` | `VENUE_MANAGER`, `COURT_MANAGER` | `denormalizeRoleForDb()` khi ghi |
| `PLATFORM_ADMIN` | `SUPER_ADMIN` | Alias legacy |
| `CLUB_MANAGER` | `CLUB_OWNER` | Alias legacy |
| `REFEREE` | — | RBAC role chính thức |
| … | … | Xem `roles.js` — `CANONICAL_ROLES` |

**Canonical roles V5.2:** `PLATFORM_ADMIN`, `SYSTEM_TECHNICIAN`, `TENANT_OWNER`, `VENUE_MANAGER`, `TOURNAMENT_MANAGER`, `TEAM_CAPTAIN`, `CASHIER`, `CLUB_MANAGER`, `COACH`, `REFEREE`, `STAFF`, `PLAYER`, `CUSTOMER`, `SUPPORT`.

## Permission catalog

### Core (spec Sprint 1)

| Key | Mô tả |
|-----|-------|
| `player.view/create/update/delete` | Người chơi CLB |
| `court.view/create/update/delete` | Sân venue |
| `tournament.view/create/update/delete` | Giải đấu |
| `match.update` | Ghi điểm trận |
| `director.use` | Director Mode |
| `finance.view/edit` | Doanh thu / kế toán |
| `user.manage` | Quản lý user/staff |
| `role.manage` | Gán role (SUPER_ADMIN) |
| `system.setting` | Cài đặt / cloud sync |

### Domain extensions (app hiện tại)

`club.*`, `season.update`, `league.update`, `booking.*`, `customer.*`, `scheduling.*`, `statistics.*`, `settings.view`, `venue.*`, `subscription.*`

## Role × Permission matrix (tóm tắt)

| Role | Điển hình |
|------|-----------|
| SUPER_ADMIN | Tất cả permissions |
| COURT_OWNER | Venue + club + tournament + finance + user.manage |
| COURT_MANAGER | Vận hành venue, player CRUD, tournament ops |
| CASHIER | booking.create, finance.view/edit (thu ngân) |
| ACCOUNTANT | finance.view/edit, statistics.export |
| REFEREE | tournament.view, match.update |
| CLUB_OWNER | CLB + player + tournament + scheduling |
| PLAYER | tournament.view/create, statistics.view, player self |

Chi tiết code: `matrix/rolePermissions.js`.

## REFEREE vs token `/referee/:token`

- **Phase A:** RBAC role + permission `match.update` đã có trong matrix.
- **Phase B+:** Refactor referee UI để yêu cầu login REFEREE (thay token-only). Route `/referee/:token` giữ tạm cho tương thích.

## File đã tạo (Phase A)

| File |
|------|
| `src/features/identity/index.js` |
| `src/features/identity/constants/permissions.js` |
| `src/features/identity/constants/permissionScope.js` |
| `src/features/identity/constants/roles.js` |
| `src/features/identity/matrix/rolePermissions.js` |
| `src/features/identity/ARCHITECTURE.md` |
| `docs/supabase-identity-v40-sprint1.sql` |
| `docs/supabase-identity-v40-sprint1-rollback.sql` |
| `scripts/migrate-permissions-v40.mjs` |

## File đã sửa (chính)

| File | Thay đổi |
|------|----------|
| `src/auth/permissions.js`, `roles.js`, `rolePermissions.js` | Re-export identity |
| `src/auth/rbac.js` | Multi-scope, REFEREE, normalizeRole |
| `src/auth/menuAccess.js`, `guardAction.js` | CRUD keys |
| `src/auth/profileService.js` | normalize/denormalize role |
| `src/models/user.js` | normalizeRole on save |
| `src/config/sidebarMenu.js` | CRUD + menu REFEREE |
| `src/config/courtManagementTabs.js` | CRUD |
| `src/auth/authService.js` | Dev user REFEREE |
| `src/domain/staffService.js` | INVITABLE + REFEREE |
| ~30 file pages/domain/components | PERMISSIONS.* CRUD |
| `tests/rbac.test.js`, `tests/rls-access.test.js` | Cập nhật keys |

## Migration Supabase (Phase A)

### Thứ tự chạy

1. `docs/supabase-club-v3.sql` (nếu chưa)
2. `docs/supabase-rbac.sql` (nếu chưa)
3. **`docs/supabase-identity-v40-sprint1.sql`**

### Additive changes

- `profiles.phone`, `profiles.avatar_url` (nullable)
- Mở rộng `profiles_role_check` (+ COURT_*, REFEREE; giữ VENUE_*)
- Bảng `roles`, `permissions`, `role_permissions` (seed)
- Bảng `audit_logs` + RLS
- Cập nhật `is_venue_staff()`, `can_read_payment_events()`, policy mời staff

### Rollback

`docs/supabase-identity-v40-sprint1-rollback.sql` — xóa bảng mới, restore constraint/helpers v3.5.7. **Không** xóa `profiles` rows.

### Lưu ý staging

- Rows `profiles.role = 'VENUE_OWNER'` vẫn hợp lệ — app normalize → `COURT_OWNER`.
- Chưa `UPDATE` mass rename role trong DB (theo quyết định Sprint 1).

## Phase B — Auth flows, User Management, Profile, /403, Audit, Referee session

**Trạng thái:** Hoàn tất — build + test pass.

### Routes mới

| Route | Mô tả | Guard |
|-------|-------|-------|
| `/403` | Access Denied | Public (đã login) |
| `/forgot-password` | Quên mật khẩu | Public |
| `/reset-password` | Đặt lại mật khẩu (token) | Public |
| `/profile` | Hồ sơ cá nhân | Authenticated |
| `/users` | Quản lý user | `user.manage` |
| `/referee` | Hub trận được phân công | REFEREE session |
| `/referee/match/:matchId` | Chấm trận (session) | REFEREE + assignment |
| `/referee/:token` | Legacy token RPC | Giữ ngoài MainLayout |

### Services (`src/features/identity/services/`)

| Service | Chức năng |
|---------|-----------|
| `auditService.js` | Ghi/đọc `audit_logs`; strip password/token khỏi metadata |
| `passwordService.js` | Forgot / reset / change password (verify mật khẩu hiện tại) |
| `userManagementService.js` | CRUD user, gán role, khóa/mở, reset password admin |
| `selfProfileService.js` | Xem/sửa hồ sơ bản thân (không đổi role) |
| `refereeSessionService.js` | Danh sách trận phân công + kiểm tra quyền chấm |

### Auth guard

- `authGuard.js`: public paths, authenticated-only, `/403` exempt
- `RouteAccessGate.jsx`: RBAC deny → redirect `/403` (chưa login → `/login`)

### Migration Supabase (Phase B)

**File:** `docs/supabase-identity-v40-phaseB.sql`

- Mở rộng `audit_logs`: `ip_address`, `user_agent`, thêm action values
- Bảng `password_reset_tokens` (token hash, expiry)
- Rollback: `docs/supabase-identity-v40-phaseB-rollback.sql`

### Referee strategy

- **Legacy:** `/referee/:token` — RPC token, không đổi
- **Mới:** Login REFEREE → `/referee` hub → `/referee/match/:id` (token trong `location.state`)
- REFEREE không vào admin / users / system settings

### RBAC safety

`VITE_RBAC_ENABLED=false` (mặc định) → mọi màn cũ hoạt động như trước.

### Tests

`tests/identity-phaseB.test.js` — guards, `/403`, password, audit, user mgmt, profile, referee access.

## Phase C — Server RLS + RPC + Audit UI

**Trạng thái:** Hoàn tất — build + test pass.

### SQL (`docs/supabase-identity-v40-phaseC.sql`)

| Thành phần | Mô tả |
|------------|-------|
| `user_has_permission(text)` | Kiểm tra quyền từ `role_permissions` |
| `identity_list_users` | RPC list user — scope venue, `user.manage` |
| `identity_admin_update_user` | RPC cập nhật user — khóa/mở, không tự nâng role |
| `identity_list_audit_logs` | RPC đọc audit — SUPER_ADMIN hoặc venue admin |
| `profiles_guard_privileged_update` | Venue admin (`user.manage`) khóa/mở user cùng venue |
| `audit_logs_venue_manager_select` | RLS đọc audit cùng venue |

Rollback: `docs/supabase-identity-v40-phaseC-rollback.sql`

### App

| Route | Màn |
|-------|-----|
| `/audit` | Nhật ký hệ thống (USER_MANAGE) |

Services gọi RPC trước, fallback direct query nếu SQL Phase C chưa apply.

## Competition Contract #01 — subject identity point lookup

`services/subjectIdentityLookupService.js` is the Identity-owned read for one canonical `subjectId`.

- Point lookup only. No email / phone / display-name / bulk directory search.
- Returns Competition-safe evidence: canonical subject id, Identity role, active/inactive status, tenant/venue/club scope.
- Does not expose email, phone, password, session, or other private credentials.
- Competition Adapter B translates this service. Competition must not query `public.profiles` directly.
- Persistence (`subjectIdentityPersistence.js`) reads only `id, role, status, tenant_id, venue_id, club_id`. It does not reuse the legacy login profile projection.
- **Tenant is not venue.** `tenantId` comes only from `tenant_id` / `tenantId`. `venueId` comes only from `venue_id` / `venueId`. Missing tenant is `null`; venue is never copied onto tenant, and venue equality is never tenant proof.
- **Status is not synthesized.** Explicit `active` → `active=true`. Explicit `suspended` / `inactive` / `invited` → `active=false`. Missing or unreadable status fails closed as incomplete evidence.
- If origin/main has no canonical `tenant_id` yet, Contract #01 returns `tenantId=null` and fails closed when a consumer requests tenant proof. Same UUID on both fields does not collapse the entities.

### Tests

`tests/identity-phaseC.test.js` — `/audit` guard, audit list permission, user list permission.

## Tenant-aware managed user provisioning

Canonical create contract: `adminCreateManagedUser` via `/api/identity/create-user`.

- `tenantId` and `venueId` are independent. Venue is never copied onto Tenant.
- Allowed initial status: `active` | `suspended` | `invited`. Default remains `active`.
- Target Tenant existence is proven from `public.platform_tenants` before Auth create.
- **Authorization policy:** `PLATFORM_ADMIN` / `SUPER_ADMIN` may create under an existing explicit Tenant. Non-super-admin may target a Tenant only when `platform_tenants.owner_user_id` equals the authenticated actor. `profiles.tenant_id` / `profiles.venue_id` are home/default Identity context, not Tenant operational entitlement. Venue equality is not Tenant authorization. Caller-supplied `actorId` / `actorRole` / `authorizedTenantId` / `permissions` / `tenantMembership` are stripped.
- If profile persistence or Contract #01 post-create evidence fails after Auth create, the command compensates by deleting only the Auth user it just created.
- Suspended users remain canonical subjects with `active=false` under Contract #01.

### Tests

`tests/identity-profile-tenant-mapping.test.js`, `tests/identity-tenant-aware-managed-user-create.test.js`, `tests/identity-managed-password-reset-audit.test.js`.

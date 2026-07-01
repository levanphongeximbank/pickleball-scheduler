# Multi Tenant — Sprint 2

**Trạng thái:** Foundation hoàn tất trên local-first storage.

## Kiến trúc

```
Tenant (tenantId)  ←→  Venue registry (venueId) — cùng storage pickleball-venues-v1
  └── Club(s) (club.venueId / club.tenantId)
        └── Club blob: players, courts, tournaments, bookings, …
              └── Mỗi entity có tenantId (auto-stamp khi save)
```

## Module

```
src/features/tenant/
  index.js
  guards/tenantGuard.js      # assertSameTenant, guardClubTenant, filterByTenant
  services/tenantService.js   # CRUD tenant, stats, bootstrap
  seed/multiTenantSeed.js     # 3 tenant demo + default migration

src/models/tenant.js
src/context/TenantContext.jsx   # useTenant(), useCurrentTenantId()
src/pages/admin/TenantManagement.jsx
src/components/TenantSwitcher.jsx
src/components/TenantGate.jsx
```

## Role alias (Sprint 2 spec ↔ Sprint 1 canonical)

| Sprint 2 | App canonical |
|----------|---------------|
| TENANT_OWNER | COURT_OWNER |
| CLUB_MANAGER | COURT_MANAGER |

## Luồng tenant hiện tại

1. User login → `user.tenantId` (alias `venueId`)
2. SUPER_ADMIN → chọn tenant trên header → lưu `pickleball-active-tenant-v1`
3. `TenantProvider` → `currentTenantId`
4. `ClubProvider` → lọc CLB theo tenant, auto-switch CLB
5. `guardClubAccess` → `guardClubTenant` khi RBAC bật
6. `clubStorage` save* → auto gắn `tenantId`

## QA

`docs/MULTI-TENANT-SPRINT2-CHECKLIST.md`

**Trạng thái:** ✅ Sprint 2 hoàn tất (local-first + RBAC guards + Supabase SQL alias).

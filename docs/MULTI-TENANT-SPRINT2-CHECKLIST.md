# Sprint 2 — Multi Tenant Manual QA Checklist

**Trạng thái:** ✅ Sprint 2 hoàn tất — automated tests pass, build pass.

## Chuẩn bị
1. Chạy app local: `npm run dev`
2. Vào **Cài đặt** → bật **RBAC** (dev panel) hoặc set `VITE_RBAC_ENABLED=true`
3. Seed tự chạy lần đầu mở app (3 tenant demo)

## Dev users

| Email | Role | Tenant |
|-------|------|--------|
| `admin@pickleball.local` | SUPER_ADMIN | Chọn tenant trên header |
| `owner@futurearena.local` | TENANT_OWNER | Future Arena |
| `owner@abc.local` | TENANT_OWNER | ABC Pickleball |
| `owner@elite.local` | TENANT_OWNER | Elite Club |
| `manager@futurearena.local` | CLUB_MANAGER | Future Arena |

## Test 1: Tenant data isolation

- [ ] Login `owner@futurearena.local`
- [ ] Vào **Người chơi**
- [ ] Chỉ thấy ~20 players prefix `future_arena`
- [ ] Không thấy ABC / Elite

## Test 2: Courts isolation

- [ ] Login `owner@abc.local`
- [ ] Vào **Live Courts → Sân**
- [ ] Chỉ thấy 3 sân ABC

## Test 3: Tournament isolation

- [ ] Login `owner@elite.local`
- [ ] Vào **Tạo giải đấu**
- [ ] Chỉ thấy giải của Elite Club

## Test 4: Create data with tenantId

- [ ] Login Future Arena
- [ ] Tạo player mới
- [ ] DevTools → `localStorage` key `pickleball-club-data-v3::club-future-arena`
- [ ] Player mới có `tenantId: "tenant-future-arena"`

## Test 5: Prevent cross-tenant access

- [ ] Login ABC
- [ ] Ghi nhớ player id Future Arena (seed): `future_arena-player-1`
- [ ] Mở URL `/players/profile/future_arena-player-1`
- [ ] Hệ thống báo không tìm thấy / không có quyền

## Test 6: SUPER_ADMIN switch tenant

- [ ] Login `admin@pickleball.local`
- [ ] Header: chọn **Future Arena** → players ~20
- [ ] Chọn **ABC Pickleball** → players ~15
- [ ] Không trộn dữ liệu

## Test 7: Tenant inactive

- [ ] Login SUPER_ADMIN → `/admin/tenants`
- [ ] Khóa **ABC Pickleball**
- [ ] Login `owner@abc.local` → bị chặn (TenantGate)
- [ ] SUPER_ADMIN vẫn thấy ABC trong Tenant Management

## Test 8: Default tenant migration

- [ ] CLB cũ không có `venueId` được gán `default-tenant`
- [ ] Màn hình cũ vẫn hoạt động khi RBAC tắt

## Automated tests

```bash
node --test tests/tenant.test.js   # 11 tests — isolation, tournament, inactive tenant
npm run test:unit
npm run build
```

## Supabase staging (optional)

1. `docs/supabase-rbac.sql` (venues = tenants)
2. `docs/supabase-multi-tenant-sprint2.sql` — view `public.tenants`, status `inactive`
3. Rollback: `docs/supabase-multi-tenant-sprint2-rollback.sql`

## File chính Sprint 2
| Layer | Path |
|-------|------|
| Model | `src/models/tenant.js` |
| Feature | `src/features/tenant/` |
| Context | `src/context/TenantContext.jsx` |
| Admin UI | `src/pages/admin/TenantManagement.jsx` |
| Switcher | `src/components/TenantSwitcher.jsx` |
| Guards | `src/features/tenant/guards/tenantGuard.js`, `src/auth/guardAction.js` |
| Seed | `src/features/tenant/seed/multiTenantSeed.js` |

**Lưu ý:** `tenantId` và `venueId` là alias — storage venue registry (`pickleball-venues-v1`) là source of truth.

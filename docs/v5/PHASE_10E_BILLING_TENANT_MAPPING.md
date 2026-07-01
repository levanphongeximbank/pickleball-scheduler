# Phase 10E — Billing Tenant Mapping Hardening

**Ngày:** 2026-07-01  
**Branch:** `v5-platform-edition`  
**Phạm vi:** `profiles.venue_id` ↔ `venues.id` ↔ `tenant_subscriptions.tenant_id`  
**Không deploy production** — staging SQL + app hardening only

---

## Mapping chuẩn

```
auth.users.id = profiles.id
profiles.venue_id = venues.id          ← tenant nghiệp vụ
tenant_subscriptions.tenant_id = venues.id
RLS billing: profiles.venue_id = row.tenant_id (không dùng bảng tenants riêng)
```

| Layer | Nguồn tenant id |
|-------|-----------------|
| Auth profile | `mapProfileRowToUser` → `tenantId` + `venueId` từ `profiles.venue_id` |
| TenantContext | `resolveEffectiveTenantId(user)` |
| Billing hook | `resolveBillingTenantId({ user, currentTenantId, tenantIdOverride })` |
| Trial RPC | `public.user_venue_id()` hoặc `p_tenant_id` (SUPER_ADMIN) |
| SubscriptionGate | `assertSubscriptionOperational(currentTenantId)` via Phase 9 bridge |

---

## Root cause (browser QA Phase 9/10C)

| Triệu chứng | Nguyên nhân |
|-------------|-------------|
| Owner `/billing`: `no_subscription`, dates `—` | UI fallback **`tenant-demo`** (đã gỡ Phase 9) hoặc `profiles.venue_id` orphan |
| Admin: `tenant_not_found` | RPC `p_tenant_id` không tồn tại trong `venues` |
| Persist warning `tenant_not_found` | Trial RPC check `exists (select 1 from venues where id = v_tenant_id)` fail |
| SubscriptionGate không khóa khi expired | **`subscriptionAccessBridge.createEngine`** thiếu `SubscriptionService` — `getByTenant` luôn undefined |

---

## File đã rà soát

| File | Trạng thái |
|------|------------|
| `src/features/billing/services/billingTenantResolver.js` | ✅ Hardened — blocklist + `sanitizeBillingTenantId` |
| `src/features/billing/services/billingVenueService.js` | ✅ Thêm `validateBillingTenantOnSupabase` |
| `src/features/billing/hooks/useBilling.js` | ✅ Validate venue trước trial RPC |
| `src/features/billing/bridges/subscriptionAccessBridge.js` | ✅ Fix `createEngine` wiring + gate codes |
| `src/features/billing/services/billingTrialRpc.js` | ✅ OK — map `tenant_not_found` |
| `src/pages/admin/AdminBillingPage.jsx` | ✅ OK — list `venues` Supabase |
| `src/pages/billing/BillingPage.jsx` | ✅ OK — hiển thị `billingError` / `persistError` |
| `src/components/SubscriptionGate.jsx` | ✅ OK — dùng `subscriptionCheck` |
| `src/context/TenantContext.jsx` | ✅ OK — `currentTenantId` từ profile |
| `src/auth/profileService.js` | ✅ OK — `venue_id` → `tenantId` |
| `docs/supabase-billing-phase9-trial-rpc.sql` | ✅ OK — `tenant_not_found` guard |
| `scripts/verify-billing-phase9-staging.mjs` | ✅ Existing |
| `scripts/verify-billing-tenant-mapping-staging.mjs` | ✅ **Mới Phase 10E** |

**Không còn `tenant-demo` trong source app** (chỉ docs/tests blocklist).

---

## Fix đã làm (Phase 10E)

1. **`sanitizeBillingTenantId`** — reject empty + blocklist (`tenant-demo`, `tenant_demo`, `demo-tenant`)
2. **`resolveBillingTenantId`** — dùng sanitize trên mọi nguồn
3. **`validateBillingTenantOnSupabase`** — probe `venues` trước hydrate/trial RPC
4. **`useBilling`** — fail fast với message rõ thay vì RPC opaque error
5. **`subscriptionAccessBridge.createEngine`** — wire `SubscriptionService` / `InvoiceService` / `PaymentService` (fix SubscriptionGate)
6. **`assertSubscriptionOperational`** — codes: `NO_TENANT`, `NO_SUBSCRIPTION`, `SUBSCRIPTION_OK`
7. **Tests** — `tests/billing-tenant-mapping.test.js` (10 tests)
8. **Staging SQL** — `docs/supabase-billing-phase10e-staging-tenant-align.sql`
9. **Verify script** — `scripts/verify-billing-tenant-mapping-staging.mjs`

---

## SQL / staging data

### Apply trên Supabase staging (manual)

```text
docs/supabase-billing-phase10e-staging-tenant-align.sql
```

- Diagnostic profiles ↔ venues
- Seed `venue-staging-a`, `venue-staging-b`
- Align `owner@staging.local`, `manager@`, `club@`, `player@`
- Gỡ legacy `tenant-demo` trên profiles
- Rollback note trong file

### Verify sau apply

```bash
node scripts/verify-billing-tenant-mapping-staging.mjs
# Khuyến nghị: SUPABASE_SERVICE_ROLE_KEY trong .env.local để check profiles
```

---

## Test evidence

| Lệnh | Kết quả |
|------|---------|
| `npm test` | **641/641 PASS** (631 + 10 mapping) |
| `npm run build` | PASS |
| `npm run lint` | 0 errors |
| `node --test tests/billing-tenant-mapping.test.js` | 10/10 PASS |
| `node scripts/verify-billing-tenant-mapping-staging.mjs` | Chạy được; cần service role + SQL align cho profiles |

### Tests bắt buộc (Phase 10E)

| Test | PASS |
|------|------|
| Resolve tenant từ `profiles.venue_id` / user | ✅ |
| Không fallback `tenant-demo` | ✅ |
| `validateBillingTenantOnSupabase` TENANT_NOT_FOUND | ✅ |
| SubscriptionGate: no subscription → app allowed | ✅ |
| SubscriptionGate: expired → blocked | ✅ |
| Trialing subscription → allowed | ✅ |
| Trial RPC merge (existing test) | ✅ |

---

## Ảnh hưởng cross-module

| Module | Ảnh hưởng |
|--------|-----------|
| RBAC | Không đổi permissions |
| RLS | Không đổi SQL — vẫn `profiles.venue_id` |
| Court Engine | **Không** |
| Mobile | **Không** — SubscriptionGate fix gián tiếp (expired lock đúng hơn) |
| Payment thật | **Không** — mock/manual only |

---

## Rủi ro còn lại

| Rủi ro | Mức | Mitigation |
|--------|-----|------------|
| Staging profiles chưa align | P1 | Chạy SQL Phase 10E trên staging |
| Cross-tenant RLS manual | P1 | Phase 10D |
| Supabase anon không đọc venues (RLS) | P2 | Owner JWT + service role verify |
| Browser QA owner/admin billing | P2 | Checklist dưới |

---

## QA checklist staging browser

Sau apply SQL + redeploy Preview:

- [ ] Login `owner@staging.local` → `/billing` — thấy trial dates, không `tenant_not_found`
- [ ] DevTools: `tenantId` chip / network không gửi `tenant-demo`
- [ ] Admin `/admin/billing` — list venues từ Supabase, chọn `venue-staging-a`
- [ ] Nút **Tạo trial** nếu chưa có subscription → RPC OK
- [ ] SubscriptionGate: tenant expired → lock UI (non-SUPER_ADMIN)
- [ ] `node scripts/verify-billing-tenant-mapping-staging.mjs` — 0 orphan profiles

---

## Kết luận

Phase 10E **code hardening hoàn tất**. Staging cần **apply SQL align** + **browser re-QA** trước khi đóng billing gate. Tiếp theo: **Phase 10D** cross-tenant RLS manual.

---

## Tham chiếu

- `docs/v5/PHASE_9_STAGING_BILLING_APPLY.md`
- `docs/v5/PHASE_10C_STAGING_REGRESSION_QA.md`
- `docs/STAGING-APPLY-QA-v358.md` §1.6–1.7

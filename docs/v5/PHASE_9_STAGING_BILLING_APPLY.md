# Phase 9 Billing — Staging Apply Guide

**Migration:** `docs/supabase-billing-phase9.sql`  
**Rollback:** `docs/supabase-billing-phase9-rollback.sql`  
**Không apply production** cho đến khi Phase 10 QA hoàn tất.

---

## Prerequisites

Apply **trước** billing migration (đã có trên staging):

1. `docs/supabase-rbac-v4.sql` (hoặc RBAC sprint tương đương)
2. `docs/supabase-multi-tenant-sprint2.sql`
3. `public.is_super_admin()` function tồn tại
4. Bảng `public.venues` và `public.profiles` có dữ liệu tenant

---

## Apply order

```sql
-- 1. Backup (khuyến nghị)
-- Supabase Dashboard → Database → Backups

-- 2. Apply migration
-- Paste toàn bộ docs/supabase-billing-phase9.sql vào SQL Editor → Run
```

Migration idempotent: `create table if not exists`, `on conflict do nothing` cho seed plans/limits.

---

## Post-apply verification

```sql
-- Tables exist
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans','plan_limits','tenant_subscriptions','invoices',
    'invoice_items','payments','billing_events','billing_audit_logs'
  )
order by 1;

-- Seed plans (expect 4 rows)
select code, name, price_monthly from public.plans order by sort_order;

-- Seed plan_limits (expect 4 rows)
select plan_id, max_courts, max_players from public.plan_limits;

-- RLS enabled
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename like '%plan%' or tablename like '%billing%' or tablename like '%invoice%' or tablename like '%payment%'
order by 1;
```

Expected: 8 tables, 4 plans, 4 plan_limits, `rowsecurity = true` on all billing tables.

---

## RLS cross-tenant smoke (manual)

Chạy với 2 user staging (SUPER_ADMIN + COURT_OWNER tenant A):

| Check | SUPER_ADMIN | COURT_OWNER (tenant A) | COURT_OWNER (tenant B data) |
|-------|-------------|------------------------|----------------------------|
| `select * from plans` | ✅ all | ✅ active plans | ✅ active plans |
| `select * from tenant_subscriptions` | ✅ all tenants | ✅ own tenant only | ❌ 0 rows |
| `select * from invoices` | ✅ all | ✅ own tenant only | ❌ 0 rows |
| `select * from payments` | ✅ all | ✅ own tenant only | ❌ 0 rows |
| `insert into tenant_subscriptions` | ✅ | ❌ denied | ❌ denied |
| `update invoices set status='paid'` | ✅ | ❌ denied | ❌ denied |

Chi tiết matrix: `docs/v5/BILLING_RBAC_RLS_MATRIX.md`

---

## Rollback

```sql
-- Chỉ khi cần revert Phase 9 billing trên staging
-- Paste docs/supabase-billing-phase9-rollback.sql → Run
```

Rollback xóa policies + tables billing. **Không** ảnh hưởng `venues`, `profiles`, legacy subscription data.

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `function is_super_admin() does not exist` | RBAC SQL chưa apply | Apply `supabase-rbac-v4.sql` trước |
| FK `venues(id)` violation | Tenant seed thiếu | Đảm bảo venue id tồn tại trước khi insert subscription |
| `duplicate key on plans` | Re-run seed | Safe — `on conflict do nothing` |
| Owner thấy billing tenant khác | RLS chưa enable | `alter table ... enable row level security` |

---

## App env (staging)

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BILLING_SUPABASE=true
# VITE_BILLING_STORE_MODE=supabase  # optional explicit
```

Dev local không có Supabase → `local` fallback (`pickleball-billing-*-v1` keys).

---

## Status

| Item | Status |
|------|--------|
| SQL reviewed | ✅ Phase 9 Final Hardening |
| Staging apply | ✅ Applied 2026-07-01 |
| RLS verification | ✅ Anon blocked (8/8 — authenticated-only policies) |
| Verify script | ✅ `node scripts/verify-billing-phase9-staging.mjs` |

---

## Phase 9 Staging Verification Result

**Ngày gate:** 2026-07-01  
**Người thực hiện:** User (SQL apply + policy review) + Cursor agent (verify script fix + automated gate)  
**Supabase project:** staging (`qyewbxjsiiyufanzcjcq` — từ `.env.local`)

### SQL staging apply

| Item | Kết quả |
|------|---------|
| Đã apply? | ✅ **Đã apply** |
| Ai apply | User (Supabase SQL Editor) |
| Ngày apply | 2026-07-01 |
| Kết quả probe | `verify-billing-phase9-staging.mjs`: **8/8 bảng OK** |
| Pre-apply review | ✅ Idempotent (`create if not exists`, `on conflict do nothing`) |
| FK conflict | ✅ Không — FK trỏ `venues(id)`, `plans(id)` đã có trên staging |
| Index conflict | ✅ `create index if not exists` |
| Policy name conflict | ✅ `drop policy if exists` trước `create policy` |
| Rollback khả thi | ✅ `supabase-billing-phase9-rollback.sql` drop 8 tables cascade |

**Policy review (manual SQL Editor):**

- Tất cả policy dùng role `{authenticated}` — không có policy cho `anon`.
- `plan_limits`: `using (true)` nhưng chỉ `to authenticated` — chấp nhận được (catalog public cho user đăng nhập).
- `tenant_subscriptions`: `is_super_admin()` hoặc `tenant_id` khớp `profiles.venue_id`.

**Verify script fix (2026-07-01):** Script trước đó hiểu nhầm `error: null` + `data: []` là “anon đọc được dữ liệu”. Đã sửa: empty result = anon bị chặn (RLS authenticated-only); chỉ cảnh báo khi `data.length > 0`.

### RLS enabled

| Check | Kết quả |
|-------|---------|
| RLS trên 8 bảng | ✅ 8/8 bảng tồn tại trên staging |
| Anon bị chặn | ✅ 8/8 — 0 rows (policy authenticated-only, không leak) |

### Cross-tenant smoke test

| Role | Kết quả |
|------|---------|
| SUPER_ADMIN | ⏳ Manual — đăng nhập Vercel preview, SQL Editor hoặc app DevTools |
| COURT_OWNER / TENANT_OWNER | ⏳ Manual — owner tenant A không thấy invoice/subscription tenant B |
| CASHIER | ✅ Automated RBAC pass (local) — không có billing.view |
| STAFF / REFEREE / PLAYER | ✅ Automated RBAC pass (local) |
| Cross-tenant isolation (service layer) | ✅ `billing-phase9.test.js` — invoice filter by tenant_id |
| Cross-tenant isolation (RLS anon) | ✅ 8/8 bảng anon blocked (`verify-billing-phase9-staging.mjs`) |
| Cross-tenant isolation (RLS authenticated) | ⏳ Manual — 2 user JWT (owner A vs data tenant B) |

### Owner / Admin billing flow

| Flow | Kết quả |
|------|---------|
| Owner `/billing/*` (7 routes) | ✅ Code gate — router + `BillingAccessGate(BILLING_VIEW)` + RBAC |
| Admin `/admin/billing/*` (6 routes) | ✅ Code gate — `BillingAccessGate(BILLING_MANAGE)` + SUPER_ADMIN RBAC |
| Owner UI trên Vercel preview | ⏳ Manual — đăng nhập COURT_OWNER, mở 7 tab billing |
| Admin UI trên Vercel preview | ⏳ Manual — đăng nhập SUPER_ADMIN, suspend/unlock/mark paid |
| Manual payment → Supabase | ⏳ Manual — cần `hydrate`/`persist` wired (xem bridge gap) |
| Mark invoice paid | ⏳ Manual admin flow trên preview |
| Suspend/unlock tenant | ⏳ Manual admin flow trên preview |
| Tenant lock QA | ✅ Automated `TenantAccessService` pass (local) |

### Supabase repository bridge

| Check | Kết quả |
|-------|---------|
| `VITE_BILLING_SUPABASE=true` trên Vercel Preview | ✅ User bật + redeploy (2026-07-01) |
| `resolveBillingStoreMode()` → supabase | ✅ Khi flag + `VITE_SUPABASE_*` có trong build |
| `createBillingStore()` → `store.mode === "supabase"` | ✅ Verified runtime probe |
| `hydrateAll()` runtime | ✅ `useBilling` + `getBillingStore()` → `ensureBillingStoreHydrated()` |
| `persistCollection()` runtime | ✅ `useBilling.persistChanges()` + `billingStoreUtils.writeCollection` dirty tracking |
| UI không gọi localStorage trực tiếp | ✅ Verified — qua `getBillingStore()` |

### Supabase hydrate/persist runtime wiring (2026-07-01)

| Layer | Vị trí | Hành vi |
|-------|--------|---------|
| Hydrate kickoff | `getBillingStore()` | Supabase singleton gọi `ensureBillingStoreHydrated()` nền |
| Hydrate await | `useBilling` bootstrap `useEffect` | `hydrateAll()` 8 collections + `billingLoading` / `billingError` |
| Persist mutations | `useBilling.runMutation()` | Owner/Admin actions → `persistBillingCollections(BILLING_PERSIST_SETS.*)` |
| Persist maintenance | `subscriptionAccessBridge.runSubscriptionMaintenance` | Flush `subscriptions` khi status đổi |
| Row mapping | `billingRowMap.js` | `plan_code` ↔ `plan_id` khi hydrate/upsert |
| Seed skip | `BillingEngine.seedDefaults()` | Bỏ qua khi `store.mode === "supabase"` (plans từ DB) |
| Fallback local | `VITE_BILLING_SUPABASE=false` hoặc thiếu env | `localStorage` store + `seedDefaults()` |
| Fallback test | `NODE_ENV=test` | `memory` store + `seedDefaults()` |

**Tests:** `tests/billing-repository-runtime.test.js` (10 tests) — hydrate, persist, RPC trial, fallback.

### Trial subscription onboarding (quyết định Phase 9)

| Phương án | Mô tả | Trạng thái |
|-----------|--------|------------|
| **A** | SUPER_ADMIN/onboarding tạo tenant + trial khi provision | ✅ Khuyến nghị cho tenant mới; owner chỉ đọc |
| **B** | RPC `billing_create_trial_subscription` — owner-safe, TRIAL only | ✅ **Đã implement** — SQL + `billingTrialRpc.js` + `useBilling` |

**SQL patch (apply staging):** `docs/supabase-billing-phase9-trial-rpc.sql`  
**Rollback:** `docs/supabase-billing-phase9-trial-rpc-rollback.sql`

RPC rules:
- Chỉ `COURT_OWNER` / `VENUE_OWNER` / `CLUB_OWNER` hoặc `SUPER_ADMIN`
- Idempotent — trả subscription hiện có nếu đã có
- Chỉ plan `plan-TRIAL`, status `trialing`, trial 14 ngày
- Không cho owner chọn status/plan khác
- Ghi `billing_audit_logs` + `billing_events`
- Frontend **không** insert trực tiếp `tenant_subscriptions`

**Pre-GA:** Apply trial RPC SQL trên staging trước Owner browser QA.

### Local verification (automated gate — 2026-07-01)

| Command | Kết quả |
|---------|---------|
| `node scripts/verify-billing-phase9-staging.mjs` | ✅ 8/8 tables + 8/8 anon blocked |
| `node scripts/verify-billing-cross-tenant-staging.mjs` | ⏳ Cần `STAGING_OWNER_A/B_*` creds (hoặc manual) |
| `node --test tests/billing-phase9.test.js` | ✅ 14/14 |
| `node --test tests/billing-repository-runtime.test.js` | ✅ 10/10 |
| `npm test` | ✅ 616/616 |
| `npm run lint` | ✅ 0 errors |
| `npm run build` | ✅ PASS |

---

## Phase 9 Final Browser QA Result

**Ngày gate:** 2026-07-01  
**Người thực hiện:** Cursor agent (automated) + User (browser manual pending)

### Vercel Preview / Staging

| Item | Kết quả |
|------|---------|
| Code hydrate/persist + trial RPC | ✅ Trong repo |
| Redeploy Preview sau merge | ⏳ **User action** — redeploy branch có code mới |
| `VITE_BILLING_SUPABASE=true` | ✅ User đã bật (session trước) |
| `VITE_SUPABASE_URL` / `ANON_KEY` staging | ✅ `.env.local` → project `qyewbxjsiiyufanzcjcq` |
| Preview URL | ⏳ Lấy từ Vercel Dashboard → Deployments → Preview |
| Supabase mode trên preview | ⏳ Xác nhận sau redeploy: DevTools → `store.mode === "supabase"` |
| Trial RPC SQL applied | ✅ `verify-billing-phase9-staging.mjs` — RPC tồn tại (anon → `not_authenticated`) |

### Root cause browser QA fail (2026-07-01 — tenant-demo)

| Triệu chứng | Nguyên nhân | Fix code |
|-------------|-------------|----------|
| Owner: `no_subscription`, dates `—`, persist `tenant_not_found` | `useBilling` fallback `tenant-demo` không tồn tại trong `venues` | ✅ `resolveBillingTenantId()` — không hard-code |
| Admin: `tenant_not_found`, Tenant Detail `tenant-demo` | `AdminBillingPage` fallback `tenant-demo`; list chỉ từ subscriptions rỗng | ✅ List `venues` từ Supabase + nút **Tạo trial** |
| RPC fail dù SQL đã apply | `p_tenant_id = 'tenant-demo'` ≠ `profiles.venue_id` | ✅ Dùng `venue_id` thật từ profile / TenantContext |

**Mapping chuẩn Phase 9:** `tenant_subscriptions.tenant_id` = `venues.id` = `profiles.venue_id` (RLS so sánh `profiles.venue_id`).

**Verify alignment (SQL Editor):**

```sql
select p.email, p.role, p.venue_id, v.name
from public.profiles p
left join public.venues v on v.id = p.venue_id;
```

Nếu `venue_id` null hoặc không khớp `venues.id` → owner không tạo được trial. Tham chiếu seed: `docs/supabase-billing-phase9-staging-seed-minimal.sql`.

### Owner `/billing/*` (COURT_OWNER)

| Route | Automated code gate | Browser QA |
|-------|---------------------|------------|
| `/billing` | ✅ RBAC + hydrate + tenant resolver | ⏳ Re-QA sau redeploy |
| `/billing/current-plan` | ✅ | ⏳ Manual |
| `/billing/usage` | ✅ | ⏳ Manual |
| `/billing/invoices` | ✅ tenant filter | ⏳ Manual |
| `/billing/payment` | ✅ | ⏳ Manual |
| `/billing/upgrade` | ✅ | ⏳ Manual |
| `/billing/support` | ✅ | ⏳ Manual |
| Không vào `/admin/billing` | ✅ RBAC | ⏳ Manual |
| Refresh persist data | ✅ persist wired | ⏳ Manual |

### Admin `/admin/billing/*` (SUPER_ADMIN)

| Route / action | Code gate | Browser QA |
|----------------|-----------|------------|
| Overview / tenants / plans / invoices / payments / audit | ✅ 6 routes + venues list | ⏳ Re-QA sau redeploy |
| Suspend / unlock / mark paid / change plan | ✅ `useBilling` persist | ⏳ Manual |
| Audit log | ✅ service writes | ⏳ Manual |
| Refresh persist | ✅ | ⏳ Manual |

### Cross-tenant authenticated RLS

| Check | Kết quả |
|-------|---------|
| Anon blocked 8/8 | ✅ `verify-billing-phase9-staging.mjs` |
| Service-layer isolation | ✅ `billing-phase9.test.js` |
| Owner A vs Tenant B (JWT) | ⏳ `verify-billing-cross-tenant-staging.mjs` + creds hoặc manual |
| SUPER_ADMIN all tenants | ⏳ Manual |
| STAFF/REFEREE/PLAYER no billing | ✅ RBAC tests |

### Có thể chuyển Phase 10?

**⏳ Chưa pass final gate** — automated ✅; browser QA còn pending sau fix tenant resolver.

**Blocker còn lại:**

1. **Redeploy** preview/local với code mới (bỏ `tenant-demo`)
2. **Profile alignment** — `profiles.venue_id` phải trỏ `venues.id` hợp lệ (SQL trên)
3. **Browser re-QA** Owner + Admin (checklist dưới)
4. **Authenticated cross-tenant** — `verify-billing-cross-tenant-staging.mjs` + creds hoặc manual

**Checklist browser QA (user):**

1. Redeploy Vercel Preview / restart `npm run dev`
2. ~~Apply trial RPC SQL~~ ✅ đã có trên staging
3. SQL: xác nhận `profiles.venue_id` khớp `venues.id` cho COURT_OWNER
4. COURT_OWNER → `/billing` → thấy trial start/end, không còn `no_subscription` / `tenant_not_found`
5. SUPER_ADMIN → `/admin/billing/tenants` → thấy venue thật, **Tạo trial** nếu chưa có sub
6. Refresh cả hai flow → data còn
7. Owner A không thấy data tenant B
8. Ghi pass/fail → chuyển Phase 10 nếu all pass

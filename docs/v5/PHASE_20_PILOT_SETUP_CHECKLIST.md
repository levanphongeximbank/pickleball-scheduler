# Phase 20 — Pilot Setup Checklist (1 sân)

Hướng dẫn từng bước cho **chủ sân không rành kỹ thuật**.  
Môi trường: **Staging / Vercel Preview** — không production.

---

## Trước khi bắt đầu

- Có URL Preview (ví dụ `https://xxx.vercel.app`)
- Có quyền Supabase **staging** (hoặc nhờ SUPER_ADMIN)
- Không dùng tài khoản dev mock (`tenant-demo`, `venue-demo`)

---

## Bước 1 — Tạo venue

**Mục tiêu:** Có bản ghi `venues` trên Supabase.

**Cách kiểm tra:** Supabase → Table Editor → `venues` → có row mới (ví dụ `venue-pilot-1`).

**Kỳ vọng:** `id`, `name`, `status` = `trial` hoặc `active`.

**Nếu fail:** Xem `docs/supabase-billing-phase9.sql`, `src/features/tenant/services/tenantService.js`

---

## Bước 2 — Tạo owner account

**Mục tiêu:** User Auth + profile role `COURT_OWNER`.

**Cách kiểm tra:** Đăng nhập Preview → email owner → vào được app (không 403).

**Kỳ vọng:** Login thành công, sidebar hiện menu chủ sân.

**Nếu fail:** `docs/supabase-identity-v40-phaseB.sql`, `src/pages/LoginPage.jsx`

---

## Bước 3 — Kiểm tra `profiles.venue_id`

**Mục tiêu:** `profiles.venue_id` = `venues.id` của sân pilot.

**Cách kiểm tra:** Supabase → `profiles` → cột `venue_id` khớp venue bước 1.

**Kỳ vọng:** App header/context bar hiện đúng tên sân.

**Nếu fail:** `src/features/tenant/services/profileVenueService.js`, `docs/v5/PHASE_10E_BILLING_TENANT_MAPPING.md`

---

## Bước 4 — Tạo trial subscription

**Mục tiêu:** Row `tenant_subscriptions` cho venue.

**Cách kiểm tra:**
1. Vào `/billing` → thấy gói Trial, ngày hết hạn
2. Hoặc Supabase → `tenant_subscriptions` → `tenant_id` = venue id, `status` = `trialing`

**Kỳ vọng:** Không thấy màn hình "Chưa có gói sử dụng".

**Nếu fail:** Apply `docs/supabase-billing-phase9-trial-rpc.sql`; `src/features/billing/services/billingTrialRpc.js`

---

## Bước 5 — Kiểm tra RBAC

**Mục tiêu:** Owner thấy menu vận hành; player không vào admin.

**Cách kiểm tra:** Đăng nhập owner → có Dashboard, Court Management, Billing. Đăng nhập player → bị chặn route admin.

**Kỳ vọng:** `/users` owner OK; player → `/403` hoặc không thấy menu.

**Nếu fail:** `src/auth/rbac.js`, `src/config/navigationConfig.js`

---

## Bước 6 — Kiểm tra billing page

**Mục tiêu:** Billing load không lỗi tenant.

**Cách kiểm tra:** Mở `/billing` → plan, usage, invoices (có thể trống).

**Kỳ vọng:** Không banner đỏ "tenant_not_found"; `tenantId` không phải `tenant-demo`.

**Nếu fail:** `src/features/billing/hooks/useBilling.js`, `billingTenantResolver.js`

---

## Bước 7 — Kiểm tra Court Engine

**Mục tiêu:** Tạo session, check-in, xếp queue.

**Cách kiểm tra:** `/court-engine` hoặc Xếp sân → tạo session → check-in 4 người.

**Kỳ vọng:** Không crash; reload trang vẫn giữ data (cùng browser).

**Nếu fail:** `src/features/court-engine/`, `docs/v5/PHASE_20_COURT_ENGINE_PERSISTENCE.md`

---

## Bước 8 — Kiểm tra QR check-in

**Mục tiêu:** Mobile QR scan hoạt động trên staging.

**Cách kiểm tra:** `/mobile/qr-generate` → scan bằng `/mobile/qr-scan`.

**Kỳ vọng:** Check-in thành công; token sai → báo lỗi.

**Nếu fail:** `docs/supabase-phase16-kn6-qr-checkins-rls.sql`, `src/pages/mobile/QrScanPage.jsx`

---

## Bước 9 — Mobile Android

**Mục tiêu:** Chrome Android — login + bottom nav.

**Cách kiểm tra:** Xem `docs/v5/PHASE_20_MOBILE_PILOT_QA.md` mục 1–6.

**Kỳ vọng:** Login OK; owner thấy menu mobile.

**Nếu fail:** `src/features/mobile/`

---

## Bước 10 — Mobile iPhone

**Mục tiêu:** Safari Add to Home Screen.

**Cách kiểm tra:** QA doc mục 2, 4–6.

**Kỳ vọng:** Icon home screen mở app; login OK.

**Nếu fail:** `src/features/mobile/components/PwaInstallPrompt.jsx`

---

## Bước 11 — Logout / Login

**Mục tiêu:** Session restore đúng tenant.

**Cách kiểm tra:** Logout → Login lại → vẫn đúng venue và subscription.

**Kỳ vọng:** Không mất trial; không full access khi hết gói.

**Nếu fail:** `src/context/AuthContext.jsx`, `TenantContext.jsx`

---

## Bước 12 — Không dùng dev users

**Mục tiêu:** Không `tenant-demo`, `venue-demo`, RBAC tắt giả.

**Cách kiểm tra:** DevTools → không thấy tenant blocklist; env Preview có `VITE_RBAC_ENABLED=true`.

**Kỳ vọng:** `resolveBillingTenantId` không trả demo id.

**Nếu fail:** `billingTenantResolver.js`, Preview env Vercel

---

## Bước 13 — Ghi lỗi và rollback

**Mục tiêu:** Biết cách dừng pilot an toàn.

**Cách làm:**
1. Ghi lỗi + screenshot + URL
2. SUPER_ADMIN: suspend subscription hoặc khóa user
3. Không xóa data — chỉ `status = suspended` trên subscription

**Kỳ vọng:** Owner thấy màn hình khóa; vẫn vào `/billing`.

**Nếu fail:** `TenantOperationalGate`, `admin/billing`

---

## Go/No-Go pilot 1 sân

**GO** khi: Bước 1–8 PASS + ít nhất một thiết bị mobile (9 hoặc 10) PASS.

**NO-GO** khi: `no_subscription` full access, `tenant-demo` runtime, hoặc Court Engine mất data cross-tenant.

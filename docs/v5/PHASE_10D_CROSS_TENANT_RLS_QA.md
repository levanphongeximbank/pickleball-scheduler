# Phase 10D — Cross-tenant RLS Manual QA

**Ngày:** 2026-07-02  
**Branch:** `v5-platform-edition` (post `c048008` RBAC billing fix)  
**Supabase staging:** `qyewbxjsiiyufanzcjcq`  
**Không deploy production**

## Mục tiêu

Xác nhận **tenant isolation** với **authenticated JWT** (không dùng `service_role` để kết luận quyền user):

- Tenant A không đọc/sửa dữ liệu Tenant B
- Tenant B không đọc/sửa dữ liệu Tenant A *(cần seed Owner B)*
- `PLAYER` không xem billing/admin
- `COURT_OWNER` chỉ thấy venue của mình
- `SUPER_ADMIN` tách riêng — quyền global hợp lệ

**Mapping chuẩn (Phase 10E):**

```
profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
```

---

## Users / roles đã test

| User | Role DB | venue_id | Login automated | Ghi chú |
|------|---------|----------|-----------------|---------|
| `owner@staging.local` | `VENUE_OWNER` | `venue-staging-a` | ✅ | Password reset Phase 10E |
| `admin@staging.local` | `SUPER_ADMIN` | null | ✅ | Tách riêng admin probe |
| `manager@staging.local` | — | — | ⏳ BLOCKED | Login fail — cần reset password |
| `player@staging.local` | — | — | ⏳ BLOCKED | Login fail — cần reset password |
| `owner-b@staging.local` | — | — | ⏳ BLOCKED | **Chưa seed** — xem SQL bên dưới |

**Tenant A:** `venue-staging-a`  
**Tenant B:** `venue-staging-b` (venue tồn tại; chưa có owner JWT test)

---

## SQL / staging data đã apply

| SQL | Trạng thái |
|-----|------------|
| `docs/supabase-billing-phase10e-staging-tenant-align.sql` | ✅ Applied |
| `docs/supabase-staging-phase10d-tenant-b-seed.sql` | ⏳ **Chưa apply** — cần đăng ký + promote Owner B |

### Seed Tenant B (an toàn, staging only)

1. `/login` → Đăng ký `owner-b@staging.local` (password tạm — không commit)
2. SQL Editor staging → chạy `docs/supabase-staging-phase10d-tenant-b-seed.sql`
3. Thêm vào `.env.local` (local only): `STAGING_OWNER_B_PASSWORD=...`
4. Re-run: `node scripts/verify-cross-tenant-rls-staging.mjs`

---

## Bảng kiểm tra RLS (authenticated JWT)

Kết luận từ `node scripts/verify-cross-tenant-rls-staging.mjs` + probe thủ công **Owner A**.

| Bảng | Owner A | Owner B | PLAYER | Ghi chú |
|------|---------|---------|--------|---------|
| `profiles` | **PASS** | BLOCKED | BLOCKED | Chỉ profiles cùng `venue-staging-a` (5 rows) |
| `venues` | **PASS** | BLOCKED | BLOCKED | Chỉ `venue-staging-a`; filter B → 0 |
| `tenant_subscriptions` | **PASS** | BLOCKED | BLOCKED | 1 row A; filter/insert B → blocked RLS |
| `invoices` | **PASS** | BLOCKED | BLOCKED | 0 rows — không leak |
| `payments` | **PASS** | BLOCKED | BLOCKED | 0 rows |
| `billing_audit_logs` | **PASS** | BLOCKED | BLOCKED | Chỉ tenant A |
| `billing_events` | **PASS** | BLOCKED | BLOCKED | 0 rows |
| `club_data_v3` | **PASS** | BLOCKED | BLOCKED | 0 rows staging |
| `tournament_match_live` | **PASS** | BLOCKED | BLOCKED | 0 rows — policy `is_venue_staff()` rộng; cần data để stress-test |
| `notifications` | **PASS** | BLOCKED | BLOCKED | own-user policy |
| `push_subscriptions` | **PASS** | BLOCKED | BLOCKED | own-user policy |
| `qr_tokens` | **PARTIAL** | BLOCKED | BLOCKED | Policy `USING (true)` — **P2 risk** nếu có data cross-tenant |
| `checkins` | **PARTIAL** | BLOCKED | BLOCKED | Policy `USING (true)` — **P2 risk** nếu có data cross-tenant |
| `audit_logs` | **PASS** | BLOCKED | BLOCKED | Venue-scoped (`user.manage` + `venue_id`) |
| `ai_suggestions` | **PASS** | BLOCKED | BLOCKED | 0 rows — policy JWT `tenant_id` claim |
| `plans` / `plan_limits` | **N/A** | — | — | Global catalog (by design) |
| `players` / `courts` / `clubs` / `tournaments` | **N/A** | — | — | Không có bảng Postgres — data trong `club_data_v3` blob |

---

## Write isolation (Owner A → Tenant B)

| Thao tác | Kết quả |
|----------|---------|
| `INSERT tenant_subscriptions` tenant B | ✅ **Blocked** — RLS violation |
| `SELECT venues` id B | ✅ **0 rows** |
| `SELECT tenant_subscriptions` filter B | ✅ **0 rows** |
| `UPDATE profiles` user khác (admin) | ✅ **Không sửa** (RLS / 0 rows) |

---

## Route RBAC (app layer — Owner A)

| Route | Kết quả |
|-------|---------|
| `/billing` | ✅ PASS |
| `/admin/billing` | ✅ Blocked (đúng spec) |
| `/403` billing (trước `c048008`) | ✅ Đã fix |

PLAYER route checks: **BLOCKED** — chưa login được `player@staging.local`.

---

## Browser QA

| Check | Kết quả |
|-------|---------|
| Login `owner@staging.local` | ✅ PASS (Phase 10E re-QA) |
| `/billing` không 403 | ✅ PASS (post `c048008`) |
| Chỉ thấy venue A | ✅ Logic + RLS PASS |
| Login Owner B | ⏳ BLOCKED — chưa seed |
| PLAYER admin/billing block | ⏳ BLOCKED — chưa login player |

**Preview URL:** https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app

---

## Lỗi phát hiện

| ID | Mức | Mô tả | Ảnh hưởng |
|----|-----|-------|-----------|
| 10D-1 | **P2** | `qr_tokens` RLS `USING (true)` — mọi authenticated user đọc được mọi row nếu có data | Mobile QR — chưa có data staging |
| 10D-2 | **P2** | `checkins` RLS `USING (true)` — tương tự | Mobile check-in |
| 10D-3 | **P2** | `tournament_match_live` select cho `is_venue_staff()` không lọc `venue_id` | Director — 0 rows staging, cần regression khi có data |
| 10D-4 | **P2** | Thiếu `owner-b@staging.local` + passwords manager/player | BLOCKED bidirectional QA |
| 10D-5 | — | Không phát hiện **cross-tenant leak** trên billing/core tables đã có data | — |

**Không có P0/P1 leak** trên `tenant_subscriptions`, `venues`, `profiles`, billing tables trong phạm vi đã test.

---

## Script verify

```bash
# .env.local: VITE_SUPABASE_* + passwords staging (không commit)
STAGING_OWNER_A_PASSWORD=... \
STAGING_SUPER_ADMIN_PASSWORD=... \
  node scripts/verify-cross-tenant-rls-staging.mjs
```

Billing-only (Phase 9): `node scripts/verify-billing-cross-tenant-staging.mjs`

---

## Kết luận production readiness

| Gate | Verdict |
|------|---------|
| Phase 10D cross-tenant RLS | **PARTIAL** |
| Billing tenant isolation (JWT) | **PASS** |
| Bidirectional Tenant A ↔ B | **BLOCKED** — seed Owner B |
| PLAYER / manager JWT probes | **BLOCKED** — reset passwords |
| Mobile open policies | **PARTIAL** — P2, chưa leak thực tế (empty tables) |

**Production Go/No-Go:** vẫn **NO-GO** theo `PHASE_10_RELEASE_AUDIT.md` cho đến khi:

1. Seed + verify Owner B bidirectional
2. Reset/login manager + player staging
3. (Tuỳ chọn) Harding `qr_tokens` / `checkins` RLS trước mobile production

---

## Bước tiếp theo

1. Apply `docs/supabase-staging-phase10d-tenant-b-seed.sql` + trial sub cho B (admin)
2. Reset password `player@staging.local`, `manager@staging.local`
3. Re-run `verify-cross-tenant-rls-staging.mjs` → target **PASS** full matrix
4. Browser QA Owner B trên Preview
5. Sau Phase 10D **PASS** → Marketplace/API foundation (Phase 11 scope)

---

## Phạm vi không đụng (đúng yêu cầu)

- ✅ Không sửa Billing logic (trừ RBAC `c048008` đã ship)
- ✅ Không sửa Court Engine
- ✅ Không Marketplace/API production
- ✅ Không apply production SQL
- ✅ Kết luận RLS không dùng service_role

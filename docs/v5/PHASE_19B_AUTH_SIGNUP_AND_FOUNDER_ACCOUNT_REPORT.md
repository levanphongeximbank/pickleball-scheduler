# Phase 19B — Auth Signup & Founder Account Report

**Ngày:** 2026-07-05  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Production App:** https://pickleball-scheduler-eight.vercel.app  
**Ràng buộc giữ nguyên:** Không deploy Production mà chưa owner GO · Không bật payment live · `VITE_API_ENABLED=false` · Marketplace/AI Production OFF · Không đánh dấu Commercial Beta/GA

---

## Executive summary

| Hạng mục | Trạng thái |
|----------|------------|
| SQL promote founder → `SUPER_ADMIN` | ✅ Sẵn sàng apply (owner thủ công) |
| SQL COURT_OWNER test riêng | ✅ Template sẵn sàng |
| RPC đăng ký chủ sân | ✅ SQL sẵn sàng apply trước khi bật signup |
| UI đăng ký `/login` | ✅ Code merged (feature flag OFF mặc định) |
| `npm test` | ✅ **778/778 PASS** |
| `npm run build` | ✅ PASS (~2.4s) |
| `npm run lint` | ✅ PASS (chỉ warnings cũ, không liên quan patch) |
| Deploy Production | ⏳ **Chờ owner GO** |

---

## 1. Tài khoản `lephong.eximbank@gmail.com` đã là SUPER_ADMIN chưa?

**Chưa (tại thời điểm report).** Agent không chạy SQL trên Production.

Owner cần apply thủ công:

| File | Mục đích |
|------|----------|
| [`PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql`](./PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql) | Promote founder, `venue_id = null`, `status = active` |

Script idempotent:

- Nếu đã có `profiles` row → `UPDATE role = SUPER_ADMIN`, xóa ràng buộc `venue_id` / `club_id`
- Nếu chưa có profile → `INSERT` từ `auth.users`
- Không xóa `auth.users`, không xóa `venue-prod-main`

**Verify sau apply:** query V1–V4 trong cùng file SQL.

---

## 2. Founder khác COURT_OWNER thế nào?

| | **SUPER_ADMIN (Founder)** | **COURT_OWNER (Tenant owner)** |
|--|---------------------------|--------------------------------|
| Phạm vi | Toàn platform SaaS | Một tenant (sân/CLB) |
| `profiles.venue_id` | `null` | Bắt buộc = `venues.id` |
| `tenant_subscriptions` | Không cần | Cần trial/active cho tenant |
| Tạo qua signup public | ⛔ Không | ✅ Flow riêng (RPC) |
| Dùng cho smoke A2/A4/A5 | Không phù hợp | ✅ Đúng vai trò |

Founder quản trị platform (users, tenants, audit). COURT_OWNER vận hành một sân — mapping:

```
profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
```

---

## 3. Có cần tạo COURT_OWNER test riêng không?

**Có — bắt buộc sau khi promote founder.**

Email founder **không** nên là tenant owner lâu dài cho smoke A2/A4/A5.

| Bước | Hành động |
|------|-----------|
| 1 | Apply founder SQL |
| 2 | Tạo user test (signup hoặc invite) — email **khác** `lephong.eximbank@gmail.com` |
| 3 | Apply [`PHASE_19B_PRODUCTION_COURT_OWNER_TEST_ACCOUNT.sql`](./PHASE_19B_PRODUCTION_COURT_OWNER_TEST_ACCOUNT.sql) (thay `TEST_OWNER_EMAIL`, `TEST_OWNER_UUID`) |
| 4 | Login COURT_OWNER test → `/billing` → gọi trial RPC (hoặc SUPER_ADMIN gọi RPC) |
| 5 | Verify alignment + không cross-tenant leak |

---

## 4. Đăng ký tài khoản đã thêm ở màn nào?

**`/login`** — [`src/pages/LoginPage.jsx`](../../src/pages/LoginPage.jsx)

Khi `VITE_AUTH_SIGNUP_ENABLED=true`:

- Link **「Đăng ký tài khoản」** chuyển sang form đăng ký
- Link **「Quay lại đăng nhập」** quay về form đăng nhập
- Form: email, mật khẩu, xác nhận mật khẩu, tên hiển thị
- Radio: **Người chơi** / **Chủ sân** (+ tên sân nếu chủ sân)
- Thông báo kiểm tra email khi Supabase yêu cầu xác nhận

Khi flag **OFF** (mặc định Production): chỉ **Đăng nhập** + **Quên mật khẩu** (giữ hành vi controlled test hiện tại).

---

## 5. Signup mặc định tạo role gì?

| Flow | Role sau signup | Ghi chú |
|------|-----------------|---------|
| **Người chơi** | `PLAYER` | Trigger `handle_new_user()` (v3.5.7) — **không** đọc metadata role |
| **Chủ sân** | `COURT_OWNER` | Sau signup → RPC `auth_register_court_owner` tạo venue + trial |

**Không** cho user tự đăng ký `SUPER_ADMIN`:

- Frontend không gửi `role` trong metadata
- Trigger DB luôn tạo `PLAYER` trước
- RPC chỉ cho phép `PLAYER` chưa có `venue_id`

---

## 6. Có cho public signup ngay trên Production không?

**Không — dùng feature flag.**

| Env | Giá trị khuyến nghị |
|-----|---------------------|
| `VITE_AUTH_SIGNUP_ENABLED` | `false` (mặc định) |

**Thứ tự owner trước khi bật `true`:**

1. Apply [`PHASE_19B_AUTH_SIGNUP_COURT_OWNER_RPC.sql`](./PHASE_19B_AUTH_SIGNUP_COURT_OWNER_RPC.sql) trên Production
2. Supabase Auth → Site URL / Redirect URLs gồm `https://pickleball-scheduler-eight.vercel.app/**`
3. Review founder + COURT_OWNER test alignment
4. Owner GO → set `VITE_AUTH_SIGNUP_ENABLED=true` trên Vercel Preview trước, Production sau Preview PASS

---

## 7. Có còn `admin@staging.local` trên Production không?

**Không trong app bundle/code path Production.**

- Dev registry (`authService.js`) dùng `admin@pickleball.local`, `owner@venue.local`, … — **không** có `admin@staging.local`
- `isDevAuthAllowed()` = `false` trên secure runtime (Production build + Supabase env)
- `VITE_SEED_DEMO=false` trên Production (Gate 3 PASS)

Staging email chỉ còn trong docs staging QA — không autofill trên Production login.

---

## 8. Forgot password redirect còn localhost không?

**Không hard-code localhost.**

[`passwordService.js`](../../src/features/identity/services/passwordService.js) dùng `getResetPasswordRedirectUrl()` → `{origin}/reset-password` từ `window.location.origin` (Production = `https://pickleball-scheduler-eight.vercel.app/reset-password`).

Signup confirm dùng `getLoginRedirectUrl()` → `{origin}/login`.

**Owner vẫn cần** cấu hình Supabase Auth Redirect URLs khớp Production URL (xem Phase 19B controlled test report §10).

---

## 9. Test / build / lint kết quả?

| Lệnh | Kết quả | Ghi chú |
|------|---------|---------|
| `npm test` | ✅ **778 PASS / 0 FAIL** | Gồm `tests/auth-signup.test.js` mới |
| `npm run build` | ✅ PASS | ~2.36s |
| `npm run lint` | ✅ PASS (exit 0) | Warnings hooks cũ, không từ patch auth |

**Tests auth-signup cover:**

- Feature flag default OFF
- Validation email / password / confirm / venue name
- Metadata không chứa `SUPER_ADMIN`
- LoginPage có link đăng ký + quay lại
- Không hard-code localhost / staging project trong auth flow
- Dev registry không có `admin@staging.local`

---

## 10. Có cần owner GO redeploy patch không?

**Có — sau owner review.**

| Patch | Cần redeploy? |
|-------|---------------|
| Code auth/signup UI | ✅ Có (Vercel) — **chờ owner GO** |
| Founder SQL | SQL Editor only — không cần redeploy |
| Court owner RPC SQL | SQL Editor — trước khi bật signup flag |
| `VITE_AUTH_SIGNUP_ENABLED=true` | Env Vercel — sau SQL + Preview QA |

**Không deploy Production** cho đến khi owner xác nhận GO (ràng buộc Phase 19B).

---

## File deliverables

| File | Loại |
|------|------|
| `docs/v5/PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql` | SQL founder |
| `docs/v5/PHASE_19B_PRODUCTION_COURT_OWNER_TEST_ACCOUNT.sql` | SQL tenant test |
| `docs/v5/PHASE_19B_AUTH_SIGNUP_COURT_OWNER_RPC.sql` | RPC chủ sân |
| `src/config/authConfig.js` | Feature flag + redirect helpers |
| `src/features/identity/services/signupService.js` | Validation + court owner RPC client |
| `src/pages/LoginPage.jsx` | UI đăng ký |
| `src/auth/authService.js` | signUp + pending court owner completion |
| `tests/auth-signup.test.js` | Unit tests |
| `.env.example` / `.env.production.example` | `VITE_AUTH_SIGNUP_ENABLED=false` |

---

## Owner checklist (thứ tự đề xuất)

- [ ] **SQL 1:** Apply founder SUPER_ADMIN → verify V1–V4
- [ ] **SQL 2:** Tạo + align COURT_OWNER test → trial subscription
- [ ] **SQL 3:** Apply `auth_register_court_owner` RPC
- [ ] **Supabase Auth:** Site URL + Redirect URLs = Production app URL
- [ ] **Owner GO:** Deploy code patch lên Vercel
- [ ] **Preview:** `VITE_AUTH_SIGNUP_ENABLED=true` → smoke signup PLAYER + COURT_OWNER
- [ ] **Production:** Bật signup flag chỉ sau Preview PASS
- [ ] **Smoke:** A2/A4/A5 với COURT_OWNER test (không dùng founder email)

---

## Verification SQL tổng hợp (sau cả 3 bước SQL)

```sql
-- Founder
select email, role, venue_id, status
from public.profiles
where email = 'lephong.eximbank@gmail.com';
-- expect: SUPER_ADMIN, venue_id IS NULL, status = active

-- COURT_OWNER test (thay email)
select
  p.email, p.role, p.venue_id,
  v.id as venue_match,
  ts.tenant_id, ts.status as sub_status
from public.profiles p
left join public.venues v on v.id = p.venue_id
left join public.tenant_subscriptions ts on ts.tenant_id = p.venue_id
where p.role = 'COURT_OWNER'
order by p.email;

-- Cross-tenant leak: founder không có venue subscription
select count(*) as founder_tenant_rows
from public.profiles p
join public.tenant_subscriptions ts on ts.tenant_id = p.venue_id
where p.email = 'lephong.eximbank@gmail.com';
-- expect: 0
```

---

**Kết luận:** Code sẵn sàng review. Founder promote + tenant test + RPC là bước owner thủ công trên Supabase. Public signup **tắt** mặc định; bật sau owner GO + redeploy + SQL RPC.

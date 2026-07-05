# Phase 19B — Production Test Accounts RBAC Report

**Ngày:** 2026-07-05  
**Cập nhật apply:** 2026-07-05 (owner apply + verification PASS)  
**Production Supabase:** `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`)  
**Production App:** https://pickleball-scheduler-eight.vercel.app  
**SQL apply:** [`PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql`](./PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql)

---

## Executive summary

| Hạng mục | Trạng thái |
|----------|------------|
| Auth users (6 email) | ✅ Tồn tại trên Supabase Auth |
| SQL RBAC apply | ✅ **PASS** — owner apply qua SQL Editor (2026-07-05) |
| Verification V1–V8 | ✅ **PASS** (8/8) |
| **Production test accounts RBAC** | ✅ **PASS** |
| Rollback | ⛔ **Không** — data additive, không cần rollback |
| Deploy Production mới | ⛔ **Không** — giữ deployment hiện tại |
| Payment live | ⛔ **OFF** — không đổi trong bước này |
| Bước tiếp theo | ⏳ **Phase 19B manual smoke theo từng role** |

---

## 0. Ràng buộc vận hành (sau apply)

| Ràng buộc | Trạng thái | Ghi chú |
|-----------|------------|---------|
| Rollback | ⛔ **Không** | Script chỉ insert/update `profiles` + align `venues.owner_id`; không xóa dữ liệu. Verification PASS — **không** promote deployment cũ, **không** revert SQL. |
| Deploy mới | ⛔ **Không** | Không trigger Vercel redeploy vì apply RBAC. App bundle hiện tại (`v5.0.0-rc1`) vẫn dùng. |
| Payment live | ⛔ **OFF** | `VITE_PAYMENT_MODE=dev`, provider mock. Script **không** insert paid subscription. |
| Commercial sale | ⛔ **NO** | Gate 4/5 chưa PASS — ngoài scope Phase 19B test accounts. |

---

## 1. Ma trận tài khoản test (đã apply)

| # | Email | Role | `venue_id` | Mô tả | Trạng thái |
|---|-------|------|------------|-------|------------|
| 1 | `lephong.eximbank@gmail.com` | `SUPER_ADMIN` | `null` | Founder / Platform Admin | ✅ active |
| 2 | `chusantest@gmail.com` | `COURT_OWNER` | `venue-prod-main` | Chủ sân test Production | ✅ active · `owner_id` aligned |
| 3 | `ketoan@gmail.com` | `CASHIER` | `venue-prod-main` | Thu ngân sân | ✅ active |
| 4 | `chutichclb@gmail.com` | `CLUB_OWNER` | `venue-prod-main` | Chủ tịch câu lạc bộ | ✅ active · `club_id` chưa gán |
| 5 | `trongtai@gmail.com` | `REFEREE` | `venue-prod-main` | Trọng tài | ✅ active |
| 6 | `doitruong@gmail.com` | `PLAYER` | `venue-prod-main` | Đội trưởng tạm thời | ✅ active · dùng `PLAYER` (không `TEAM_CAPTAIN`) |

---

## 2. Kết quả apply & verification (2026-07-05)

Owner apply [`PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql`](./PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql) trên Supabase Production `expuvcohlcjzvrrauvud`.

| Query | Kết quả | Chi tiết |
|-------|---------|----------|
| **V1** | ✅ PASS | 6 dòng, `rbac_check = ok` |
| **V2** | ✅ PASS | Founder `ok_founder` |
| **V3** | ✅ PASS | COURT_OWNER `ok_aligned` với `venue-prod-main` |
| **V4** | ✅ PASS | `venue-prod-main` tồn tại |
| **V5** | ✅ PASS | `auth_user_count = 6` |
| **V6** | ✅ PASS | 0 rows (không thiếu auth user) |
| **V7** | ✅ PASS | 0 rows (không role lạ) |
| **V8** | ✅ PASS | 0 rows (founder không gắn tenant subscription) |

**Verdict SQL RBAC:** ✅ **PASS** (8/8)

---

## 3. SQL đã làm gì?

Script idempotent, additive only:

1. **Discovery** — liệt kê `auth.users` + `profiles` hiện có (6 email).
2. **Pre-check** — `venue-prod-main` tồn tại; role hợp lệ theo `profiles_role_check` v4.
3. **Insert** — profile chưa có → insert từ `auth.users`.
4. **Update** — reconcile `role`, `venue_id`, `status`, `display_name`.
5. **Founder guard** — `lephong.eximbank@gmail.com` → `venue_id = null`, `club_id = null`.
6. **Venue owner align** — `venues.owner_id` = profile `chusantest@gmail.com` (COURT_OWNER).
7. **Fail-safe** — `raise exception` nếu thiếu auth user hoặc profile (không trigger — apply thành công).

**Không làm:** xóa `auth.users`, xóa venue, tạo role mới, insert paid subscription.

---

## 4. Thứ tự apply (đã hoàn thành)

| Bước | Hành động | Trạng thái |
|------|-----------|------------|
| 1 | 6 auth users trên Supabase Auth | ✅ |
| 2 | `venue-prod-main` tồn tại | ✅ |
| 3 | Apply `PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql` | ✅ 2026-07-05 |
| 4 | Verification V1–V8 | ✅ PASS |
| 5 | **Tiếp theo:** Manual smoke theo role | ⏳ **IN PROGRESS** |

---

## 5. Bước tiếp theo — Phase 19B manual smoke theo role

RBAC database layer **PASS**. Chuyển sang kiểm thử runtime trên app Production — **login từng tài khoản**, verify menu/route theo role.

**Checklist chính:** [`PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md`](./PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md)  
**Ghi kết quả:** [`PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`](./PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md)

### 5.1 Thứ tự smoke khuyến nghị

| Ưu tiên | Role | Tài khoản | Mục checklist | Kiểm tra nhanh |
|---------|------|-----------|---------------|----------------|
| **P0** | `SUPER_ADMIN` | lephong.eximbank@gmail.com | A1 + menu admin | Platform admin, tenant management, audit; không gắn tenant |
| **P0** | `COURT_OWNER` | chusantest@gmail.com | A2–A5 | Dashboard tenant, `/billing` trial, settings venue |
| **P1** | `CASHIER` | ketoan@gmail.com | A3 spot | Bookings / check-in; **không** thấy settings quản trị |
| **P1** | `CLUB_OWNER` | chutichclb@gmail.com | A3 spot | Module CLB (sau khi gán `club_id` nếu cần) |
| **P1** | `REFEREE` | trongtai@gmail.com | E3 | `/referee`, cập nhật điểm trận |
| **P1** | `PLAYER` | doitruong@gmail.com | A8 | Menu VĐV; **403** trên admin/court-engine route |

### 5.2 Ràng buộc trong smoke window

| Ràng buộc | Áp dụng |
|-----------|---------|
| Rollback | Chỉ khi **P0 app smoke FAIL** (white screen, cross-tenant leak) — **không** rollback vì RBAC SQL đã PASS |
| Deploy mới | **Không** redeploy chỉ vì smoke RBAC |
| Payment live | **Vẫn OFF** trong toàn bộ smoke window |

---

## 6. Ghi chú kế toán (`ketoan@gmail.com`)

| Role | Quyền chính |
|------|-------------|
| `CASHIER` | Thu ngân — bookings, check-in, thu tiền |
| `ACCOUNTANT` | Kế toán — finance view/export, báo cáo (nếu bật module) |

**Hiện tại:** `CASHIER` (theo yêu cầu owner).  
**Đổi sang `ACCOUNTANT`:** re-run update idempotent (không cần rollback RBAC batch).

```sql
update public.profiles
set role = 'ACCOUNTANT', updated_at = now()
where email = 'ketoan@gmail.com';
```

---

## 7. Backlog P1 — Team Captain

| Task | Mô tả |
|------|-------|
| **P1** | Thêm capability **Team Captain** riêng cho `doitruong@gmail.com` |

Hiện tại dùng `PLAYER` vì schema `profiles.role` **chưa có** `TEAM_CAPTAIN`.

---

## 8. Liên kết file liên quan

| File | Mục đích |
|------|----------|
| [`PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql`](./PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql) | SQL apply (đã chạy) |
| [`PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md`](./PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md) | **Bước tiếp theo** — manual smoke |
| [`PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`](./PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md) | Ghi kết quả smoke tổng |
| [`PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql`](./PHASE_19B_PRODUCTION_FOUNDER_SUPER_ADMIN.sql) | Founder promote (subset — đã gộp batch RBAC) |
| [`PHASE_19B_AUTH_SIGNUP_AND_FOUNDER_ACCOUNT_REPORT.md`](./PHASE_19B_AUTH_SIGNUP_AND_FOUNDER_ACCOUNT_REPORT.md) | Context signup / founder |

---

## 9. Owner checklist

- [x] 6 auth users tồn tại trên Production Auth
- [x] `venue-prod-main` tồn tại
- [x] Apply `PHASE_19B_PRODUCTION_TEST_ACCOUNTS_RBAC.sql`
- [x] V1–V8 verification PASS
- [ ] Login smoke: SUPER_ADMIN + COURT_OWNER (P0)
- [ ] Login smoke: CASHIER, CLUB_OWNER, REFEREE, PLAYER (P1)
- [ ] Ghi kết quả vào [`PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`](./PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md)
- [x] **Không** bật payment live
- [x] **Không** rollback (RBAC apply PASS)
- [x] **Không** deploy mới (chỉ SQL + verify)

---

## 10. Verdict

| | |
|--|--|
| **Production test accounts RBAC** | ✅ **PASS** (2026-07-05) |
| **Verification V1–V8** | ✅ **8/8 PASS** |
| **Rollback** | ⛔ **Không** |
| **Deploy mới** | ⛔ **Không** |
| **Payment live** | ⛔ **OFF** |
| **Bước tiếp theo** | ⏳ Phase 19B manual smoke theo role → [`PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md`](./PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md) |

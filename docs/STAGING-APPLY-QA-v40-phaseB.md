# Staging Apply & Manual QA — v4.0 Phase B (Identity)

**Mục tiêu:** Apply SQL identity Phase A + B trên Supabase staging, QA auth flows / user mgmt / profile / `/403` / audit / referee session. **Không** deploy production.

**Phạm vi:** Identity Phase B. Tournament Engine / Scheduler không đổi.

**Tham chiếu:** `docs/SUPABASE-STAGING-CHECKLIST.md`, `docs/STAGING-APPLY-QA-v358.md`, `src/features/identity/ARCHITECTURE.md`, `docs/v5/CLUB_GOVERNANCE_SPEC.md` (quy tắc CLB V5 — apply `docs/supabase-club-governance-v52.sql` trên staging), `docs/v5/PHASE_TENANT_ISOLATION_BROWSER_QA.md` (QA cô lập Owner A / Owner B)

---

## 1. Checklist SQL Supabase staging

### 1.1 Thứ tự chạy SQL (sau v3.5.8)

Chạy **sau** các bước 1–7 trong `docs/SUPABASE-STAGING-CHECKLIST.md`:

| # | File | Mục đích |
|---|------|----------|
| 8 | `docs/supabase-identity-v40-sprint1.sql` | `profiles` phone/avatar, `roles`/`permissions`/`audit_logs`, RLS |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | Mở rộng `audit_logs`, bảng `password_reset_tokens` |
| 10 | `docs/supabase-identity-avatars-storage.sql` | Bucket `user-avatars` + RLS upload theo `auth.uid()` |

**Rollback (khẩn cấp):** `phaseB-rollback` → `sprint1-rollback` (theo thứ tự ngược).

### 1.2 Kiểm tra bảng mới

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('audit_logs', 'password_reset_tokens', 'roles', 'permissions', 'role_permissions')
order by tablename;
```

**Kỳ vọng:** `audit_logs` RLS bật; `password_reset_tokens` tồn tại.

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'audit_logs'
  and column_name in ('ip_address', 'user_agent');
```

**Kỳ vọng:** 2 cột có mặt (Phase B).

---

## 2. Env Vercel Preview

| Biến | Giá trị |
|------|---------|
| `VITE_SUPABASE_URL` | URL staging |
| `VITE_SUPABASE_ANON_KEY` | Anon key staging |
| `VITE_RBAC_ENABLED` | `true` (bắt buộc để QA guard) |
| `VITE_SEED_DEMO` | `false` |

**Lưu ý:** Local dev mặc định RBAC **tắt** — để test guard trên staging/preview phải bật `VITE_RBAC_ENABLED=true`.

---

## 3. Tài khoản test (tối thiểu 6 user)

Tạo qua `/login` đăng ký hoặc SQL (sau khi có auth user):

| Email | Role | Mục đích QA |
|-------|------|-------------|
| `admin@staging.local` | SUPER_ADMIN | Users, mọi route |
| `owner@staging.local` | VENUE_OWNER | Venue ops, user.manage |
| `cashier@staging.local` | CASHIER | Booking, không `/users` |
| `player@staging.local` | PLAYER | `/profile`, không `/users` |
| `referee@staging.local` | REFEREE | `/referee` hub, không admin |
| `club@staging.local` | CLUB_OWNER | CLB/giải, không user mgmt |

Gán role mẫu (sau signup):

```sql
update public.profiles set role = 'REFEREE', venue_id = 'venue-staging', status = 'active'
where email = 'referee@staging.local';
```

---

## 4. QA theo tính năng Phase B

### 4.1 Auth guard + `/403`

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Chưa login → mở `/players` | Redirect `/login` |
| 2 | Login PLAYER → mở `/users` | Redirect `/403` |
| 3 | Mở trực tiếp `/403` | Hiển thị Access Denied (không loop) |
| 4 | Login SUPER_ADMIN → `/users` | Vào được |

### 4.2 Forgot / Reset password

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | `/login` → Quên mật khẩu | Form email hiện |
| 2 | Gửi email hợp lệ | Supabase gửi link reset (hoặc thông báo thành công) |
| 3 | Mở link reset → `/reset-password` | Đặt mật khẩu mới thành công |
| 4 | Login mật khẩu mới | OK |
| 5 | Token hết hạn / sai | Thông báo lỗi, không lộ token trong console |

### 4.3 My Profile (`/profile`)

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Login PLAYER → `/profile` | Xem email, role (read-only) |
| 2 | Sửa họ tên / phone → Lưu | Cập nhật OK, header refresh tên |
| 3 | Đổi mật khẩu — sai mật khẩu cũ | Bị chặn |
| 4 | Đổi mật khẩu — đúng | Thành công |
| 5 | Không có field sửa role | Role chỉ hiển thị |
| 6 | Apply `docs/supabase-identity-avatars-storage.sql` | Bucket `user-avatars` + policies OK |
| 7 | Upload JPG/PNG trên `/profile` | Preview + menu header cập nhật |
| 8 | Dán URL ảnh → Lưu hồ sơ | Hiển thị đúng |
| 9 | Xóa ảnh | Quay về chữ cái (initials) |
| 10 | URL ảnh lỗi | Fallback initials, không crash |

### 4.4 User Management (`/users`)

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | SUPER_ADMIN → danh sách user | Load OK |
| 2 | Tạo user mới (PLAYER) | OK |
| 3 | Gán role REFEREE | OK (có `role.manage`) |
| 4 | Khóa user (`suspended`) | User đó không login / bị chặn quyền |
| 5 | PLAYER vào `/users` | `/403` |
| 6 | Không có nút xóa cứng | Chỉ disable/suspend |

### 4.5 Audit log

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Login thành công | Row `audit_logs` action login |
| 2 | Login sai mật khẩu | `login_failed` (nếu hook bật) |
| 3 | Logout | action logout |
| 4 | Đổi mật khẩu / sửa user | action tương ứng |
| 5 | Kiểm tra metadata | **Không** có password/token plaintext |

```sql
select action, resource_type, actor_id, created_at
from public.audit_logs
order by created_at desc
limit 20;
```

### 4.6 Referee — session vs legacy token

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Login REFEREE → `/referee` | Hub trận được phân công |
| 2 | REFEREE mở `/users`, `/settings` | `/403` hoặc menu ẩn |
| 3 | Director gán TT → mở `/referee/:token` (legacy) | Vẫn chấm được (RPC) |
| 4 | REFEREE chấm trận qua session | `/referee/match/:id` OK nếu được phân công |
| 5 | REFEREE mở trận không được gán | Bị chặn |

---

## 5. Regression — màn cũ (RBAC tắt local / bật staging)

Chạy nhanh trên Preview với user CLUB_OWNER / VENUE_OWNER:

| Màn | Kiểm tra |
|-----|----------|
| Tổng quan | Load dashboard |
| Người chơi | CRUD player |
| Sân / Booking | Tạo booking |
| Giải đấu | Tạo giải nội bộ |
| Daily Play | Khởi chạy phiên |
| Xếp sân | Chọn người, xếp lượt |
| Director | Gán trọng tài, QR legacy |

**Local dev** (`VITE_RBAC_ENABLED` không set): tất cả màn trên phải giống trước Phase B.

---

## 6. Go / No-Go Preview

### Go khi

- [ ] SQL bước 8–9 chạy không lỗi
- [ ] 6 user test gán role xong
- [ ] `/403`, `/profile`, `/users`, forgot/reset pass
- [ ] Audit không lộ secret
- [ ] Referee session + legacy token đều OK
- [ ] Regression màn cũ pass
- [ ] `npm run build` + `npm test` pass trên branch deploy

### No-Go khi

- User tự đổi role qua `/profile`
- PLAYER vào `/users` được
- Password/token xuất hiện trong `audit_logs.metadata`
- Legacy `/referee/:token` hỏng sau deploy
- RBAC tắt mà màn cũ bị chặn

---

## 7. Bước tiếp theo (ngoài Phase B)

- Phase C: RLS server-side cho user mgmt / audit read
- Production cutover: backup → apply SQL → `VITE_RBAC_ENABLED=true` có kế hoạch rollback
- Referee: gỡ dần token-only khi 100% session

# V5.2 — Apply SQL Production (Owner từng bước)

**Mục tiêu:** Chạy SQL RBAC V5.2 trên Supabase **Production**  
**Project:** `pickleball-scheduler-production`  
**Ref (bắt buộc thấy trên URL):** `expuvcohlcjzvrrauvud`  
**File SQL:** [`PHASE_V52_PRODUCTION_RBAC_ROLES.sql`](./PHASE_V52_PRODUCTION_RBAC_ROLES.sql)  
**Thời gian:** ~5 phút

---

## Trước khi bắt đầu

| Kiểm tra | Tick |
|----------|------|
| Đang đăng nhập Supabase bằng tài khoản owner | ☐ |
| **Không** mở project staging `qyewbxjsiiyufanzcjcq` | ☐ |
| App V5.2 đã deploy Production (Vercel) | ☐ |

---

## Bước 1 — Mở đúng project Production

1. Mở trình duyệt → https://supabase.com/dashboard  
2. Chọn project **`pickleball-scheduler-production`**  
3. Nhìn thanh địa chỉ — **phải có** chữ: `expuvcohlcjzvrrauvud`  
4. Nếu thấy `qyewbxjsiiyufanzcjcq` → **DỪNG**, đổi sang project Production

---

## Bước 2 — Mở SQL Editor

1. Menu trái → **SQL Editor**  
2. Bấm **New query** (truy vấn mới)

---

## Bước 3 — Dán và chạy SQL

1. Trên máy tính, mở file trong project:

   `docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql`

2. **Ctrl+A** (chọn hết) → **Ctrl+C** (copy)  
3. Quay lại Supabase SQL Editor → **Ctrl+V** (dán)  
4. Bấm **Run** (hoặc Ctrl+Enter)  
5. Đợi ~10–30 giây

**Kỳ vọng:** Thanh kết quả phía dưới — **không có dòng ERROR màu đỏ**. Cuối cùng có các bảng kết quả V52-1 → V52-8.

---

## Bước 4 — Kiểm tra nhanh (V52-4, V52-5, V52-6)

Cuối output sau khi Run, tìm:

| Query | Kỳ vọng |
|-------|---------|
| **V52-4** `tech_perm_count` | ≥ 10 |
| **V52-5** `captain_perm_count` | ≥ 10 |
| **V52-6** `doitruong@gmail.com` | `role` = **TEAM_CAPTAIN** |

Nếu V52-7 trả **0 rows** → PASS (không có role lạ).  
Nếu V52-8 trả **0 rows** → PASS (technician không có quyền nguy hiểm).

---

## Bước 5 — Gán user test V5.2 (Quản lý người dùng)

**File seed:** [`PHASE_V52_PRODUCTION_RBAC_SEED.sql`](./PHASE_V52_PRODUCTION_RBAC_SEED.sql)

1. Đăng ký trên app Production `/login`: **kythuat@gmail.com** (mật khẩu tạm — đổi email trong file SQL nếu dùng account khác)
2. SQL Editor Production → chạy `PHASE_V52_PRODUCTION_RBAC_SEED.sql`
3. Đăng nhập **lephong.eximbank@gmail.com** (Super Admin) → **Quản lý người dùng**:
   - Dropdown Role có **Kỹ thuật viên hệ thống** và **Trưởng nhóm / Đội trưởng**
   - Bảng có `kythuat@gmail.com` (SYSTEM_TECHNICIAN) và `doitruong@gmail.com` (TEAM_CAPTAIN)

Verify terminal (cần `.env.local` trỏ Production):

```bash
npm run verify:v52-production
```

---

## Bước 6 — (Sau khi có giải đồng đội thật) Cập nhật đội trưởng test

Khi đã tạo giải team tournament trên Production, chạy **query mới** (thay ID thật):

```sql
update public.profiles
set
  tournament_id = 'ID_GIAI_THAT',
  team_id = 'ID_DOI_THAT',
  updated_at = now()
where email = 'doitruong@gmail.com';
```

---

## Cách tự động (nếu có Database password)

1. Supabase → **Settings** → **Database** → **Connection string** → **Session pooler**  
2. Copy URI (có mật khẩu DB)  
3. Thêm vào `.env.local` (không commit):

   ```
   SUPABASE_DB_URL=postgresql://postgres.expuvcohlcjzvrrauvud:...@...pooler.supabase.com:6543/postgres
   ```

4. Trong terminal project:

   ```bash
   npm run apply:v52-production-sql
   ```

---

## Nếu lỗi

| Lỗi | Xử lý |
|-----|--------|
| `profiles_role_check` violation | Có profile role không hợp lệ — gửi output V52-7 cho engineering |
| `permission_id` FK fail | Chạy trước `PHASE_23C_PRODUCTION_PERMISSIONS_PATCH.sql` rồi chạy lại V5.2 |
| Apply nhầm staging | **Không panic** — file này chỉ dùng trên Production; staging cần file riêng |

**Không rollback** nếu verification PASS — script additive only.

---

## Tick hoàn tất

| # | Việc | Tick | Ngày |
|---|------|------|------|
| 1 | SQL V5.2 Run OK | ☐ | |
| 2 | V52-1 → V52-8 PASS | ☐ | |
| 3 | Smoke login TEAM_CAPTAIN | ☐ | |

Ghi kết quả vào: [`V5_2_PRODUCTION_GO_REPORT.md`](./V5_2_PRODUCTION_GO_REPORT.md) §6

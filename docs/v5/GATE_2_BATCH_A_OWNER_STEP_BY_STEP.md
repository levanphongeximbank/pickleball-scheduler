# Gate 2 — Batch A: Hướng dẫn từng bước (#1 → #15)

**Dành cho:** Owner — không cần biết lập trình  
**Ngày:** 2026-07-04  
**Phạm vi tài liệu này:** Chỉ **Batch A** (migration #1 → #15).  
**Không bao gồm:** #16–#22 (chỉ làm sau khi Batch A PASS).

---

## Bạn đang làm gì?

Bạn sẽ copy 15 file SQL từ repo, dán vào **Supabase SQL Editor** của project **Production**, rồi bấm **Run** — **một file mỗi lần**, đúng thứ tự.

Đây là bước chuẩn bị cơ sở dữ liệu (schema). **Không phải** deploy app, **không phải** bật thanh toán.

---

## ⚠️ Quy tắc bắt buộc — đọc trước khi bắt đầu

| Quy tắc | Giải thích |
|---------|------------|
| ✅ **Đúng project** | Chỉ chạy trên Production ref **`expuvcohlcjzvrrauvud`** |
| ❌ **Không dùng staging** | Ref `qyewbxjsiiyufanzcjcq` là staging — **DỪNG** nếu thấy ref này |
| ❌ **Không deploy Production app** | Gate 2 chỉ là SQL trên Supabase |
| ❌ **Không bật Production env flags** | Vercel env giữ nguyên — engineering sẽ bật sau Gate 3 |
| ❌ **Không bật payment live** | Phase 23 — chưa đến lúc |
| ❌ **Không chạy rollback khi lỗi** | Gặp ERROR → **DỪNG**, chụp màn hình, báo engineering |
| ❌ **Không chạy file seed staging** | Đặc biệt `supabase-staging-phase16-kn6-seed.sql` |
| ⛔ **Không làm #16–#22** | Chỉ sau khi Batch A verify A1–A5 **PASS** |

---

## Bước 0 — Xác nhận đúng Supabase Production

### Project bạn phải chọn

| Mục | Giá trị |
|-----|---------|
| **Tên project** | `pickleball-scheduler-production` |
| **Project ref (ID)** | **`expuvcohlcjzvrrauvud`** |
| **URL Supabase** | `https://expuvcohlcjzvrrauvud.supabase.co` |

### Cách kiểm tra (làm trước mỗi lần Run)

1. Mở trình duyệt → [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Đăng nhập tài khoản Supabase của bạn
3. Click chọn project **`pickleball-scheduler-production`**
4. Nhìn thanh địa chỉ trình duyệt — phải chứa chuỗi: **`expuvcohlcjzvrrauvud`**
5. Nếu thấy **`qyewbxjsiiyufanzcjcq`** → **DỪNG NGAY** — bạn đang ở staging, chọn lại project

**Tick xác nhận:**

| Mục | Tick | Ngày |
|-----|------|------|
| Tôi đã xác nhận URL chứa `expuvcohlcjzvrrauvud` | ☐ | |

---

## Bước 1 — Mở SQL Editor

1. Trong Supabase Dashboard (project Production ở trên)
2. Menu bên trái → click **SQL Editor**
3. Click nút **New query** (tạo query mới)
4. **Quy tắc:** Mỗi migration = **một query mới riêng** — không gộp nhiều file vào một lần Run

---

## Bước 2 — Cách chạy mỗi migration (lặp lại 15 lần)

Với **từng** migration #1 → #15, làm đúng thứ tự sau:

1. **Kiểm tra lại** URL có `expuvcohlcjzvrrauvud`
2. Trong repo GitHub hoặc máy tính, mở **đúng file SQL** (xem bảng chi tiết bên dưới)
3. Trong file đó: **Ctrl+A** (chọn hết) → **Ctrl+C** (copy)
4. Quay lại Supabase SQL Editor → **New query**
5. **Ctrl+V** (dán toàn bộ nội dung)
6. Click nút **Run** (hoặc **Ctrl+Enter**)
7. Đợi vài giây đến vài phút

### Kết quả Run — thấy gì là ĐÚNG?

- Panel kết quả hiện chữ **Success**
- Hoặc **No rows returned**
- Hoặc danh sách xanh: `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION`…
- **Không** có dòng đỏ bắt đầu bằng `ERROR:`

### Nếu thấy ERROR — làm gì?

1. **DỪNG** — không chạy migration tiếp theo (#N+1)
2. **Không** tự chạy file rollback
3. Chụp màn hình toàn bộ thông báo lỗi
4. Ghi lại: số migration (#), tên file SQL, nội dung lỗi
5. Liên hệ engineering — chờ hướng dẫn

---

## Danh sách Batch A — thứ tự bắt buộc (#1 → #15)

| # | File SQL | Rollback (chỉ tham khảo — không tự chạy) | Verify sau khi chạy |
|---|----------|--------------------------------------------|---------------------|
| 1 | `docs/supabase-club-v3.sql` | Không có | Spot #1 |
| 2 | `docs/supabase-rbac.sql` | Không có | Spot #2 |
| 3 | `docs/supabase-club-v3-rls.sql` | `docs/supabase-rls-rollback.sql` | Spot #3 |
| 4 | `docs/supabase-match-live.sql` | Không có | Spot #4 |
| 5 | `docs/supabase-match-live-rls.sql` | Không có | Spot #5 |
| 6 | `docs/supabase-security-hardening-v357.sql` | Không có | Spot #6 |
| 7 | `docs/supabase-match-live-v2.sql` | Không có | Spot #7 |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | `docs/supabase-identity-v40-sprint1-rollback.sql` | Spot #8 |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | `docs/supabase-identity-v40-phaseB-rollback.sql` | Spot #9 |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | `docs/supabase-identity-v40-phaseC-rollback.sql` | Spot #10 |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | `docs/supabase-multi-tenant-sprint2-rollback.sql` | Spot #11 |
| 12 | `docs/supabase-subscription-sprint4.sql` | Không có | Spot #12 |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | Không có | Spot #13 |
| 14 | `docs/supabase-mobile-sprint9.sql` | `docs/supabase-mobile-sprint9-rollback.sql` | Spot #14 |
| 15 | `docs/supabase-sprint10.sql` | `docs/supabase-sprint10-rollback.sql` | **A1 → A5 (bắt buộc)** |

> **Lưu ý rollback:** Cột Rollback chỉ để engineering biết file hoàn tác tồn tại. **Bạn không được tự chạy rollback** — kể cả khi có lỗi.

---

## Chi tiết từng migration

---

### Migration #1 — Club data v3

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#1** |
| **File SQL cần mở** | `docs/supabase-club-v3.sql` |
| **File rollback** | Không có |
| **Mục đích** | Tạo bảng lưu dữ liệu CLB (`club_data_v3`, `club_ai_data`) |

**Cách chạy:** Copy toàn bộ file → SQL Editor (Production) → Run.

**Verify ngay sau #1** — tạo New query, dán và Run:

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('club_data_v3', 'club_ai_data')
order by tablename;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **2 dòng** | `club_ai_data` và `club_data_v3` |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trên staging thay vì Production | Schema lệch giữa 2 môi trường — phải đối chiếu lại |
| Bỏ qua #1, chạy #2 trước | Migration sau có thể lỗi vì thiếu bảng nền |
| Gộp #1+#2 vào một lần Run | Khó xác định bước nào lỗi nếu fail |

| Tick | Ngày |
|------|------|
| ☐ #1 Success + Spot PASS | |

---

### Migration #2 — RBAC cơ bản

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#2** |
| **File SQL cần mở** | `docs/supabase-rbac.sql` |
| **File rollback** | Không có |
| **Mục đích** | Tạo bảng `venues`, `profiles`, `subscriptions`, `payment_events` và helper RBAC |

**Verify ngay sau #2:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'venues', 'subscriptions', 'payment_events')
order by tablename;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **4 dòng** | 4 bảng RBAC đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #1 | Có thể lỗi hoặc schema không đầy đủ |
| Nhầm project | Dữ liệu RBAC vào sai DB |

| Tick | Ngày |
|------|------|
| ☐ #2 Success + Spot PASS | |

---

### Migration #3 — RLS cho club data

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#3** |
| **File SQL cần mở** | `docs/supabase-club-v3-rls.sql` |
| **File rollback** | `docs/supabase-rls-rollback.sql` *(engineering only — không tự chạy)* |
| **Mục đích** | Bật Row Level Security (RLS) cho `club_data_v3` theo venue/club |

**Verify ngay sau #3:**

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename = 'club_data_v3';
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| 1 dòng, `rls_enabled = true` | RLS đã bật cho club data |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #1 | Lỗi — bảng `club_data_v3` chưa tồn tại |
| Tự chạy rollback khi lỗi | Có thể mở policy không an toàn — **cấm tự làm** |
| Bỏ qua #3 | Dữ liệu CLB không được bảo vệ theo venue |

| Tick | Ngày |
|------|------|
| ☐ #3 Success + Spot PASS | |

---

### Migration #4 — Match live

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#4** |
| **File SQL cần mở** | `docs/supabase-match-live.sql` |
| **File rollback** | Không có |
| **Mục đích** | Tạo bảng `tournament_match_live` (điểm trận đấu realtime) |

**Verify ngay sau #4:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename = 'tournament_match_live';
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **1 dòng** | Bảng match live đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Bỏ qua #4, chạy #5 | #5 lỗi vì thiếu bảng |
| Nhầm thứ tự với #7 | #7 bổ sung cột — cần #4 trước |

| Tick | Ngày |
|------|------|
| ☐ #4 Success + Spot PASS | |

---

### Migration #5 — RLS match live + RPC trọng tài

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#5** |
| **File SQL cần mở** | `docs/supabase-match-live-rls.sql` |
| **File rollback** | Không có |
| **Mục đích** | RLS cho match live + RPC `referee_get_match_by_token`, `referee_update_match_score` |

**Verify ngay sau #5:**

```sql
select proname from pg_proc
where proname in (
  'referee_get_match_by_token',
  'referee_update_match_score'
)
order by proname;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **2 dòng** | 2 RPC trọng tài đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #4 | Lỗi — thiếu bảng `tournament_match_live` |
| Bỏ qua #5 | Trọng tài không cập nhật điểm an toàn qua token |

| Tick | Ngày |
|------|------|
| ☐ #5 Success + Spot PASS | |

---

### Migration #6 — Security hardening v3.5.7

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#6** |
| **File SQL cần mở** | `docs/supabase-security-hardening-v357.sql` |
| **File rollback** | Không có |
| **Mục đích** | Khóa signup role PLAYER, bảo vệ cập nhật profile |

**Verify ngay sau #6** *(kiểm tra trigger/function tồn tại — không cần khớp tên cố định)*:

```sql
select count(*) as trigger_count
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'public'
  and c.relname in ('profiles');
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| Run **Success**, không ERROR | Migration hoàn tất |
| Query trên trả số ≥ 0 *(không lỗi)* | Bảng profiles còn tồn tại |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #2 | Lỗi — thiếu bảng `profiles` |
| Bỏ qua #6 | Lỗ hổng bảo mật signup/profile trên Production |

| Tick | Ngày |
|------|------|
| ☐ #6 Success | |

---

### Migration #7 — Match live v2

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#7** |
| **File SQL cần mở** | `docs/supabase-match-live-v2.sql` |
| **File rollback** | Không có |
| **Mục đích** | Thêm cột `stage_label`, `audit_log` cho match live |

**Verify ngay sau #7:**

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tournament_match_live'
  and column_name in ('stage_label', 'audit_log')
order by column_name;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **2 dòng** | 2 cột mới đã thêm |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #4 | Lỗi — thiếu bảng |
| Chạy #7 hai lần | Thường an toàn (idempotent) — nhưng vẫn ghi nhận và báo engineering nếu ERROR |

| Tick | Ngày |
|------|------|
| ☐ #7 Success + Spot PASS | |

---

### Migration #8 — Identity Sprint 1

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#8** |
| **File SQL cần mở** | `docs/supabase-identity-v40-sprint1.sql` |
| **File rollback** | `docs/supabase-identity-v40-sprint1-rollback.sql` *(engineering only)* |
| **Mục đích** | Bảng roles, permissions, `audit_logs` + seed quyền cơ bản |

**Verify ngay sau #8:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('roles', 'permissions', 'role_permissions', 'audit_logs')
order by tablename;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **4 dòng** | 4 bảng identity đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Bỏ qua #8, chạy #9/#10 | Migration identity sau sẽ lỗi |
| Tự rollback | Mất toàn bộ cấu trúc roles/permissions |

| Tick | Ngày |
|------|------|
| ☐ #8 Success + Spot PASS | |

---

### Migration #9 — Identity Phase B

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#9** |
| **File SQL cần mở** | `docs/supabase-identity-v40-phaseB.sql` |
| **File rollback** | `docs/supabase-identity-v40-phaseB-rollback.sql` *(engineering only)* |
| **Mục đích** | Cột audit bổ sung, bảng `password_reset_tokens` |

**Verify ngay sau #9:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename = 'password_reset_tokens';
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **1 dòng** | Bảng reset password đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #8 | Lỗi — thiếu nền identity |
| Bỏ qua #9 | Luồng auth Phase B thiếu schema |

| Tick | Ngày |
|------|------|
| ☐ #9 Success + Spot PASS | |

---

### Migration #10 — Identity Phase C

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#10** |
| **File SQL cần mở** | `docs/supabase-identity-v40-phaseC.sql` |
| **File rollback** | `docs/supabase-identity-v40-phaseC-rollback.sql` *(engineering only)* |
| **Mục đích** | RPC `identity_list_users`, `identity_admin_update_user`, `identity_list_audit_logs` |

**Verify ngay sau #10:**

```sql
select proname from pg_proc
where proname in (
  'identity_list_users',
  'identity_admin_update_user',
  'identity_list_audit_logs'
)
order by proname;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **3 dòng** | 3 RPC identity đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #8/#9 | Lỗi hoặc RPC không hoạt động |
| Bỏ qua #10 | Trang quản lý user / audit không có RPC backend |

| Tick | Ngày |
|------|------|
| ☐ #10 Success + Spot PASS | |

---

### Migration #11 — Multi-tenant Sprint 2

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#11** |
| **File SQL cần mở** | `docs/supabase-multi-tenant-sprint2.sql` |
| **File rollback** | `docs/supabase-multi-tenant-sprint2-rollback.sql` *(engineering only)* |
| **Mục đích** | View `tenants`, mở rộng `venues.status` |

**Verify ngay sau #11:**

```sql
select * from public.tenants limit 1;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| Chạy **không lỗi** | View `tenants` tồn tại (0 hoặc 1 dòng đều OK) |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #2 | Lỗi — thiếu bảng `venues` |
| Bỏ qua #11 | Billing/tenant mapping sau (#16+) thiếu view nền |

| Tick | Ngày |
|------|------|
| ☐ #11 Success + Spot PASS | |

---

### Migration #12 — Subscription Sprint 4

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#12** |
| **File SQL cần mở** | `docs/supabase-subscription-sprint4.sql` |
| **File rollback** | Không có |
| **Mục đích** | Cột `auto_renew`, `locked_at`, `last_renewed_at` trên `subscriptions` |

**Verify ngay sau #12:**

```sql
select column_name from information_schema.columns
where table_schema = 'public'
  and table_name = 'subscriptions'
  and column_name in ('auto_renew', 'locked_at', 'last_renewed_at')
order by column_name;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **3 dòng** | 3 cột subscription đã thêm |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #2 | Lỗi — thiếu bảng `subscriptions` |
| Bỏ qua #12 | Logic gia hạn/khóa gói thiếu cột DB |

| Tick | Ngày |
|------|------|
| ☐ #12 Success + Spot PASS | |

---

### Migration #13 — AI Assistant Sprint 7

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#13** |
| **File SQL cần mở** | `docs/supabase-ai-assistant-sprint7.sql` |
| **File rollback** | Không có |
| **Mục đích** | Bảng `ai_suggestions` + RLS *(app flag AI vẫn TẮT — không bật env)* |

**Verify ngay sau #13:**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'ai_suggestions';
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| 1 dòng, `rowsecurity = true` | Bảng AI + RLS đã sẵn sàng |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Tưởng phải bật `VITE_ENABLE_AI_ENGINE` | **Không** — Gate 2 chỉ SQL, không bật flag |
| Bỏ qua #13 | Verify A2 sau #15 thiếu bảng `ai_suggestions` |

| Tick | Ngày |
|------|------|
| ☐ #13 Success + Spot PASS | |

---

### Migration #14 — Mobile Sprint 9

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#14** |
| **File SQL cần mở** | `docs/supabase-mobile-sprint9.sql` |
| **File rollback** | `docs/supabase-mobile-sprint9-rollback.sql` *(engineering only)* |
| **Mục đích** | Push, notifications, `qr_tokens`, `checkins` *(bản baseline — hardening KN-6 ở #22, chưa làm)* |

**Verify ngay sau #14:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins', 'push_subscriptions', 'notifications')
order by tablename;
```

| Kết quả PASS kỳ vọng | Ý nghĩa |
|----------------------|---------|
| **4 dòng** | 4 bảng mobile đã tạo |

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Bỏ qua #14 | Migration #22 (sau này) **không** apply được |
| Tự rollback | Mất bảng QR/check-in mobile |

| Tick | Ngày |
|------|------|
| ☐ #14 Success + Spot PASS | |

---

### Migration #15 — Sprint 10 (API / marketplace)

| Mục | Nội dung |
|-----|----------|
| **Số migration** | **#15** |
| **File SQL cần mở** | `docs/supabase-sprint10.sql` |
| **File rollback** | `docs/supabase-sprint10-rollback.sql` *(engineering only)* |
| **Mục đích** | Bảng API, marketplace, payments, webhooks — **`tenant_id` kiểu text** |

**Verify ngay sau #15:** Không dùng spot đơn — chạy **đủ A1 → A5** ở mục bên dưới.

**Rủi ro nếu chạy sai:**

| Tình huống | Hậu quả |
|------------|---------|
| Chạy trước #11 | Có thể lỗi FK/view tenant |
| Bỏ qua #15, nhảy sang #16 | Batch B thiếu bảng Sprint 10 |
| Tự rollback | Xóa nhiều bảng API — **chỉ engineering** |

| Tick | Ngày |
|------|------|
| ☐ #15 Success | |

---

## Bước 3 — Verify Batch A (bắt buộc sau #15)

Chỉ chạy phần này **sau khi #1 → #15 đều Success**.  
Mỗi query = **New query** riêng trong SQL Editor (Production `expuvcohlcjzvrrauvud`).

Chi tiết đầy đủ cũng có trong: `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md`

---

### A1 — RLS enabled

**Dán và Run:**

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
  'profiles', 'venues', 'subscriptions', 'payment_events',
  'club_data_v3', 'tournament_match_live', 'audit_logs',
  'ai_suggestions', 'push_subscriptions', 'notifications',
  'qr_tokens', 'checkins', 'api_clients', 'api_keys'
)
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **14 dòng**, mọi dòng `rls_enabled = true` | Có bảng `false` hoặc thiếu bảng |

| Tick A1 | Ngày |
|---------|------|
| ☐ PASS | |

---

### A2 — Bảng Sprint 7–10 tồn tại

```sql
select tablename from pg_tables
where schemaname = 'public'
and tablename in (
  'ai_suggestions', 'push_subscriptions', 'notifications',
  'qr_tokens', 'checkins', 'api_clients', 'api_keys', 'api_logs',
  'marketplace_products', 'marketplace_orders', 'payment_transactions',
  'notification_logs', 'webhook_events'
)
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **13 dòng** (13 bảng) | Ít hơn 13 dòng |

| Tick A2 | Ngày |
|---------|------|
| ☐ PASS | |

---

### A3 — tenant_id kiểu text

```sql
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'api_clients', 'api_keys', 'api_logs',
    'marketplace_products', 'marketplace_orders', 'payment_transactions',
    'notification_logs', 'webhook_events'
  )
  and c.column_name = 'tenant_id'
order by c.table_name;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **8 dòng**, mọi dòng `data_type = text` | Kiểu khác `text` hoặc thiếu cột |

| Tick A3 | Ngày |
|---------|------|
| ☐ PASS | |

---

### A4 — RPC Identity & Referee (tổng hợp)

```sql
select proname from pg_proc
where proname in (
  'referee_get_match_by_token',
  'referee_update_match_score',
  'identity_list_users',
  'identity_admin_update_user',
  'identity_list_audit_logs'
)
order by proname;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **5 dòng** | Ít hơn 5 RPC |

| Tick A4 | Ngày |
|---------|------|
| ☐ PASS | |

---

### A5 — View tenants + subscription columns

**Query 1:**

```sql
select * from public.tenants limit 3;
```

**Query 2:**

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions'
and column_name in ('auto_renew', 'locked_at', 'last_renewed_at');
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| Query 1: chạy **không lỗi** (0–3 dòng OK) | ERROR khi query view |
| Query 2: **3 dòng** cột | Thiếu cột |

| Tick A5 | Ngày |
|---------|------|
| ☐ PASS | |

---

## Bước 4 — Kết luận Batch A

### Batch A PASS khi:

- ☐ #1 → #15 đều **Success** (không ERROR)
- ☐ A1, A2, A3, A4, A5 đều **PASS**

### Nếu A1–A5 có bất kỳ FAIL nào:

1. **DỪNG** — không chạy #16–#22
2. Ghi query nào FAIL + kết quả thực tế
3. Báo engineering

### Sau Batch A PASS — việc tiếp theo

| Việc | Làm ngay? |
|------|-----------|
| Apply #16–#22 (Batch B + C) | ⛔ **Chưa** — chờ tài liệu/hướng dẫn riêng |
| Deploy Production app | ⛔ **Không** |
| Bật env flags Production | ⛔ **Không** |
| Bật payment live | ⛔ **Không** |
| Báo engineering Gate 2 Batch A PASS | ✅ **Có** |

Engineering sẽ cập nhật:
- `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md`
- `GATE_2_PRODUCTION_SQL_READY_RUNBOOK.md`
- `GATE_2_PRODUCTION_SQL_READY_REPORT.md`

---

## Bảng tổng hợp tick — Batch A

| # | File | Success | Spot/Verify | Ngày |
|---|------|---------|-------------|------|
| 1 | `supabase-club-v3.sql` | ☐ | ☐ Spot #1 | |
| 2 | `supabase-rbac.sql` | ☐ | ☐ Spot #2 | |
| 3 | `supabase-club-v3-rls.sql` | ☐ | ☐ Spot #3 | |
| 4 | `supabase-match-live.sql` | ☐ | ☐ Spot #4 | |
| 5 | `supabase-match-live-rls.sql` | ☐ | ☐ Spot #5 | |
| 6 | `supabase-security-hardening-v357.sql` | ☐ | ☐ Success only | |
| 7 | `supabase-match-live-v2.sql` | ☐ | ☐ Spot #7 | |
| 8 | `supabase-identity-v40-sprint1.sql` | ☐ | ☐ Spot #8 | |
| 9 | `supabase-identity-v40-phaseB.sql` | ☐ | ☐ Spot #9 | |
| 10 | `supabase-identity-v40-phaseC.sql` | ☐ | ☐ Spot #10 | |
| 11 | `supabase-multi-tenant-sprint2.sql` | ☐ | ☐ Spot #11 | |
| 12 | `supabase-subscription-sprint4.sql` | ☐ | ☐ Spot #12 | |
| 13 | `supabase-ai-assistant-sprint7.sql` | ☐ | ☐ Spot #13 | |
| 14 | `supabase-mobile-sprint9.sql` | ☐ | ☐ Spot #14 | |
| 15 | `supabase-sprint10.sql` | ☐ | A1–A5 ☐ | |

| Verify cuối Batch A | PASS | Ngày |
|---------------------|------|------|
| A1 RLS | ☐ | |
| A2 Tables | ☐ | |
| A3 tenant_id text | ☐ | |
| A4 RPC | ☐ | |
| A5 tenants + subs | ☐ | |

**Batch A verdict:** ☐ PASS · ☐ FAIL · ☐ PENDING

**Owner signature:** ________________ **Date:** __________

---

## FAQ — câu hỏi thường gặp

**Hỏi: Tôi có cần backup trước không?**  
Trả lời: Production đang trên plan Free/Nano, DB trống — không có snapshot tự động. Engineering đã ghi nhận baseline empty (2026-07-04). Chỉ cần xác nhận đúng project ref.

**Hỏi: Chạy lại file đã chạy rồi có sao không?**  
Trả lời: Hầu hết file idempotent — thường an toàn. Nhưng nếu không chắc, **hỏi engineering** trước khi chạy lại.

**Hỏi: Run xong thấy "Success" nhưng có warning vàng?**  
Trả lời: Nếu **không** có `ERROR:` đỏ → thường OK. Ghi lại warning và báo engineering nếu lo lắng.

**Hỏi: Tôi lỡ chạy trên staging?**  
Trả lời: **DỪNG**. Ghi rõ đã chạy migration nào trên project nào. Báo engineering ngay — không tự sửa Production.

**Hỏi: Khi nào làm #16–#22?**  
Trả lời: **Sau khi Batch A PASS** (A1–A5). Engineering sẽ cung cấp hướng dẫn Batch B/C riêng.

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md` | Checklist tổng Gate 2 (#1–#22) |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | Copy-paste verify đầy đủ |
| `GATE_2_PRODUCTION_SQL_READY_RUNBOOK.md` | Runbook trạng thái migration |
| `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` | Chi tiết kỹ thuật batch A/B/C |

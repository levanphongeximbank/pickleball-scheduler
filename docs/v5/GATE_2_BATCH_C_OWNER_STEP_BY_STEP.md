# Gate 2 — Batch C: Hướng dẫn từng bước (#22)

**Dành cho:** Owner — không cần biết lập trình  
**Ngày:** 2026-07-04  
**Phạm vi tài liệu này:** Chỉ **Batch C** (migration **#22** — bước cuối Gate 2).  
**Tiền đề:** Batch A (#1–#15) ✅ PASS · Batch B (#16–#21) ✅ PASS · V21-1→V21-8 ✅ PASS.

---

## Bạn đang làm gì?

Bạn sẽ copy **1 file SQL** từ repo, dán vào **Supabase SQL Editor** của project **Production**, rồi bấm **Run**.

File này **siết chặt bảo mật** cho tính năng **QR check-in** trên mobile (bảng `qr_tokens` và `checkins`). Đây là migration **cuối cùng** của Gate 2.

**Không phải** deploy app · **Không phải** bật thanh toán · **Không phải** bật env flags trên Vercel.

---

## ⚠️ Quy tắc bắt buộc — đọc trước khi bắt đầu

| Quy tắc | Giải thích |
|---------|------------|
| ✅ **Tiền đề Batch B** | #16–#21 Success + B1–B4 + V21-1→V21-8 PASS |
| ✅ **Đúng project** | Chỉ chạy trên Production ref **`expuvcohlcjzvrrauvud`** |
| ❌ **Không dùng staging** | Ref `qyewbxjsiiyufanzcjcq` — **DỪNG** nếu thấy ref này |
| ❌ **Không deploy Production app** | Gate 2 chỉ là SQL trên Supabase |
| ❌ **Không bật Production env flags** | `VITE_BILLING_SUPABASE`, `VITE_API_ENABLED`, v.v. — engineering bật sau Gate 3 |
| ❌ **Không bật payment live** | Phase 23 — chưa đến lúc |
| ❌ **Không chạy rollback khi lỗi** | Gặp ERROR → **DỪNG**, chụp màn hình, báo engineering |
| ⛔ **KHÔNG chạy file rollback** | `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` — **CẤM** trên Production |
| ❌ **Không chạy file seed staging** | `docs/supabase-staging-phase16-kn6-seed.sql` — chỉ dùng trên staging |

---

## Bước 0 — Xác nhận đúng Supabase Production

| Mục | Giá trị |
|-----|---------|
| **Tên project** | `pickleball-scheduler-production` |
| **Project ref (ID)** | **`expuvcohlcjzvrrauvud`** |
| **URL Supabase** | `https://expuvcohlcjzvrrauvud.supabase.co` |

### Cách kiểm tra (làm trước khi Run)

1. Mở [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project **`pickleball-scheduler-production`**
3. URL trình duyệt phải chứa **`expuvcohlcjzvrrauvud`**
4. Nếu thấy **`qyewbxjsiiyufanzcjcq`** → **DỪNG NGAY**

| Mục | Tick | Ngày |
|-----|------|------|
| Tôi đã xác nhận URL chứa `expuvcohlcjzvrrauvud` | ☐ | |
| Batch A (#1–#15 + A1–A5) đã PASS | ✅ | 2026-07-04 |
| Batch B (#16–#21 + B1–B4 + V21) đã PASS | ✅ | 2026-07-04 |

---

## Bước 1 — Mở SQL Editor

1. Trong Supabase Dashboard (project Production)
2. Menu trái → **SQL Editor**
3. Click **New query**

---

## Bước 2 — Apply migration #22

### File cần chạy (DUY NHẤT)

| # | File SQL | Mục đích |
|---|----------|----------|
| **22** | **`docs/supabase-phase16-kn6-qr-checkins-rls.sql`** | Siết RLS cho QR check-in (KN-6) |

### File KHÔNG được chạy

| File | Lý do |
|------|-------|
| **`docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql`** | ⛔ **CẤM** — file này **mở lại** bảo mật cũ (cho phép mọi user đọc/ghi). Chỉ dùng staging/dev. **Không bao giờ** chạy trên Production. |
| `docs/supabase-staging-phase16-kn6-seed.sql` | Chỉ dùng staging QA |

### Cách chạy (từng bước)

1. **Kiểm tra lại** URL có `expuvcohlcjzvrrauvud`
2. Trong repo, mở file **`docs/supabase-phase16-kn6-qr-checkins-rls.sql`**
3. **Ctrl+A** → **Ctrl+C** (copy toàn bộ nội dung file)
4. Quay lại Supabase SQL Editor → **New query**
5. **Ctrl+V** (dán)
6. Click **Run** (hoặc **Ctrl+Enter**)
7. Đợi vài giây

### Kết quả Run — thấy gì là ĐÚNG?

- **Success** / **No rows returned**
- Có thể thấy danh sách xanh: `ALTER TABLE`, `DROP POLICY`, `CREATE POLICY`, `COMMENT ON POLICY`
- **Không** có dòng đỏ `ERROR:`

### Nếu thấy ERROR

1. **DỪNG** — không chạy file khác
2. **Không** tự chạy rollback (`supabase-phase16-kn6-qr-checkins-rls-rollback.sql`)
3. Chụp màn hình + ghi nội dung lỗi
4. Liên hệ engineering

| Tick | Ngày |
|------|------|
| ☐ #22 Success (không ERROR) | |

---

## Bước 3 — Verify C0 → C7 (bắt buộc sau #22)

Chỉ chạy **sau khi #22 Success**.  
Mỗi query = **New query** riêng trong SQL Editor.  
Chi tiết đầy đủ cũng có trong `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md`.

---

### C0 — Functions + tables (nền tảng QR check-in)

**Mục đích:** Xác nhận hàm bảo mật và 2 bảng QR tồn tại.

```sql
select proname from pg_proc
where proname in ('user_venue_id', 'is_super_admin')
order by proname;

select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| Query 1: **2 dòng** (`is_super_admin`, `user_venue_id`) | Ít hơn 2 |
| Query 2: **2 dòng** (`checkins`, `qr_tokens`) | Thiếu bảng |

| Tick C0 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C1 — RLS enabled (bảo mật đã bật)

**Mục đích:** Cả 2 bảng phải bật Row Level Security.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **2 dòng**, mỗi dòng `rowsecurity = true` | `false` hoặc thiếu bảng |

| Tick C1 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C2 — Policy count (đủ quy tắc truy cập)

**Mục đích:** Đếm số policy bảo mật trên mỗi bảng.

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
group by tablename
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| `checkins` = **2** policies | Khác 2 |
| `qr_tokens` = **3** policies | Khác 3 |

| Tick C2 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C3 — No open policies (không có cửa hở)

**Mục đích:** Không có policy cho phép mọi người truy cập (`USING (true)`).

```sql
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and (
    qual::text ilike '%true%'
    or with_check::text ilike '%true%'
  )
order by tablename, policyname;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **0 dòng** | Có dòng (policy mở) |

| Tick C3 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C4 — No legacy policies (đã xóa policy cũ)

**Mục đích:** Policy cũ kiểu `*_authenticated` (mở toàn bộ) đã bị thay thế.

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and policyname like '%_authenticated'
order by tablename, policyname;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **0 dòng** | Còn policy tên `*_authenticated` |

| Tick C4 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C5 — No anon policy (khách vãng lai không truy cập)

**Mục đích:** Role `anon` (chưa đăng nhập) không được đọc/ghi QR data.

```sql
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and 'anon' = any(roles)
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **0 dòng** | Có policy cho `anon` |

| Tick C5 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C6 — Policy comments (đánh dấu KN-6)

**Mục đích:** Policy mới có comment ghi nhận Phase 16 KN-6.

```sql
select
  cls.relname as table_name,
  pol.polname as policy_name,
  pg_catalog.obj_description(pol.oid, 'pg_policy') as policy_comment
from pg_policy pol
join pg_class cls on pol.polrelid = cls.oid
join pg_namespace nsp on cls.relnamespace = nsp.oid
where nsp.nspname = 'public'
  and cls.relname in ('qr_tokens', 'checkins')
  and pol.polname in ('qr_tokens_select', 'checkins_select');
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **2 dòng**, comment chứa `Phase 16 KN-6` hoặc `tenant isolation` | Thiếu comment hoặc sai nội dung |

| Tick C6 | Ngày |
|---------|------|
| ☐ PASS | |

---

### C7 — Regression #15–#21 (không phá schema cũ)

**Mục đích:** Sau #22, billing và integration audit vẫn nguyên vẹn.

```sql
select count(*) as integration_audit_cols
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name = 'event_type';

select count(*) as billing_plans
from public.plans
where code in ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| Query 1: `integration_audit_cols = 1` | = 0 |
| Query 2: `billing_plans = 4` | < 4 |

| Tick C7 | Ngày |
|---------|------|
| ☐ PASS | |

---

### Nếu C0–C7 có FAIL

1. **DỪNG** — không deploy, không bật env
2. Ghi query nào FAIL + kết quả thực tế
3. **Không** tự chạy rollback
4. Báo engineering

---

## Bước 4 — Kết luận Batch C và Gate 2

### Batch C PASS khi:

- ☐ #22 **Success** (không ERROR)
- ☐ C0, C1, C2, C3, C4, C5, C6, C7 đều **PASS**

### Sau Batch C PASS — Gate 2 PASS

Khi **#22 Success + C0→C7 PASS**, toàn bộ **22/22 migrations** đã apply. Báo engineering để cập nhật report → **Gate 2 PASS**.

| Việc | Làm ngay? |
|------|-----------|
| Báo engineering Batch C PASS | ✅ **Có** — kích hoạt Gate 2 PASS |
| Deploy Production app | ⛔ **Không** — Gate 3 |
| Bật `VITE_BILLING_SUPABASE` / env flags | ⛔ **Không** — Gate 3 |
| Bật payment live | ⛔ **Không** — Phase 23 |
| Sang Gate 3 Production Preflight | ⏳ **Sau** khi engineering xác nhận Gate 2 PASS |

---

## Bảng tổng hợp tick — Batch C

| # | File | Success | Verify | Ngày |
|---|------|---------|--------|------|
| 22 | `supabase-phase16-kn6-qr-checkins-rls.sql` | ☐ | C0–C7 ☐ | |

| Verify Batch C | PASS | Ngày |
|----------------|------|------|
| C0 Functions + tables | ☐ | |
| C1 RLS enabled | ☐ | |
| C2 Policy count | ☐ | |
| C3 No open policies | ☐ | |
| C4 No legacy policies | ☐ | |
| C5 No anon policy | ☐ | |
| C6 Policy comments | ☐ | |
| C7 Regression #15–#21 | ☐ | |

**Batch C verdict:** ☐ PASS · ☐ FAIL · ☐ PENDING

**Owner signature:** ________________ **Date:** __________

---

## FAQ

**Hỏi: Tôi có được chạy #22 chưa?**  
Trả lời: **Có.** Batch B đã PASS (V21-1→V21-8 OK). Đây là bước tiếp theo.

**Hỏi: File #22 chính xác là gì?**  
Trả lời: **`docs/supabase-phase16-kn6-qr-checkins-rls.sql`** — copy toàn bộ, dán SQL Editor, Run **một lần**.

**Hỏi: Nếu lỗi, tôi chạy file rollback được không?**  
Trả lời: **Không.** File `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` **cấm** trên Production — nó mở lại lỗ hổng bảo mật. Gặp ERROR → DỪNG, chụp màn hình, báo engineering.

**Hỏi: Apply #22 có bật QR check-in trên app không?**  
Trả lời: **Không.** Chỉ siết bảo mật database. App Production vẫn chưa deploy; env flags vẫn TẮT.

**Hỏi: Sau #22 PASS thì Gate 2 có PASS không?**  
Trả lời: **Có** — nếu C0→C7 cũng PASS. Đó là điều kiện cuối của Gate 2 (22/22 migrations).

**Hỏi: Staging đã PASS #22 — có cần verify lại không?**  
Trả lời: **Có.** Production phải verify riêng C0→C7 trên `expuvcohlcjzvrrauvud`.

**Hỏi: `public.venues = 0` có sao không?**  
Trả lời: **Vẫn OK** cho schema verify. C0→C7 chạy qua SQL Editor, không cần dữ liệu venue thật.

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md` | Batch B — đã PASS |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | C0–C7 copy-paste |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | Verdict Gate 2 |
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | Spec C0–C7 |
| `PHASE_16_KN6_RLS_QA.md` | Staging evidence #22 |

# Gate 2 — Batch B: Hướng dẫn từng bước (#16 → #21)

**Dành cho:** Owner — không cần biết lập trình  
**Ngày:** 2026-07-04  
**Phạm vi tài liệu này:** Chỉ **Batch B** (migration #16 → #21).  
**Tiền đề:** Batch A (#1–#15) đã **PASS** — A1–A5 OK trên Production.

---

## Bạn đang làm gì?

Bạn sẽ copy **6 file SQL** từ repo, dán vào **Supabase SQL Editor** của project **Production**, rồi bấm **Run** — **một file mỗi lần**, đúng thứ tự #16 → #21.

Đây là bước chuẩn bị schema **billing** và **platform API**. **Không phải** deploy app, **không phải** bật thanh toán thật, **không phải** bật env flags trên Vercel.

---

## ⚠️ Quy tắc bắt buộc — đọc trước khi bắt đầu

| Quy tắc | Giải thích |
|---------|------------|
| ✅ **Tiền đề Batch A** | #1–#15 đã Success + A1–A5 PASS |
| ✅ **Đúng project** | Chỉ chạy trên Production ref **`expuvcohlcjzvrrauvud`** |
| ❌ **Không dùng staging** | Ref `qyewbxjsiiyufanzcjcq` — **DỪNG** nếu thấy ref này |
| ❌ **Không deploy Production app** | Gate 2 chỉ là SQL trên Supabase |
| ❌ **Không bật Production env flags** | `VITE_BILLING_SUPABASE`, `VITE_API_ENABLED`, v.v. — engineering bật sau Gate 3 |
| ❌ **Không bật payment live** | Phase 23 — chưa đến lúc |
| ❌ **Không chạy rollback khi lỗi** | Gặp ERROR → **DỪNG**, chụp màn hình, báo engineering |
| ⛔ **Không làm #22** | Chỉ sau khi #21 verify **V21-1 → V21-8 PASS** |

---

## Bước 0 — Xác nhận đúng Supabase Production

| Mục | Giá trị |
|-----|---------|
| **Tên project** | `pickleball-scheduler-production` |
| **Project ref (ID)** | **`expuvcohlcjzvrrauvud`** |
| **URL Supabase** | `https://expuvcohlcjzvrrauvud.supabase.co` |

### Cách kiểm tra (làm trước mỗi lần Run)

1. Mở [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project **`pickleball-scheduler-production`**
3. URL trình duyệt phải chứa **`expuvcohlcjzvrrauvud`**
4. Nếu thấy **`qyewbxjsiiyufanzcjcq`** → **DỪNG NGAY**

| Mục | Tick | Ngày |
|-----|------|------|
| Tôi đã xác nhận URL chứa `expuvcohlcjzvrrauvud` | ☐ | |
| Batch A (#1–#15 + A1–A5) đã PASS | ✅ | 2026-07-04 |

---

## Bước 1 — Mở SQL Editor

1. Trong Supabase Dashboard (project Production)
2. Menu trái → **SQL Editor**
3. Click **New query**
4. Mỗi migration = **một query mới** — không gộp nhiều file

---

## Bước 2 — Cách chạy mỗi migration (lặp lại 6 lần)

Với **từng** migration #16 → #21:

1. **Kiểm tra lại** URL có `expuvcohlcjzvrrauvud`
2. Mở **đúng file SQL** (bảng bên dưới)
3. **Ctrl+A** → **Ctrl+C** (copy toàn bộ)
4. SQL Editor → **New query** → **Ctrl+V**
5. Click **Run** (hoặc **Ctrl+Enter**)
6. Đợi kết quả

### Kết quả Run — thấy gì là ĐÚNG?

- **Success** / **No rows returned** / danh sách xanh `CREATE TABLE`, `CREATE POLICY`…
- **Không** có dòng đỏ `ERROR:`

### Nếu thấy ERROR

1. **DỪNG** — không chạy migration tiếp theo
2. **Không** tự chạy rollback
3. Chụp màn hình + ghi số migration (#) và nội dung lỗi
4. Liên hệ engineering

---

## Danh sách Batch B — thứ tự bắt buộc (#16 → #21)

| # | File SQL | Rollback *(engineering only)* | Verify sau khi chạy |
|---|----------|-------------------------------|---------------------|
| 16 | `docs/supabase-billing-phase9.sql` | `docs/supabase-billing-phase9-rollback.sql` | Spot #16 |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | `docs/supabase-billing-phase9-trial-rpc-rollback.sql` | Spot #17 |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | `docs/supabase-sprint10-phase11a-rollback.sql` | Spot #18 |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | `docs/supabase-sprint10-phase11b-rollback.sql` | Spot #19 |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | `docs/supabase-sprint10-phase11c-rollback.sql` | Spot #20 → **B1–B4** |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | `docs/supabase-sprint10-phase11e-rollback.sql` | **V21-1 → V21-8** |

> **Lưu ý:** Sau #16–#20 xong, chạy **B1–B4** trước khi apply #21. Sau #21, chạy **V21-1 → V21-8** — đây là **cổng bắt buộc** trước #22.

---

## Chi tiết từng migration

---

### Migration #16 — Billing Phase 9 (plans, subscriptions, invoices)

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-billing-phase9.sql` |
| **Mục đích** | Tạo 8 bảng billing + seed 4 gói (TRIAL, STARTER, PROFESSIONAL, ENTERPRISE) |

**Verify ngay sau #16:**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'plan_limits', 'tenant_subscriptions', 'invoices',
    'invoice_items', 'payments', 'billing_events', 'billing_audit_logs'
  )
order by table_name;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **8 dòng** | Ít hơn 8 bảng |

| Tick | Ngày |
|------|------|
| ☐ #16 Success + Spot PASS | |

---

### Migration #17 — Trial RPC

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-billing-phase9-trial-rpc.sql` |
| **Mục đích** | RPC `billing_create_trial_subscription` — onboarding trial |

**Verify ngay sau #17:**

```sql
select proname from pg_proc
where proname = 'billing_create_trial_subscription';
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **1 dòng** | 0 dòng |

| Tick | Ngày |
|------|------|
| ☐ #17 Success + Spot PASS | |

---

### Migration #18 — Sprint 10 Phase 11A RLS

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-sprint10-phase11a-rls.sql` |
| **Mục đích** | RLS hardened cho bảng Sprint 10 + bảng `webhook_endpoints` |

**Verify ngay sau #18:**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'webhook_endpoints';
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| 1 dòng, `rowsecurity = true` | Không có bảng hoặc RLS tắt |

| Tick | Ngày |
|------|------|
| ☐ #18 Success + Spot PASS | |

---

### Migration #19 — Phase 11B persistence

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-sprint10-phase11b-persistence.sql` |
| **Mục đích** | Bảng `tenant_integration_settings`, `integration_audit_logs` |

**Verify ngay sau #19:**

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('tenant_integration_settings', 'integration_audit_logs')
order by tablename;
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| **2 dòng** | Thiếu bảng |

| Tick | Ngày |
|------|------|
| ☐ #19 Success + Spot PASS | |

---

### Migration #20 — Phase 11C API key guard

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-sprint10-phase11c-api-key-guard.sql` |
| **Mục đích** | Thêm cột `expires_at` trên `api_keys` |

**Verify ngay sau #20:**

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_keys'
  and column_name = 'expires_at';
```

| PASS kỳ vọng | FAIL nếu |
|--------------|----------|
| 1 dòng, `data_type` có giá trị (thường `timestamp with time zone`) | 0 dòng |

| Tick | Ngày |
|------|------|
| ☐ #20 Success + Spot PASS | |

---

## Bước 3 — Verify Batch B phần 1 (bắt buộc sau #16–#20)

Chỉ chạy **sau khi #16 → #20 đều Success**.  
Mỗi query = **New query** riêng. Chi tiết đầy đủ: `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md`

---

### B1 — Billing tables (8 bảng)

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'plan_limits', 'tenant_subscriptions', 'invoices',
    'invoice_items', 'payments', 'billing_events', 'billing_audit_logs'
  )
order by table_name;
```

| PASS | FAIL nếu |
|------|----------|
| **8 dòng** | Ít hơn 8 |

| Tick B1 | Ngày |
|---------|------|
| ☐ PASS | |

---

### B2 — Plan seed (4 gói)

```sql
select code, name, is_active from public.plans
where code in ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')
order by sort_order;
```

| PASS | FAIL nếu |
|------|----------|
| **4 dòng** | Ít hơn 4 |

| Tick B2 | Ngày |
|---------|------|
| ☐ PASS | |

---

### B3 — Trial RPC

```sql
select proname, proargnames
from pg_proc
where proname = 'billing_create_trial_subscription';
```

| PASS | FAIL nếu |
|------|----------|
| **1 dòng** | 0 dòng |

| Tick B3 | Ngày |
|---------|------|
| ☐ PASS | |

---

### B4 — Phase 11 tables + RLS + expires_at

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'webhook_endpoints', 'tenant_integration_settings', 'integration_audit_logs'
  )
order by tablename;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_keys'
  and column_name = 'expires_at';
```

| PASS | FAIL nếu |
|------|----------|
| 3 bảng, mọi dòng `rowsecurity = true` | RLS tắt hoặc thiếu bảng |
| Query 2: **1 dòng** `expires_at` | Thiếu cột |

| Tick B4 | Ngày |
|---------|------|
| ☐ PASS | |

---

### Nếu B1–B4 có FAIL

1. **DỪNG** — không apply #21
2. Ghi query nào FAIL + kết quả thực tế
3. Báo engineering

---

## Bước 4 — Migration #21 (Integration audit 11E)

**Chỉ apply sau B1–B4 PASS.**

| Mục | Nội dung |
|-----|----------|
| **File SQL** | `docs/supabase-sprint10-phase11e-integration-audit.sql` |
| **Mục đích** | Cột audit đầy đủ, indexes, RLS policies cho `integration_audit_logs` |

1. Copy file → SQL Editor (Production) → Run
2. Kết quả phải **Success**, không ERROR

| Tick | Ngày |
|------|------|
| ☐ #21 Success | |

---

## Bước 5 — Verify V21 (bắt buộc sau #21) — cổng trước #22

Mở `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md` → mục **V21-1 → V21-8**.  
Chạy **từng query** trong SQL Editor (Production). Mỗi query phải khớp cột "Kỳ vọng".

| Check | Mô tả ngắn | Tick PASS | Ngày |
|-------|------------|-----------|------|
| V21-1 | 14 cột schema `integration_audit_logs` | ☐ | |
| V21-2 | Legacy nullable (`action`, `meta`) nếu có | ☐ | |
| V21-3 | 5 indexes 11E | ☐ | |
| V21-4 | RLS enabled + policies | ☐ | |
| V21-5 | Table/policy comments Phase 11E | ☐ | |
| V21-6 | `event_type` không null (count = 0) | ☐ | |
| V21-7 | Regression billing + tenant_id text | ☐ | |
| V21-8 | Không cột raw API key | ☐ | |

**Ghi thêm (tùy chọn):**

```sql
select count(*) as venue_count from public.venues;
```

Số có thể = 0 trên DB mới — vẫn OK cho schema verify.

### Nếu V21 có FAIL

1. **DỪNG** — **không** apply #22
2. Báo engineering với query FAIL + kết quả

---

## Bước 6 — Kết luận Batch B

### Batch B PASS khi:

- ☐ #16 → #21 đều **Success** (không ERROR)
- ☐ B1, B2, B3, B4 đều **PASS**
- ☐ V21-1 → V21-8 đều **PASS**

### Sau Batch B PASS — việc tiếp theo

| Việc | Làm ngay? |
|------|-----------|
| Apply **#22** (Batch C — KN-6 RLS) | ⛔ **Chỉ sau V21 PASS** — engineering sẽ cung cấp hướng dẫn Batch C |
| Deploy Production app | ⛔ **Không** |
| Bật `VITE_BILLING_SUPABASE` / env flags | ⛔ **Không** — Gate 3 |
| Bật payment live | ⛔ **Không** — Phase 23 |
| Báo engineering Batch B PASS | ✅ **Có** |

Engineering sẽ cập nhật `GATE_2_PRODUCTION_SQL_READY_REPORT.md` và runbook.

---

## Bảng tổng hợp tick — Batch B

| # | File | Success | Verify | Ngày |
|---|------|---------|--------|------|
| 16 | `supabase-billing-phase9.sql` | ☐ | ☐ Spot #16 | |
| 17 | `supabase-billing-phase9-trial-rpc.sql` | ☐ | ☐ Spot #17 | |
| 18 | `supabase-sprint10-phase11a-rls.sql` | ☐ | ☐ Spot #18 | |
| 19 | `supabase-sprint10-phase11b-persistence.sql` | ☐ | ☐ Spot #19 | |
| 20 | `supabase-sprint10-phase11c-api-key-guard.sql` | ☐ | B1–B4 ☐ | |
| 21 | `supabase-sprint10-phase11e-integration-audit.sql` | ☐ | V21-1→8 ☐ | |

| Verify Batch B | PASS | Ngày |
|----------------|------|------|
| B1 Billing tables | ☐ | |
| B2 Plan seed | ☐ | |
| B3 Trial RPC | ☐ | |
| B4 Phase 11 + expires_at | ☐ | |
| V21-1 → V21-8 | ☐ | |

**Batch B verdict:** ☐ PASS · ☐ FAIL · ☐ PENDING

**Owner signature:** ________________ **Date:** __________

---

## FAQ

**Hỏi: Apply billing SQL có nghĩa là bật thanh toán không?**  
Trả lời: **Không.** Chỉ tạo bảng/schema. Payment live và env billing vẫn **TẮT** cho đến Gate 3/5.

**Hỏi: Tôi có cần bật `VITE_BILLING_SUPABASE` trên Vercel không?**  
Trả lời: **Không** trong Gate 2. Engineering bật sau khi Gate 2 + Gate 3 hoàn tất.

**Hỏi: Khi nào làm #22?**  
Trả lời: **Sau khi V21-1 → V21-8 PASS.** Không skip.

**Hỏi: Staging đã PASS #21/#22 — có cần verify lại không?**  
Trả lời: **Có.** Production phải verify riêng trên `expuvcohlcjzvrrauvud`.

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_2_BATCH_A_OWNER_STEP_BY_STEP.md` | Batch A — đã PASS |
| `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md` | Checklist tổng #1–#22 |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | B1–B4, V21-1→8 copy-paste |
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | Spec V21 + thứ tự #22 |

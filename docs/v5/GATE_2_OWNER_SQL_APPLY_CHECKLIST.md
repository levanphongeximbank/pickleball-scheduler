# Gate 2 — Owner SQL Apply Checklist

**Dành cho:** Owner / DevOps — không cần biết lập trình  
**Ngày:** 2026-07-04  
**Mục tiêu:** Apply 22 file SQL lên Supabase **Production** theo đúng thứ tự

---

## Trước khi bắt đầu — đọc kỹ

| Quy tắc | Giải thích |
|---------|------------|
| ✅ Project đúng | **`pickleball-scheduler-production`** — ref `expuvcohlcjzvrrauvud` |
| ❌ Không dùng staging | Ref `qyewbxjsiiyufanzcjcq` là **staging** — Gate 1 đã xong ở đó |
| ❌ Không deploy Production app | Chỉ SQL trong Gate 2 |
| ❌ Không bật payment live | Phase 23 |
| ❌ Không chạy rollback | Trừ khi engineering hướng dẫn |
| ❌ Không chạy file seed staging | Đặc biệt `supabase-staging-phase16-kn6-seed.sql` |

---

## Bước 0 — Xác nhận đúng project

1. Mở trình duyệt → [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project **`pickleball-scheduler-production`**
3. Kiểm tra URL có chứa: **`expuvcohlcjzvrrauvud`**
4. Nếu thấy **`qyewbxjsiiyufanzcjcq`** → **DỪNG**, chọn lại project

**Ghi vào đây:**

| Mục | Tick | Ngày |
|-----|------|------|
| Đã xác nhận Production project ref | ☐ | |

---

## Bước 1 — Mở SQL Editor

1. Trong Supabase Dashboard (Production)
2. Menu trái → **SQL Editor**
3. Click **New query**
4. Mỗi migration = **một query mới** (không gộp nhiều file)

---

## Bước 2 — Apply từng migration (#1 → #22)

**Cách làm mỗi migration:**

1. Trong repo (hoặc GitHub), mở file SQL tương ứng (xem bảng dưới)
2. **Select All** → **Copy** toàn bộ nội dung
3. Dán vào SQL Editor (Production)
4. Click **Run** (hoặc Ctrl+Enter)
5. Đợi kết quả

**Run xong thấy gì là đúng:**
- Panel kết quả hiện **Success** / **No rows returned** / danh sách `CREATE TABLE`, `CREATE POLICY`…
- **Không** có dòng đỏ `ERROR:`

**Nếu thấy ERROR:**
- **DỪNG** — không chạy migration tiếp theo
- Chụp màn hình lỗi
- Ghi số migration (#) và nội dung lỗi
- Liên hệ engineering — **không** tự chạy rollback

---

### Batch A — #1 đến #15 (chạy trước)

| # | Mở file này trong repo | Tick khi Success | Ngày |
|---|------------------------|------------------|------|
| 1 | `docs/supabase-club-v3.sql` | ☐ | |
| 2 | `docs/supabase-rbac.sql` | ☐ | |
| 3 | `docs/supabase-club-v3-rls.sql` | ☐ | |
| 4 | `docs/supabase-match-live.sql` | ☐ | |
| 5 | `docs/supabase-match-live-rls.sql` | ☐ | |
| 6 | `docs/supabase-security-hardening-v357.sql` | ☐ | |
| 7 | `docs/supabase-match-live-v2.sql` | ☐ | |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | ☐ | |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | ☐ | |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | ☐ | |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | ☐ | |
| 12 | `docs/supabase-subscription-sprint4.sql` | ☐ | |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | ☐ | |
| 14 | `docs/supabase-mobile-sprint9.sql` | ☐ | |
| 15 | `docs/supabase-sprint10.sql` | ☐ | |

**Sau #15 — bắt buộc verify Batch A:**

1. Mở `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md`
2. Chạy lần lượt **A1, A2, A3, A4, A5** trong SQL Editor (Production)
3. So sánh kết quả với cột "Kỳ vọng" trong file đó
4. Nếu A1–A5 đều đúng → tick bảng dưới

| Verify | Tick PASS | Ngày |
|--------|-----------|------|
| A1 RLS enabled | ☐ | |
| A2 Sprint 7–10 tables | ☐ | |
| A3 tenant_id = text | ☐ | |
| A4 RPC Identity + Referee | ☐ | |
| A5 tenants view + subscription cols | ☐ | |

**Ghi PASS vào:** tick ở bảng trên + cập nhật `GATE_2_PRODUCTION_SQL_READY_RUNBOOK.md` (cột PASS/FAIL/PENDING) nếu engineering hướng dẫn.

---

### Batch B — #16 đến #21 (chỉ sau Batch A PASS)

| # | Mở file này | Tick khi Success | Ngày |
|---|-------------|------------------|------|
| 16 | `docs/supabase-billing-phase9.sql` | ☐ | |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | ☐ | |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | ☐ | |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | ☐ | |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | ☐ | |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | ☐ | |

**Sau #16–#20 — verify Batch B (trước #21 gate):**

| Verify | Tick PASS | Ngày |
|--------|-----------|------|
| B1 Billing tables (8 bảng) | ☐ | |
| B2 Plan seed (4 plans) | ☐ | |
| B3 Trial RPC | ☐ | |
| B4 Phase 11 tables + expires_at | ☐ | |

**Sau #21 — bắt buộc verify V21 (gate quan trọng):**

1. Mở `GATE_2_SQL_VERIFICATION_QUERIES.md` → mục **V21-1 → V21-8**
2. Chạy từng query; mỗi query phải PASS
3. Chạy thêm: `select count(*) from public.venues;` — ghi số (có thể = 0)

| Check | Tick PASS | Ngày |
|-------|-----------|------|
| V21-1 Schema columns | ☐ | |
| V21-2 Legacy nullable | ☐ | |
| V21-3 Indexes 11E | ☐ | |
| V21-4 RLS + policies | ☐ | |
| V21-5 Comments | ☐ | |
| V21-6 Backfill OK | ☐ | |
| V21-7 Regression #15–#20 | ☐ | |
| V21-8 No raw API key cols | ☐ | |

**⛔ Chỉ apply #22 khi V21-1 → V21-8 đều PASS.**

---

### Batch C — #22 (chỉ sau #21 PASS)

| # | Mở file này | Tick khi Success | Ngày |
|---|-------------|------------------|------|
| 22 | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | ☐ | |

**Sau #22 — verify C0 → C7:**

| Check | Tick PASS | Ngày |
|-------|-----------|------|
| C0 Functions + tables | ☐ | |
| C1 RLS enabled | ☐ | |
| C2 Policy count (3 + 2) | ☐ | |
| C3 No open policies | ☐ | |
| C4 No legacy *_authenticated | ☐ | |
| C5 No anon policy | ☐ | |
| C6 Policy comments KN-6 | ☐ | |
| C7 Regression #15–#21 | ☐ | |

---

## Bước 3 — Ghi kết quả

Sau khi hoàn tất (hoặc dừng giữa chừng), báo engineering cập nhật:

| File | Ghi gì |
|------|--------|
| Checklist này | Tick + ngày từng migration |
| `GATE_2_PRODUCTION_SQL_READY_RUNBOOK.md` | Cột PASS/FAIL/PENDING |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | Verdict Gate 2 |

---

## Khi lỗi — dừng ở đâu

| Tình huống | Hành động |
|------------|-----------|
| ERROR khi Run migration #N | **Dừng tại #N** — không chạy #N+1 |
| Verify A/B/V21/C fail | **Dừng** — không apply batch tiếp |
| Nhầm staging project | **Dừng ngay** — xác định đã chạy gì trên project nào |
| Muốn rollback | **Hỏi engineering trước** — không tự chạy file rollback |

---

## Thời gian ước tính

| Batch | Thời gian (DB trống) |
|-------|---------------------|
| A (#1–15) | 30–45 phút |
| B (#16–21) | 15–25 phút |
| C (#22) | 5 phút |
| Verify | 20–30 phút |

---

## Tham chiếu nhanh

| Câu hỏi | Trả lời |
|---------|---------|
| Apply trên project nào? | Production `expuvcohlcjzvrrauvud` |
| Bắt đầu từ migration nào? | **#1** (Production chưa apply gì) |
| #21 apply được chưa? | Chỉ sau #1–#20 PASS |
| #22 apply được chưa? | Chỉ sau V21-1→V21-8 PASS |
| SQL verify ở đâu? | `GATE_2_SQL_VERIFICATION_QUERIES.md` |

**Owner signature:** ________________ **Date:** __________

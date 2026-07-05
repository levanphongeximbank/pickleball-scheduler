# Gate 2 — Owner SQL Apply Checklist

**Dành cho:** Owner / DevOps — không cần biết lập trình  
**Ngày:** 2026-07-04 (cập nhật sau Batch A PASS)  
**Mục tiêu:** Apply 22 file SQL lên Supabase **Production** theo đúng thứ tự  
**Tiến độ:** Batch A ✅ PASS · Batch B ⏳ tiếp theo (#16)

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

### Batch A — #1 đến #15 ✅ PASS (2026-07-04)

| # | Mở file này trong repo | Tick khi Success | Ngày |
|---|------------------------|------------------|------|
| 1 | `docs/supabase-club-v3.sql` | ✅ | 2026-07-04 |
| 2 | `docs/supabase-rbac.sql` | ✅ | 2026-07-04 |
| 3 | `docs/supabase-club-v3-rls.sql` | ✅ | 2026-07-04 |
| 4 | `docs/supabase-match-live.sql` | ✅ | 2026-07-04 |
| 5 | `docs/supabase-match-live-rls.sql` | ✅ | 2026-07-04 |
| 6 | `docs/supabase-security-hardening-v357.sql` | ✅ | 2026-07-04 |
| 7 | `docs/supabase-match-live-v2.sql` | ✅ | 2026-07-04 |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | ✅ | 2026-07-04 |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | ✅ | 2026-07-04 |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | ✅ | 2026-07-04 |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | ✅ | 2026-07-04 |
| 12 | `docs/supabase-subscription-sprint4.sql` | ✅ | 2026-07-04 |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | ✅ | 2026-07-04 |
| 14 | `docs/supabase-mobile-sprint9.sql` | ✅ | 2026-07-04 |
| 15 | `docs/supabase-sprint10.sql` | ✅ | 2026-07-04 |

**Verify Batch A — PASS:**

| Verify | Tick PASS | Ngày |
|--------|-----------|------|
| A1 RLS enabled | ✅ | 2026-07-04 |
| A2 Sprint 7–10 tables | ✅ | 2026-07-04 |
| A3 tenant_id = text | ✅ | 2026-07-04 |
| A4 RPC Identity + Referee | ✅ | 2026-07-04 |
| A5 tenants view + subscription cols | ✅ | 2026-07-04 |

**Batch A verdict:** ✅ **PASS**

> Chi tiết từng bước Batch A: `GATE_2_BATCH_A_OWNER_STEP_BY_STEP.md`

---

### Batch B — #16 đến #21 (tiếp theo — đọc `GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md`)

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
| Bắt đầu từ migration nào? | **#16** — Batch B (`GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md`) |
| #21 apply được chưa? | Chỉ sau #1–#20 PASS |
| #22 apply được chưa? | Chỉ sau V21-1→V21-8 PASS |
| SQL verify ở đâu? | `GATE_2_SQL_VERIFICATION_QUERIES.md` |

**Owner signature:** ________________ **Date:** __________

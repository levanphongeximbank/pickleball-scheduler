# Phase 21 — Production SQL Reconciliation (#21 / #22)

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Mục đích:** Khóa trạng thái Production SQL trước Production Preflight — reconcile mismatch giữa báo cáo migration #21 và #22.

---

## 1. Migration #21 — trạng thái hiện tại

| Hạng mục | Trạng thái |
|----------|------------|
| File | `docs/supabase-sprint10-phase11e-integration-audit.sql` |
| Staging | ✅ **PASS** — Phase 11E staging QA 21/21 (2026-07-03) — `PHASE_11E_INTEGRATION_AUDIT_LOGS_STAGING_QA.md` |
| Production | ⏳ **NEEDS APPLY / OWNER REVIEW** — chưa có bằng chứng V21-1 → V21-8 trên Production DB |
| Apply pack tick | Batch B #21 — NEEDS APPLY |
| Verdict | **KHÔNG PASS Production** cho đến khi owner chạy SQL + verify queries |

**Ghi chú:** Staging PASS **không** tự động chuyển thành Production PASS. Production project `expuvcohlcjzvrrauvud` hiện **trống** — Batch A #1–15 chưa apply.

---

## 2. Migration #22 — trạng thái hiện tại

| Hạng mục | Trạng thái |
|----------|------------|
| File | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` |
| Staging | ✅ **PASS** — KN-6 closed (2026-07-03) — `PHASE_16_KN6_RLS_QA.md` |
| Production | ⏳ **BLOCKED** — phụ thuộc #21 PASS **và** prerequisite Batch A #14 (qr_tokens/checkins tables) |
| Apply pack tick | Batch C #22 — NEEDS APPLY |
| Verdict | **KHÔNG READY apply** cho đến khi #21 Production PASS |

---

## 3. Mismatch giữa báo cáo

| Mismatch | Mô tả | Resolution |
|----------|-------|------------|
| #22 giả định #21 đã PASS | Một số doc KN-6 nói "apply sau Sprint 10" nhưng không phân biệt Production vs staging | **Source of truth:** bảng owner tick trong `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` |
| Policy count checkins | Apply pack cũ ghi "3 policies mỗi bảng" | **Đã sửa:** `checkins` = **2** policies; `qr_tokens` = **3** |
| Staging QA ≠ Production apply | 11E + KN-6 PASS trên staging `qyewbxjsiiyufanzcjcq` | Production cần apply lại đủ #1 → #22 trên `expuvcohlcjzvrrauvud` |
| Batch A chưa xong | #22 cần bảng từ #14 | Không apply #22 trước #14 |

**Kết luận mismatch:** Không có xung đột schema — chỉ xung đột **trạng thái báo cáo**. Phase 21 chuẩn hóa: #22 **BLOCKED** until #21 Production PASS.

---

## 4. Source of truth

| Thứ tự ưu tiên | Tài liệu |
|----------------|----------|
| 1 | `docs/v5/PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` — owner tick + verify queries |
| 2 | File này — reconcile #21/#22 + checklist V21/C0–C7 |
| 3 | Staging QA reports — evidence staging only, không override Production tick |
| 4 | `docs/v5/PHASE_19A_PRODUCTION_PREFLIGHT.md` — ENV + backup gates |

---

## 5. Thứ tự apply chuẩn (Production)

```
Batch A  #1  → #15   (GA baseline — bắt buộc trước mọi thứ)
Batch B  #16 → #20   (billing + 11A–11C)
Batch B  #21         (11E integration audit — PASS verify trước #22)
Batch C  #22         (KN-6 qr_tokens/checkins RLS)
```

**Không** skip dù idempotent. **Không** chạy `supabase-staging-phase16-kn6-seed.sql` trên Production.

---

## 6. Điều kiện PASS — Migration #21

Chỉ tick **CONFIRMED** khi **tất cả** check PASS (owner ghi ngày + operator):

| ID | Check | Cách verify |
|----|-------|-------------|
| V21-1 | Schema columns | Query B5 — columns `request_id`, `tenant_id`, `event_type`, `route`, `status_code`, … tồn tại |
| V21-2 | Legacy nullable probe | `action`, `meta` nullable nếu có từ 11B upgrade |
| V21-3 | Indexes 11E | Index trên `tenant_id`, `created_at`, `event_type` (theo file SQL) |
| V21-4 | RLS enabled + policies | `integration_audit_logs.rowsecurity = true`; tenant-scoped policies |
| V21-5 | Comments | Policy/table comments present (SQL Editor `\d+` hoặc `pg_description`) |
| V21-6 | Backfill | Legacy `action` → `event_type` backfill block chạy không lỗi |
| V21-7 | Regression #15–#20 | Batch A/B tables vẫn tồn tại; không drop billing/API tables |
| V21-8 | No raw API key columns | Không có cột lưu full API key plaintext trong audit table |

**Nếu `public.venues = 0`:** Functional JWT/API audit insert **SKIP** — schema-level V21-1 → V21-6, V21-8 vẫn **bắt buộc PASS**.

---

## 7. Điều kiện PASS — Migration #22

**Prerequisite:** #21 Production PASS + Batch A #14 applied.

| ID | Check | Kỳ vọng |
|----|-------|---------|
| C0 | Functions + tables | `user_venue_id()`, `is_super_admin()`; bảng `qr_tokens`, `checkins` |
| C1 | RLS enabled | `rowsecurity = true` cả hai bảng |
| C2 | Policy count | `qr_tokens` = **3**; `checkins` = **2** |
| C3 | No open policies | Không còn `USING (true)` / `WITH CHECK (true)` |
| C4 | No legacy `*_authenticated` | Policies cũ Sprint 9 open đã DROP |
| C5 | No anon policy | Không policy cho role `anon` |
| C6 | Policy comments | `Phase 16 KN-6` comments trên select policies |
| C7 | Regression #15–#21 spot | Billing + integration_audit_logs vẫn intact |

**Nếu `public.venues = 0`:** Functional JWT/mobile QR E2E **SKIP** — C0–C6 vẫn **bắt buộc PASS** qua SQL Editor queries § Batch C.

---

## 8. Functional checks SKIP khi `public.venues = 0`

| Migration | SKIP (functional) | Vẫn bắt buộc (schema) |
|-----------|-------------------|------------------------|
| #21 | API audit HTTP insert qua Preview; cross-tenant audit read | V21-1 → V21-6, V21-8 |
| #22 | JWT cross-tenant probe; mobile QR E2E | C0 → C6 |

Owner chạy:

```sql
select count(*) as venue_count from public.venues;
```

Ghi kết quả vào apply pack owner tick.

---

## 9. Owner actions — Supabase Dashboard

### Trước apply

1. Chọn project **`pickleball-scheduler-production`** (`expuvcohlcjzvrrauvud`) — **không** staging tab.
2. Xác nhận Batch A #1–#20 đã CONFIRMED (hoặc apply tuần tự từ #1).
3. Review rollback: `docs/supabase-sprint10-phase11e-rollback.sql`, `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql`.

### Apply #21

1. SQL Editor → paste `docs/supabase-sprint10-phase11e-integration-audit.sql` → Run.
2. Chạy verify B5 + V21 checklist §6.
3. Ghi **ngày apply + operator** vào apply pack Batch B row #21.

### Apply #22 (chỉ sau #21 PASS)

1. SQL Editor → paste `docs/supabase-phase16-kn6-qr-checkins-rls.sql` → Run.
2. Chạy queries C1–C2 (apply pack Batch C).
3. Ghi **ngày apply + operator** vào Batch C row #22.

### Sau #21/#22

- **Không** bật `VITE_API_ENABLED`, `API_KEY_STORE=supabase`, `AUDIT_STORE=supabase` trên Production cho đến Production Preflight Go/No-Go.
- **Không** chạy staging seed trên Production.
- Tiếp tục Gate 2 trong `V5_COMMERCIAL_GA_MASTER_PLAN.md`.

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `docs/v5/PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` | Owner tick + verify SQL |
| `docs/v5/PHASE_11E_INTEGRATION_AUDIT_LOGS_STAGING_QA.md` | Staging evidence #21 |
| `docs/v5/PHASE_16_KN6_RLS_QA.md` | Staging evidence #22 |
| `docs/v5/V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gate 2 Production SQL Ready |

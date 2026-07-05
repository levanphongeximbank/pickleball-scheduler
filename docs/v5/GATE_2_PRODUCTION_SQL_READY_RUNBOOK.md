# Gate 2 — Production SQL Ready Runbook

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Mục tiêu:** Owner apply đủ **22 migration** trên Supabase **Production** — chưa deploy app, chưa bật payment live, chưa bật Production env flags.

---

## Supabase project — bắt buộc đúng tab

| Môi trường | Tên project | Project ref | Dùng cho Gate 2? |
|------------|-------------|-------------|------------------|
| **Production** | `pickleball-scheduler-production` | `expuvcohlcjzvrrauvud` | ✅ **CÓ** — apply #1–#22 tại đây |
| Staging | `pickleball-scheduler-stagin` | `qyewbxjsiiyufanzcjcq` | ❌ **KHÔNG** — chỉ pilot Gate 1 |

**Kiểm tra trước mỗi lần Run:** URL Dashboard phải chứa `expuvcohlcjzvrrauvud`. Nếu thấy `qyewbxjsiiyufanzcjcq` → **DỪNG**, đổi project.

---

## Trạng thái Production hiện tại (evidence 2026-07-04)

| Hạng mục | Giá trị | Nguồn |
|----------|---------|-------|
| Production DB | Batch A schema applied | Owner apply #1–#15 2026-07-04 |
| Migration đã apply | **15 / 22** | Batch A ✅ PASS |
| Batch A verify A1–A5 | ✅ PASS | Owner verification 2026-07-04 |
| Batch B #16–#21 | ⏳ NEEDS APPLY | `GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md` |
| Batch C #22 | ⛔ BLOCKED | Chờ V21-1→V21-8 PASS |
| Backup/PITR | Free/Nano — không snapshot | Owner confirmed 2026-07-04 |
| Staging Gate 1 | ✅ PASS | `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` |
| Staging #21 / #22 | ✅ PASS (staging only) | Không override Production |

**Gate 2 verdict hiện tại:** ⏳ **PENDING** — Batch A ✅; chờ Batch B/C. Xem `GATE_2_PRODUCTION_SQL_READY_REPORT.md`.

---

## Batch naming — source of truth

| Batch | Migration | Ý nghĩa |
|-------|-----------|---------|
| **A** | **#1 → #15** | GA baseline (club, RBAC, identity, mobile, sprint10) |
| **B** | **#16 → #21** | Billing Phase 9 + Sprint 10 Phase 11A–11E |
| **C** | **#22** | KN-6 RLS hardening (`qr_tokens`, `checkins`) |

> **Sửa wording (2026-07-04):** Một doc cũ ghi nhầm *"Batch A (#16–#21)"*. **Sai.** Batch A = **#1–#15** only. #16–#21 thuộc **Batch B**. #22 thuộc **Batch C**.

---

## Thứ tự apply bắt buộc

```
1. Batch A   #1  → #15   (phải xong trước)
2. Batch B   #16 → #20   (billing + 11A–11C)
3. Batch B   #21         (11E — PASS V21-1→V21-8 trước khi #22)
4. Batch C   #22         (KN-6 — chỉ sau #21 PASS)
```

**Không được:**
- Apply #22 nếu #21 chưa PASS
- Skip migration dù file idempotent
- Chạy `docs/supabase-staging-phase16-kn6-seed.sql` trên Production
- Chạy rollback nếu chưa hỏi engineering
- Deploy Production / bật payment live / bật env flags

---

## Bảng migration đầy đủ (22 bước)

**Project:** luôn `expuvcohlcjzvrrauvud` (Production).

| # | File SQL | Batch | Đã apply? | Verification | PASS/FAIL/PENDING | Rollback | Rủi ro |
|---|----------|-------|-----------|--------------|-------------------|----------|--------|
| 1 | `docs/supabase-club-v3.sql` | A | ✅ Applied | Spot A2 (club_data_v3) | **PASS** | — | Thấp |
| 2 | `docs/supabase-rbac.sql` | A | ✅ Applied | Spot A1 (profiles, venues RLS) | **PASS** | — | Thấp |
| 3 | `docs/supabase-club-v3-rls.sql` | A | ✅ Applied | Spot A1 | **PASS** | `docs/supabase-rls-rollback.sql` | Trung bình — RLS club |
| 4 | `docs/supabase-match-live.sql` | A | ✅ Applied | Spot A1 | **PASS** | — | Thấp |
| 5 | `docs/supabase-match-live-rls.sql` | A | ✅ Applied | Spot A4 (referee RPC) | **PASS** | — | Trung bình |
| 6 | `docs/supabase-security-hardening-v357.sql` | A | ✅ Applied | — | **PASS** | — | Thấp |
| 7 | `docs/supabase-match-live-v2.sql` | A | ✅ Applied | — | **PASS** | — | Thấp |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | A | ✅ Applied | Spot A4 | **PASS** | `docs/supabase-identity-v40-sprint1-rollback.sql` | Trung bình |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | A | ✅ Applied | — | **PASS** | `docs/supabase-identity-v40-phaseB-rollback.sql` | Trung bình |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | A | ✅ Applied | Spot A4 | **PASS** | `docs/supabase-identity-v40-phaseC-rollback.sql` | Trung bình |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | A | ✅ Applied | Spot A5 (tenants view) | **PASS** | `docs/supabase-multi-tenant-sprint2-rollback.sql` | Trung bình |
| 12 | `docs/supabase-subscription-sprint4.sql` | A | ✅ Applied | Spot A5 | **PASS** | — | Thấp |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | A | ✅ Applied | Spot A2 | **PASS** | — | Thấp — flag OFF |
| 14 | `docs/supabase-mobile-sprint9.sql` | A | ✅ Applied | Spot A2 (qr_tokens, checkins) | **PASS** | `docs/supabase-mobile-sprint9-rollback.sql` | Trung bình — prerequisite #22 |
| 15 | `docs/supabase-sprint10.sql` | A | ✅ Applied | A1–A5 full batch | **PASS** | `docs/supabase-sprint10-rollback.sql` | Cao — nhiều bảng API |
| 16 | `docs/supabase-billing-phase9.sql` | B | ❌ Chưa | B1, B2 | **PENDING** | `docs/supabase-billing-phase9-rollback.sql` | Cao — billing core |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | B | ❌ Chưa | B3 | **PENDING** | `docs/supabase-billing-phase9-trial-rpc-rollback.sql` | Trung bình |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | B | ❌ Chưa | B4 | **PENDING** | `docs/supabase-sprint10-phase11a-rollback.sql` | Trung bình |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | B | ❌ Chưa | B4 | **PENDING** | `docs/supabase-sprint10-phase11b-rollback.sql` | Trung bình |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | B | ❌ Chưa | B4 (expires_at) | **PENDING** | `docs/supabase-sprint10-phase11c-rollback.sql` | Thấp |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | B | ❌ Chưa | **V21-1 → V21-8** | **PENDING** | `docs/supabase-sprint10-phase11e-rollback.sql` | Cao — gate #22 |
| 22 | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | C | ❌ Chưa — **BLOCKED** | **C0 → C7** | **PENDING / BLOCKED** | `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | Cao — mobile QR |

**Cột "Đã apply?":** Owner cập nhật thành ✅ sau khi Run success + tick trong `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md`.

---

## Gate 2 PASS criteria

Gate 2 **PASS** khi **tất cả** điều kiện sau có owner evidence:

| # | Điều kiện | Hiện tại |
|---|-----------|----------|
| G2-1 | Batch A #1–#15 CONFIRMED + verify A1–A5 PASS | ✅ **PASS** (2026-07-04) |
| G2-2 | Batch B #16–#20 CONFIRMED + verify B1–B4 PASS | ⏳ PENDING |
| G2-3 | #21 CONFIRMED + **V21-1 → V21-8 PASS** | ⏳ PENDING |
| G2-4 | #22 CONFIRMED + **C0 → C7 PASS** | ⛔ BLOCKED (chờ #21) |
| G2-5 | Không bật Production env flags sai | ✅ Designed OFF |
| G2-6 | Rollback files đã review | ⏳ Owner tick |

**Nếu `public.venues = 0` trên Production:** Functional JWT/mobile QR E2E **SKIP** — schema checks V21/C vẫn **bắt buộc PASS**.

---

## Sau Gate 2 PASS — việc tiếp theo (chưa làm trong Gate 2)

| Việc | Khi nào |
|------|---------|
| Production Preflight (Gate 3) | Sau Gate 2 PASS + owner approve |
| Vercel Production deploy | Gate 3 PASS |
| Payment live | Gate 5 — Phase 23 |
| Commercial GA | Gate 5 — tất cả P0 blockers đóng |

---

## Tài liệu liên quan

| File | Vai trò |
|------|---------|
| `GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md` | **Bước tiếp theo** — #16–#21 cho owner |
| `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md` | Hướng dẫn từng bước cho owner |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | Copy-paste SQL verify |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | Verdict Gate 2 |
| `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` | Chi tiết batch A/B/C gốc |
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | V21 / C0–C7 spec |
| `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` | Gate 1 PASS evidence |

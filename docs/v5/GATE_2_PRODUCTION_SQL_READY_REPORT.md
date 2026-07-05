# Gate 2 — Production SQL Ready Report

**Ngày cập nhật:** 2026-07-05  
**Phase:** Gate 2 — Production SQL Ready  
**Branch:** `v5-platform-edition`  
**Production project:** `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`)  
**Không deploy Production · Không bật env flags · Không bật payment live**

---

## 1. Verdict Gate 2

| Hạng mục | Verdict |
|----------|---------|
| **Gate 2 — Production SQL Ready** | ✅ **PASS** (2026-07-05) |
| Runbook + checklist + verify queries | ✅ **READY** |
| **Batch A (#1–#15)** | ✅ **PASS** — owner evidence 2026-07-04 |
| **Batch B (#16–#21)** | ✅ **PASS** — owner evidence 2026-07-04 |
| **Batch C (#22)** | ✅ **PASS** — owner evidence 2026-07-05 |
| Owner evidence V21 | ✅ **PASS** — V21-1→V21-8 (2026-07-04) |
| Owner evidence C0–C7 | ✅ **PASS** — (2026-07-05) |
| **Production migrations** | ✅ **22 / 22** |

**Giải thích:** Toàn bộ 22 migrations đã apply thành công trên Production DB `expuvcohlcjzvrrauvud`. Verify A1–A5, B1–B4, V21-1→V21-8, C0→C7 đều **PASS**. Không có ERROR đỏ trong SQL Editor. **Gate 2 đạt điều kiện PASS.**

---

## 2. Câu trả lời nhanh

| Câu hỏi | Trả lời |
|---------|---------|
| Gate 2 hiện PASS/PARTIAL/FAIL? | ✅ **PASS** — Batch A ✅; Batch B ✅; Batch C ✅ |
| Production đã apply đến migration số mấy? | ✅ **22 / 22** — toàn bộ apply pack hoàn tất |
| Migration nào owner cần apply tiếp? | ✅ **Không còn** — Gate 2 SQL complete |
| Batch A PASS chưa? | ✅ **PASS** — #1–#15 Success; A1–A5 PASS |
| Batch B PASS chưa? | ✅ **PASS** — #16–#21 Success; B1–B4 + V21-1→V21-8 PASS |
| Batch C PASS chưa? | ✅ **PASS** — #22 Success; C0→C7 PASS |
| Có được sang Production Preflight chưa? | ✅ **GO** — Gate 2 PASS; Gate 3 có thể bắt đầu (chưa deploy) |
| Có được bán thương mại chưa? | ⛔ **NO-GO** — Commercial GA còn P0 blockers (Gate 4–5) |
| Có được deploy Production app? | ⛔ **NO** — chờ Gate 3 Preflight + owner approve |
| Có được bật env flags? | ⛔ **NO** — engineering bật trong Gate 3, sau owner approve |
| Có được bật payment live? | ⛔ **NO** |

---

## 3. Evidence đối chiếu

### Production SQL status — Batch A (owner confirmed 2026-07-04)

| Hạng mục | Kết quả | Nguồn |
|----------|---------|-------|
| Project ref | `expuvcohlcjzvrrauvud` | Owner apply session |
| Migrations #1–#15 | ✅ Success — không ERROR đỏ | Owner báo cáo |
| A1 RLS enabled | ✅ PASS | Owner verification |
| A2 Tables | ✅ PASS | Owner verification |
| A3 tenant_id | ✅ PASS | Owner verification |
| A4 RPC | ✅ PASS | Owner verification |
| A5 tenants view | ✅ PASS | Owner verification |
| **Batch A verdict** | ✅ **PASS** | A1–A5 + #1–#15 |

### Production SQL status — Batch B (owner confirmed 2026-07-04)

| Hạng mục | Kết quả | Nguồn |
|----------|---------|-------|
| #16 `supabase-billing-phase9.sql` | ✅ Success | Owner báo cáo |
| #17 `supabase-billing-phase9-trial-rpc.sql` | ✅ Success | Owner báo cáo |
| #18 `supabase-sprint10-phase11a-rls.sql` | ✅ Success | Owner báo cáo |
| #19 `supabase-sprint10-phase11b-persistence.sql` | ✅ Success | Owner báo cáo |
| #20 `supabase-sprint10-phase11c-api-key-guard.sql` | ✅ Success | Owner báo cáo |
| B1 Billing tables (8 bảng) | ✅ PASS | Owner verification |
| B2 Plan seed (4 gói) | ✅ PASS | Owner verification |
| B3 Trial RPC | ✅ PASS | Owner verification |
| B4 Phase 11 + expires_at | ✅ PASS | Owner verification |
| #21 `supabase-sprint10-phase11e-integration-audit.sql` | ✅ Success | Owner báo cáo |
| V21-1 → V21-8 | ✅ PASS | Owner verification |
| **Batch B verdict** | ✅ **PASS** | B1–B4 + V21 + #16–#21 |

### Production SQL status — Batch C (owner confirmed 2026-07-05)

| Hạng mục | Kết quả | Nguồn |
|----------|---------|-------|
| #22 `supabase-phase16-kn6-qr-checkins-rls.sql` | ✅ Success — không ERROR đỏ | Owner báo cáo |
| C0 Pre-check | ✅ PASS | Owner verification |
| C1 RLS enabled (qr_tokens, checkins) | ✅ PASS | Owner verification |
| C2 Policies count | ✅ PASS | Owner verification |
| C3 qr_tokens policies | ✅ PASS | Owner verification |
| C4 checkins policies | ✅ PASS | Owner verification |
| C5 No anon direct access | ✅ PASS | Owner verification |
| C6 Staff JWT path | ✅ PASS | Owner verification |
| C7 Integration audit intact | ✅ PASS | Owner verification |
| **Batch C verdict** | ✅ **PASS** | C0–C7 + #22 |

### Staging (không override Production)

| Nguồn | Nội dung |
|-------|----------|
| `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` | Gate 1 ✅ PASS — staging `qyewbxjsiiyufanzcjcq` |
| `PHASE_11E_INTEGRATION_AUDIT_LOGS_STAGING_QA.md` | #21 staging ✅ 21/21 |
| `PHASE_16_KN6_RLS_QA.md` | #22 staging ✅ KN-6 closed |

> Staging PASS **không** tự động = Production PASS — Production evidence riêng biệt đã có (22/22).

### Batch naming correction

| Doc cũ (sai) | Sửa thành |
|--------------|-----------|
| "Batch A (#16–#21)" | Batch A = **#1–#15**; Batch B = **#16–#21**; Batch C = **#22** |

---

## 4. Deliverables Gate 2

| File | Trạng thái |
|------|------------|
| `GATE_2_PRODUCTION_SQL_READY_RUNBOOK.md` | ✅ Updated |
| `GATE_2_OWNER_SQL_APPLY_CHECKLIST.md` | ✅ Updated |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | ✅ Ready |
| `GATE_2_BATCH_A_OWNER_STEP_BY_STEP.md` | ✅ Done — Batch A PASS |
| `GATE_2_BATCH_B_OWNER_STEP_BY_STEP.md` | ✅ Done — Batch B PASS |
| `GATE_2_BATCH_C_OWNER_STEP_BY_STEP.md` | ✅ Done — Batch C PASS |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | ✅ Updated (file này) — **Gate 2 PASS** |

---

## 5. Verification local (engineering)

```bash
npm test      # 769/769 PASS — 58 suites
npm run build # PASS — Vite 8.1.0 + PWA 182 precache
npm run lint  # 0 errors — 128 warnings pre-existing
```

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `npm test` | ✅ PASS | 769/769, 0 fail |
| `npm run build` | ✅ PASS | Exit 0 |
| `npm run lint` | ✅ PASS | 0 errors |

---

## 6. Owner steps — Gate 2 (hoàn tất)

1. ✅ Apply **#1 → #15** (Batch A) → verify **A1–A5** — **DONE** (2026-07-04)
2. ✅ Apply **#16 → #20** → verify **B1–B4** — **DONE** (2026-07-04)
3. ✅ Apply **#21** → verify **V21-1 → V21-8** — **DONE** (2026-07-04)
4. ✅ Apply **#22** (`docs/supabase-phase16-kn6-qr-checkins-rls.sql`) — **DONE** (2026-07-05)
5. ✅ Verify **C0 → C7** PASS — **DONE** (2026-07-05)
6. ✅ Báo engineering → **Gate 2 PASS** — **DONE**

---

## 7. Ràng buộc vẫn hiệu lực

| Ràng buộc | Trạng thái |
|-----------|------------|
| Không deploy Production | ✅ Tuân thủ |
| Không bật payment live | ✅ Tuân thủ |
| Không bật Production env flags | ✅ Tuân thủ |
| Không commit secret | ✅ Tuân thủ |
| Không chạy rollback #22 trên Production | ✅ Documented |
| Không nhầm staging project | ✅ Documented |

---

## 8. Gate progression

```
Gate 1 Staging Pilot Ready     ✅ PASS (2026-07-04)
Gate 2 Production SQL Ready    ✅ PASS (2026-07-05) — 22/22 migrations
  ├─ Batch A #1–#15            ✅ PASS (2026-07-04)
  ├─ Batch B #16–#21           ✅ PASS (2026-07-04)
  └─ Batch C #22               ✅ PASS (2026-07-05) — C0→C7
Gate 3 Production Runtime      ⏳ READY TO START — Preflight (chưa deploy)
Gate 4 Commercial Beta           ⛔ BLOCKED (chờ Gate 3)
Gate 5 Commercial GA               ⛔ NO-GO
```

---

## 9. Đề xuất Gate 3 — Production Runtime Preflight

> **Phạm vi đề xuất:** Chuẩn bị runtime Production. **Không deploy**, **không bật env flags**, **không bật payment live** trong bước này.

### 9.1 Mục tiêu Gate 3

Gate 3 **Production Runtime Ready** = Production app có thể deploy an toàn sau khi owner approve. Điều kiện PASS theo `V5_COMMERCIAL_GA_MASTER_PLAN.md`:

| Check | Trạng thái hiện tại | Hành động đề xuất |
|-------|---------------------|-------------------|
| Production SQL 22/22 | ✅ **DONE** (Gate 2) | — |
| Vercel Production env đầy đủ | ⏳ Owner verify | Checklist §9.2 |
| API/billing/payment flag plan | ✅ Documented | `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` §6 |
| Smoke test 24h plan | ✅ Documented | Owner assign trước deploy |
| Monitoring plan | ⏳ Chưa triển khai | Chọn tool (Sentry recommended) |
| Backup acknowledged | ⚠️ Free/Nano — không PITR | Owner acknowledge limitation |

### 9.2 Owner checklist Gate 3 (Preflight — không deploy)

**Bước 1 — Vercel Production env verify** (scope Production only):

| Biến | Giá trị đề xuất | Bật ngay? |
|------|-----------------|-----------|
| `VITE_SUPABASE_URL` | `https://expuvcohlcjzvrrauvud.supabase.co` | ⏳ Verify đã set — **chưa redeploy** |
| `VITE_SUPABASE_ANON_KEY` | Production anon key | ⏳ Verify đã set |
| `VITE_RBAC_ENABLED` | `true` | ⏳ Verify — bật khi deploy |
| `VITE_SEED_DEMO` | `false` | ⏳ Verify |
| `VITE_BILLING_SUPABASE` | `true` | ⏳ Verify — **chưa redeploy cho đến owner approve deploy** |
| `VITE_PAYMENT_MODE` | `dev` | ⏳ Verify — **không live** |

**Phải giữ OFF (Gate 3 Preflight):**

| Biến | Giá trị | Lý do |
|------|---------|-------|
| `VITE_API_ENABLED` | `false` | Chưa production API smoke |
| `VITE_MARKETPLACE_ENABLED` | `false` | Phụ thuộc API |
| `VITE_ENABLE_AI_ENGINE` | `false` | Không blocker GA core |
| `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` | empty | Payment chưa staging verify |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | Payment commercial Phase 23 |

**Tham chiếu chi tiết:** `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` §2, `PHASE_19A_PRODUCTION_PREFLIGHT.md` §1, `GA-PRODUCTION-ENV-CHECKLIST.md`.

**Bước 2 — Cross-env safety**

- Production ref `expuvcohlcjzvrrauvud` ≠ staging `qyewbxjsiiyufanzcjcq`
- Preview/Development **không** trỏ Production Supabase
- Ghi Vercel Production deployment ID hiện tại (rollback reference)

**Bước 3 — Backup / rollback acknowledge**

- Supabase plan Free/Nano: không PITR — owner acknowledge
- SQL rollback files đã review trong apply pack
- Vercel rollback: promote deployment trước RC1

**Bước 4 — Smoke test plan assign (trước deploy thật)**

| Window | Check | Owner |
|--------|-------|-------|
| T+0 | Login owner + staff; `/dashboard` load | Owner |
| T+0 | Billing page; trial status hiển thị | Owner |
| T+0 | OperationalRouteGate — no_subscription blocked | Owner |
| T+1h | Court Engine session tạo/lưu | Owner |
| T+4h | Mobile login + bottom nav | Owner |
| T+24h | Không spike lỗi auth/403; subscription state ổn | Owner |

**Bước 5 — Engineering pre-deploy verify (local)**

```bash
npm test
npm run build
npm run lint
npm run test:verify-staging-env        # staging credentials
npm run test:verify-billing-tenant-mapping
```

### 9.3 Thứ tự bật flag (sau owner approve deploy — không làm trong Preflight)

1. ✅ SQL Batch A+B+C complete — **DONE** (Gate 2)
2. Vercel Production env core (Supabase + RBAC + `VITE_BILLING_SUPABASE`)
3. Deploy RC1 — smoke 24h
4. `AUDIT_STORE` + `API_KEY_STORE=supabase` (sau prod smoke)
5. `VITE_API_ENABLED` (staging smoke repeat on prod test tenant)
6. Payment staging (`PHASE_23_PAYMENT_COMMERCIAL_PLAN.md`)
7. Payment live — **owner sign-off riêng**

### 9.4 Gate 3 GO / NO-GO

| GO (bắt đầu Preflight checklist) | NO-GO (giữ nguyên) |
|-----------------------------------|---------------------|
| Gate 2 PASS ✅ | Deploy Production app |
| Owner sẵn sàng verify Vercel env | Bật env flags trước approve |
| Backup limitation acknowledged | Bật payment live |
| Rollback plan reviewed | Skip smoke test plan |

**Gate 3 PASS** (sau Preflight) mới mở cửa **deploy discussion** (Phase 19B) — vẫn cần owner signature riêng.

### 9.5 Tài liệu Gate 3

| File | Vai trò |
|------|---------|
| `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | Master Preflight plan |
| `PHASE_19A_PRODUCTION_PREFLIGHT.md` | ENV + backup baseline |
| `GA-PRODUCTION-ENV-CHECKLIST.md` | Vercel env tick list |
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Smoke template (adapt cho prod) |
| `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md` | P0 blockers còn lại |

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_2_BATCH_C_OWNER_STEP_BY_STEP.md` | Batch C — hoàn tất |
| `GATE_2_SQL_VERIFICATION_QUERIES.md` | C0–C7 queries |
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gate 1–5 definition |
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | #21/#22 order + C0–C7 spec |
| `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | **Gate 3 — bước tiếp theo** |

**Report author:** Engineering (Codex session 2026-07-05)  
**Owner Batch A evidence:** #1–#15 Success + A1–A5 PASS — **2026-07-04**  
**Owner Batch B evidence:** #16–#21 Success + B1–B4 + V21-1→V21-8 PASS — **2026-07-04**  
**Owner Batch C evidence:** #22 Success + C0–C7 PASS — **2026-07-05**  
**Gate 2 closure:** ✅ **PASS** — 22/22 migrations on `expuvcohlcjzvrrauvud`

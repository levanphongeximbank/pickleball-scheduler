# Phase 21 — Commercial Readiness Report

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Commit (baseline):** `9f63fce` — `docs(v5): add Phase 19A production SQL apply pack`  
**Version:** `5.0.0-rc1` / V5.0 SaaS Preview RC1  
**Phase:** 21 — V5.0 SaaS Commercial Readiness Program

---

## 1. Verdict Phase 21

| Phạm vi | Verdict |
|---------|---------|
| Documentation + planning (Workstreams A–G) | ✅ **PASS** |
| Staging env scripts | ✅ **PASS** (Phase 21B — 2026-07-04) |
| Owner manual QA | ⏳ **PENDING** |
| Production SQL #21/#22 | ⏳ **NOT STARTED** / **BLOCKED** |
| Commercial GA readiness | ⛔ **NO-GO** |

**Verdict tổng thể Phase 21:** **PARTIAL PASS**

Phase 21 hoàn tất **kế hoạch và bộ thực thi** đưa RC1 → Commercial GA Candidate. **Chưa** đủ điều kiện Production Preflight deploy hay Commercial GA — cần owner actions.

---

## 2. Có đang đi đúng hướng bán thương mại không?

**Có — về mặt lộ trình và governance.**

- Blocker register rõ P0/P1 thay vì “test PASS = GA”.
- Production SQL #21/#22 reconcile — không đánh dấu #22 PASS khi #21 chưa evidence.
- Cloud persistence + payment có phase riêng (22/23) thay vì nhét feature vào Phase 21.
- Staging pilot closure gắn script preflight tiếng Việt — không fake PASS credentials.

**Chưa sẵn sàng bán rộng** — audit 68/100 vẫn hợp lệ; 7/15 blocker P0 còn mở.

---

## 3. Những việc đã hoàn tất

### Workstream A — Staging Pilot Closure

| Deliverable | Status |
|-------------|--------|
| `scripts/verify-staging-env-preflight.mjs` | ✅ Mới — lỗi tiếng Việt, không in secret |
| `npm run test:verify-staging-env` | ✅ Thêm vào `package.json` |
| `scripts/verify-billing-tenant-mapping-staging.mjs` | ✅ Đã có (Phase 20B) — kiểm tra OK |
| Master report staging status | ✅ Cập nhật trong master plan § Staging pilot |

### Workstream B — Production SQL #21/#22

| Deliverable | Status |
|-------------|--------|
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | ✅ |
| Apply pack fix — checkins policy count = 2 | ✅ |
| Apply pack — #22 blocked until #21 PASS | ✅ |
| Apply pack — env flags OFF after #21/#22 | ✅ |

### Workstreams C–G

| File | Status |
|------|--------|
| `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | ✅ |
| `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md` | ✅ 15 blockers |
| `PHASE_22_CLOUD_PERSISTENCE_DESIGN.md` | ✅ |
| `PHASE_23_PAYMENT_COMMERCIAL_PLAN.md` | ✅ |
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | ✅ |

---

## 4. Những việc không lặp lại

- Phase 20/20B plan hoặc checklist mới trùng lặp
- Chỉ chạy test rồi báo GA
- Feature mới ngoài commercial blockers
- Production deploy / SQL apply / payment live
- Đánh dấu #21/#22 Production PASS (chưa có owner evidence)

---

## 5. Production SQL #21/#22 status

| Migration | Staging | Production | Verdict |
|-----------|---------|------------|---------|
| **#21** 11E integration audit | ✅ PASS (2026-07-03) | ⏳ NEEDS APPLY — Batch A chưa xong | **NOT PASS** |
| **#22** KN-6 QR/checkins RLS | ✅ PASS (2026-07-03) | ⛔ **BLOCKED** until #21 Production PASS | **NOT READY apply** |

**Mismatch đã reconcile:** Apply pack cũ ghi checkins = 3 policies → sửa thành **2**. #22 không được PASS nếu #21 chưa V21-1 → V21-8.

**Owner next:** Apply Batch A #1–#15 trên `expuvcohlcjzvrrauvud`, rồi #16–#21, verify, rồi #22.

---

## 6. Staging pilot status

| Check | Status | Evidence |
|-------|--------|----------|
| `npm run test:verify-staging-env` | ✅ **PASS** | Phase 21B — staging `qyewbxjsiiyufanzcjcq` |
| `npm run test:verify-billing-tenant-mapping` | ✅ **PASS** | 1 venue operational (`venue-staging-a` / trialing) |
| Owner smoke 17 mục | ⏳ **PENDING** | `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` |
| Mobile Android | ⏳ **PENDING** | `PHASE_20_MOBILE_PILOT_QA.md` |
| Mobile iPhone | ⏳ **PENDING** | Same |

**Owner fix staging env:** Xem `docs/v5/PHASE_21B_OWNER_STAGING_ENV_FIX.md` (đã PASS local 2026-07-04; máy khác làm lại nếu chưa có key).

**Gate 1 closure:** `docs/v5/PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md`

---

## 7. Commercial blockers còn lại

Xem `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md`.

**P0 (7):** B01 SQL, B02 staging key, B03 owner smoke, B07 payment mock, B08 billing prod env, B11 backup/PITR, B12 legal  
**P1 (7):** B04 mobile, B05 court localStorage, B06 club cloud, B09 API prod smoke, B10 monitoring, B13 runbook, B15 dev fallback audit  
**P2 (1):** B14 lint warnings

---

## 8. Có đủ điều kiện pilot staging chưa?

**CONDITIONAL GO** (giống Phase 20B):

| Tiêu chí | OK? |
|----------|-----|
| Automated tests 769/769 | ✅ |
| Billing lock code | ✅ |
| Staging scripts PASS | ✅ |
| Owner smoke | ❌ PENDING |
| Mobile ≥1 OS | ❌ PENDING |

**Kết luận:** Có thể **chuẩn bị** pilot 1 sân sau owner fix `.env.local` + smoke checklist + 1 mobile OS. **Chưa** coi pilot **PASS đầy đủ**.

---

## 9. Có đủ điều kiện production preflight chưa?

**NO-GO**

| Gate | Status |
|------|--------|
| Gate 1 Staging Pilot Ready | ⚠️ PARTIAL — scripts PASS; smoke + mobile pending |
| Gate 2 Production SQL Ready | ❌ — SQL not started |
| Gate 3 Production Runtime Ready | ❌ |

Production Preflight **design** sẵn sàng (`PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md`) — **execution** chưa.

---

## 10. Có đủ điều kiện bán thương mại rộng chưa?

**NO-GO**

- Audit baseline 68/100 — MVP/Preview RC1
- Payment live ⛔
- Cloud persistence ⛔
- Legal ⛔
- Backup/PITR ⛔
- P0 blockers open

---

## 11. Phase tiếp theo đề xuất

| Phase | Focus | Owner vs Engineering |
|-------|-------|---------------------|
| **21B (owner)** | Smoke 17 mục → mobile 1 OS → đóng Gate 1 | Owner |
| **19A continue** | Production SQL Batch A #1–#15 apply + verify | Owner |
| **21B SQL** | #16–#21 apply + V21 checks → #22 + C checks | Owner |
| **22** | Court Engine + Club cloud persistence implement | Engineering |
| **23** | VNPay/MoMo payment staging | Engineering + Owner merchant |
| **19B** | Production deploy discussion — chỉ sau Gate 2+3 | Owner |

---

## Verification local (Phase 21B session)

```bash
npm test                    # 769/769 PASS
npm run build               # PASS
npm run lint                # 0 errors, 128 warnings legacy
npm run test:verify-staging-env              # PASS
npm run test:verify-billing-tenant-mapping   # PASS
```

---

## Verification local (Phase 21 session — baseline)

```bash
git branch --show-current   # v5-platform-edition
git log -1 --oneline        # 9f63fce docs(v5): add Phase 19A production SQL apply pack
npm test                    # 769/769 PASS
npm run build               # PASS
npm run lint                # 0 errors, 128 warnings legacy
npm run test:verify-staging-env              # BLOCKED — anon key placeholder
npm run test:verify-billing-tenant-mapping   # BLOCKED — Unregistered API key
```

---

## Files created/updated (Phase 21)

### Phase 21B (mới)

- `docs/v5/PHASE_21B_OWNER_STAGING_ENV_FIX.md`
- `docs/v5/PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md`

### Cập nhật (Phase 21B)

- `scripts/verify-staging-env-preflight.mjs` — service role hint, message tiếng Việt
- `scripts/verify-billing-tenant-mapping-staging.mjs` — bảng lỗi khi probe fail
- `docs/v5/PHASE_21_COMMERCIAL_READINESS_REPORT.md` — Gate 1 partial

### Mới (Phase 21)

- `scripts/verify-staging-env-preflight.mjs`
- `docs/v5/PHASE_21_PRODUCTION_SQL_RECONCILIATION.md`
- `docs/v5/PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md`
- `docs/v5/V5_COMMERCIAL_GA_BLOCKER_REGISTER.md`
- `docs/v5/PHASE_22_CLOUD_PERSISTENCE_DESIGN.md`
- `docs/v5/PHASE_23_PAYMENT_COMMERCIAL_PLAN.md`
- `docs/v5/V5_COMMERCIAL_GA_MASTER_PLAN.md`
- `docs/v5/PHASE_21_COMMERCIAL_READINESS_REPORT.md` (file này)

### Cập nhật

- `package.json` — `test:verify-staging-env`
- `docs/v5/PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` — #21/#22 gate, checkins policy count

---

## Tham chiếu điều phối

| Tài liệu | Vai trò |
|----------|---------|
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | SSOT gates + decision tree |
| `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md` | Blocker tracking |
| `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | #21/#22 order + verify |
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Owner manual (không tạo mới) |

# Gate 3 — Production Runtime Preflight Report

**Ngày cập nhật:** 2026-07-05  
**Phase:** Gate 3 — Production Runtime Preflight  
**Branch:** `v5-platform-edition`  
**Version:** `5.0.0-rc1`  
**Production project:** `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`)  
**Staging project:** `qyewbxjsiiyufanzcjcq` (`pickleball-scheduler-stagin`)  
**Không deploy Production · Không bật env flags · Không bật payment live**

---

## 1. Verdict Gate 3

| Hạng mục | Verdict |
|----------|---------|
| **Gate 3 — Production Runtime Preflight** | ✅ **PASS** (2026-07-05) |
| Prerequisite Gate 1 | ✅ **PASS** |
| Prerequisite Gate 2 (22/22 SQL) | ✅ **PASS** |
| Engineering automated gates | ✅ **PASS** |
| Runbook + owner checklist | ✅ **READY** |
| Owner Vercel Production env verify (G3-E1→E21) | ✅ **PASS** — owner verify 2026-07-05 |
| Cross-env safety (no staging ref in Production) | ✅ **PASS** — deployed bundle + owner confirm |
| RBAC/Billing/API/Payment safe state | ✅ **PASS** — runtime OK; `VITE_SUPABASE_ANON_KEY` on dashboard |
| Rollback deployment ID recorded | ✅ **PASS** — `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| Backup/PITR risk acknowledgement | ✅ **PASS** — owner Phong signed 2026-07-05 |
| Smoke test 24h plan assigned | ✅ **PASS** — tester: Phong (post Phase 19B deploy) |
| Monitoring (Sentry/uptime) | ⏳ **NOT IMPLEMENTED** (P1 — không chặn Gate 3) |

**Giải thích PASS:** Gate 2 SQL hoàn tất. Engineering gates PASS. Owner verify 2026-07-05: `VITE_SUPABASE_ANON_KEY` đã thêm Production scope (ref `expuvcohlcjzvrrauvud`, không dùng service_role); cross-env clean; rollback ID ghi nhận; backup/PITR ack; smoke tester assigned. **Không redeploy** trong Gate 3. Phase 19B deploy approval là bước tiếp theo — **ngoài** Gate 3 scope.

---

## 2. Câu trả lời nhanh (owner)

| Câu hỏi | Trả lời |
|---------|---------|
| Gate 3 hiện PASS/PARTIAL/FAIL? | ✅ **PASS** — owner evidence 2026-07-05 |
| Owner cần kiểm tra gì trên Vercel? | ✅ Hoàn tất — anon key + cross-env + safe flags verified |
| Có được deploy Production chưa? | ⏳ **Chưa** — Gate 3 PASS cho phép **chuẩn bị** Phase 19B; deploy cần owner GO signature riêng |
| Có thấy staging ref `qyewbxjsiiyufanzcjcq` trong Production? | ✅ **NO** — owner + bundle confirm |
| Có được bật payment live chưa? | ⛔ **NO** — Phase 23 + owner sign-off riêng |
| Có được sang Gate 4 Commercial Beta chưa? | ⛔ **NO** — cần Phase 19B deploy + smoke 24h + payment staging |
| Có được bán thương mại rộng chưa? | ⛔ **NO** — Gate 5 Commercial GA chưa PASS |

---

## 3. Evidence — Engineering automated gates (2026-07-05)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `npm test` | ✅ **769/769 PASS** | 58 suites, 0 fail, ~5.6s |
| `npm run build` | ✅ PASS | Vite 8.1.0 + PWA 182 precache entries |
| `npm run lint` | ✅ **0 errors** | 128 warnings `react-hooks/exhaustive-deps` (pre-existing P2) |
| Production deploy performed | ✅ **None** | Gate 3 scope |
| Production env flags bật | ✅ **None** | Owner verify only |
| Payment live enabled | ✅ **None** | By design |

---

## 4. Evidence — Prerequisites

| Gate | Verdict | Nguồn |
|------|---------|-------|
| Gate 1 Staging Pilot Ready | ✅ PASS | `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` |
| Gate 2 Production SQL Ready | ✅ PASS | `GATE_2_PRODUCTION_SQL_READY_REPORT.md` — 22/22 on `expuvcohlcjzvrrauvud` |
| Production SQL migrations | ✅ 22/22 | Batch A+B+C owner evidence 2026-07-04/05 |

---

## 5. Owner checklist status (G3-E1 → G3-E21)

> Verify 2026-07-05: `npx vercel env ls production` (tên biến) + deployed bundle scan `pickleball-scheduler-eight.vercel.app` (runtime, không in secret). Owner UI verify Phong 2026-07-05. Sensitive vars **không decrypt** qua CLI — value check qua UI owner.

| # | Check | Trạng thái | Owner tick | Ngày |
|---|-------|------------|------------|------|
| G3-E1 | `VITE_SUPABASE_URL` → ref `expuvcohlcjzvrrauvud` | ✅ **PASS** | ☑ CLI+bundle+owner | 2026-07-05 |
| G3-E1b | Không chứa staging ref `qyewbxjsiiyufanzcjcq` | ✅ **PASS** | ☑ bundle+owner | 2026-07-05 |
| G3-E2 | `VITE_SUPABASE_ANON_KEY` set (Production) | ✅ **PASS** | ☑ owner UI | 2026-07-05 |
| G3-E3 | `VITE_RBAC_ENABLED=true` | ✅ **PASS** | ☑ bundle | 2026-07-05 |
| G3-E4 | `VITE_SEED_DEMO=false` | ✅ **PASS** | ☑ dashboard+bundle | 2026-07-05 |
| G3-E5 | `VITE_BILLING_SUPABASE` verify / needs set | ✅ **PASS** (NEEDS SET before Phase 19B deploy) | ☑ owner | 2026-07-05 |
| G3-E6 | `VITE_PAYMENT_MODE=dev` | ✅ **PASS** | ☑ bundle | 2026-07-05 |
| G3-E7 | `VITE_API_ENABLED=false` | ✅ **PASS** | ☑ absent | 2026-07-05 |
| G3-E8 | `VITE_MARKETPLACE_ENABLED=false` | ✅ **PASS** | ☑ bundle off | 2026-07-05 |
| G3-E9 | `VITE_ENABLE_AI_ENGINE=false` | ✅ **PASS** | ☑ bundle off | 2026-07-05 |
| G3-E10 | Live payment credentials OFF | ✅ **PASS** | ☑ bundle | 2026-07-05 |
| G3-E11 | `VITE_PAYMENT_DEFAULT_PROVIDER=mock` | ✅ **PASS** | ☑ dashboard+bundle | 2026-07-05 |
| G3-E12–E14 | Server-only env safe | ✅ **PASS** | ☑ CLI+owner | 2026-07-05 |
| G3-E15–E17 | Cross-env safety | ✅ **PASS** | ☑ owner | 2026-07-05 |
| G3-E18 | Chưa redeploy trong Gate 3 | ✅ **PASS** | ☑ owner | 2026-07-05 |
| G3-E19–E20 | Integration flags safe | ✅ **PASS** | ☑ bundle | 2026-07-05 |
| G3-E21 | HTTPS/PWA (post-deploy) | ⏸ POST-DEPLOY | ☐ | Phase 19B |

**Owner Vercel verify:** ✅ **17 / 17** pre-deploy items PASS · **0 FAIL** · G3-E21 post-deploy

### 5.1 CLI + owner verify evidence (2026-07-05, no secrets printed)

| Method | Kết quả |
|--------|---------|
| `vercel env ls production` (initial) | 9 biến Encrypted — thiếu `VITE_SUPABASE_ANON_KEY` |
| Owner UI verify (Phong) | ✅ `VITE_SUPABASE_ANON_KEY` added Production scope — anon từ `expuvcohlcjzvrrauvud`; không service_role; không ghi secret |
| Cross-env owner confirm | ✅ Production dùng `expuvcohlcjzvrrauvud`; không thấy `qyewbxjsiiyufanzcjcq` |
| `vercel env run -e production` (không `.env.local`) | Sensitive values **empty** — CLI không decrypt; không dùng làm nguồn value |
| Deployed bundle scan (live Production) | Prod ref ✅ · staging ref ❌ không thấy · RBAC/payment/API flags ✅ |
| Temp file `.env.production.local` | Pulled → deleted · `.gitignore` có `*.local` + `.env.production` |

**G3-E2 resolved:** Owner thêm `VITE_SUPABASE_ANON_KEY` Production scope 2026-07-05. Redeploy **không** thực hiện trong Gate 3 — env mới có hiệu lực sau Phase 19B deploy.

---

## 6. Rollback readiness

| Hạng mục | Trạng thái | Ghi chú |
|----------|------------|---------|
| SQL rollback files (14 files) | ✅ Confirmed in repo | `PHASE_19A_PRODUCTION_PREFLIGHT.md` §3.2 |
| Vercel Production deployment ID | ✅ **PASS** | `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| Git deploy target | ✅ `v5.0.0-rc1` | Tag present |
| Vercel promote rollback procedure | ✅ Documented | Runbook §7 |

| Field | Owner ghi nhận |
|-------|----------------|
| Deployment ID | `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| Environment | Production Current |
| Domain | `pickleball-scheduler-eight.vercel.app` |
| Branch | `v5-platform-edition` |
| Commit | `6e28d25` |
| Ngày | 2026-07-05 |
| Ghi bởi | Phong |

---

## 7. Backup / PITR acknowledgement

| Hạng mục | Trạng thái |
|----------|------------|
| Supabase plan | Free/Nano |
| PITR | ⛔ **Không có** |
| Dashboard backup UI | ⛔ **Không hiển thị** |
| Post-Gate-2 data | Schema applied — export khuyến nghị sau venue đầu tiên |
| Owner signed ack | ✅ **PASS** — Phong, 2026-07-05 |

**Owner acknowledgement (signed):**

- [x] Tôi hiểu Production **không có PITR** trên plan Free/Nano.
- [x] Rollback app = promote Vercel deployment cũ (§6).
- [x] Rollback SQL = scoped files only — **không** drop toàn DB.
- [x] Sau venue đầu tiên: export mẫu `venues`, `profiles`, `tenant_subscriptions` (khuyến nghị).

**Blocker B11:** Acknowledged at Gate 3 — vẫn P0 cho Commercial GA (Gate 5).

---

## 8. Smoke test 24h plan

| Hạng mục | Trạng thái |
|----------|------------|
| Plan documented | ✅ Runbook §6 + `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` §4 |
| Owner assigned tester | ✅ **PASS** — Phong |
| Accounts COURT_OWNER + PLAYER on Production | ⏳ PENDING (bootstrap Phase 19B) |
| Executed | ⏸ **POST-DEPLOY** (sau Phase 19B deploy approval) |

---

## 9. Safe flag matrix (expected Production pre-deploy)

| Biến | Expected | Live? |
|------|----------|-------|
| `VITE_RBAC_ENABLED` | `true` | ✅ Verified |
| `VITE_BILLING_SUPABASE` | `true` (at deploy) | ⏳ NEEDS SET before Phase 19B deploy |
| `VITE_PAYMENT_MODE` | `dev` | ⛔ Not live |
| `VITE_API_ENABLED` | `false` | OFF |
| `VITE_MARKETPLACE_ENABLED` | `false` | OFF |
| `VITE_ENABLE_AI_ENGINE` | `false` | OFF |
| `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` | empty/OFF | ⛔ Not live |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | Mock only |

---

## 10. Gate progression

```
Gate 1 Staging Pilot Ready     ✅ PASS
Gate 2 Production SQL Ready    ✅ PASS (22/22)
Gate 3 Production Runtime    ✅ PASS (2026-07-05)
Gate 4 Commercial Beta         ⛔ BLOCKED (chờ Phase 19B deploy + smoke + payment staging)
Gate 5 Commercial GA           ⛔ NO-GO
```

---

## 11. Next actions

### Owner (Phase 19B — sau Gate 3 PASS)

1. **Phase 19B GO signature** — approve Production deploy `v5.0.0-rc1`.
2. Set `VITE_BILLING_SUPABASE=true` (nếu chưa) + confirm env trước deploy.
3. **Deploy** Production (Phase 19B — ngoài Gate 3).
4. Execute smoke 24h — tester: **Phong**.
5. Verify G3-E21 HTTPS/PWA post-deploy.

### Engineering (sau owner Phase 19B GO)

1. Confirm env + deploy `v5.0.0-rc1`.
2. Support smoke 24h execution.
3. P1: monitoring tool selection (B10).

### Explicit NO-GO (giữ nguyên)

- ⛔ Deploy Production trong Gate 3 (đã tuân thủ)
- ⛔ Bật payment live
- ⛔ `VITE_API_ENABLED=true` trên Production
- ⛔ Gate 4 Commercial Beta (chưa đủ điều kiện)
- ⛔ Bán thương mại rộng / Gate 5 GA

---

## 12. Gate 3 PASS criteria checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Gate 2 PASS | ✅ |
| 2 | Engineering test/build/lint | ✅ |
| 3 | Runbook published | ✅ |
| 4 | Owner G3-E1→E17 PASS | ✅ |
| 5 | Rollback deployment ID | ✅ `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| 6 | Backup/PITR ack signed | ✅ Phong 2026-07-05 |
| 7 | Smoke plan assigned | ✅ Phong |
| 8 | No deploy / no flag enable / no payment live | ✅ |

**Gate 3 PASS:** rows 1–8 all ✅ (2026-07-05).

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT.md` | Owner step-by-step runbook |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | Gate 2 closure |
| `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | Flag plan + smoke |
| `PHASE_19A_PRODUCTION_PREFLIGHT.md` | ENV E1–E21 |
| `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` | Sau Gate 3 PASS |
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gate definition |
| `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md` | B08, B11 |

**Report author:** Engineering (Codex session 2026-07-05)  
**Gate 3 status:** ✅ **PASS** — owner evidence Phong 2026-07-05; Phase 19B deploy approval là bước tiếp theo

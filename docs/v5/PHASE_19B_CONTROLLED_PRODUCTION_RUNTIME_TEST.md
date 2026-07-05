# Phase 19B — Controlled Production Runtime Test

**Ngày cập nhật:** 2026-07-05  
**Branch:** `v5-platform-edition`  
**Version / tag deploy:** `v5.0.0-rc1`  
**Production Supabase:** `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`)  
**Production URL:** `https://pickleball-scheduler-eight.vercel.app`  
**Smoke tester:** Phong  
**Smoke window:** Ngay sau deploy Production (T+0 → T+24h)

---

## 1. Mục tiêu Phase 19B

Deploy Production **có kiểm soát** để kiểm thử nội bộ — **không** bán thương mại rộng.

| ✅ Trong phạm vi | ⛔ Ngoài phạm vi |
|------------------|-----------------|
| Deploy RC1 lên Vercel Production | Payment live (VNPay/MoMo/Stripe) |
| Smoke test owner 24h | `VITE_API_ENABLED=true` |
| Bootstrap tenant/owner (nếu chưa có venue) | Marketplace / AI Production |
| `VITE_BILLING_SUPABASE=true` + mock payment | Gate 4 Commercial Beta |
| Rollback sẵn sàng nếu smoke FAIL | Bán thương mại / Gate 5 GA |

**Tiền đề đã PASS:**

| Gate | Verdict |
|------|---------|
| Gate 1 Staging Pilot Ready | ✅ PASS |
| Gate 2 Production SQL Ready | ✅ PASS (22/22) |
| Gate 3 Production Runtime Preflight | ✅ PASS (2026-07-05) |

---

## 2. Ràng buộc bắt buộc

| # | Ràng buộc |
|---|-----------|
| 1 | **Không deploy** cho đến khi owner ký **GO deploy** riêng (§8) |
| 2 | **Không** ghi secret / anon key vào repo hoặc docs |
| 3 | Production env **phải** trỏ `expuvcohlcjzvrrauvud` — **không** `qyewbxjsiiyufanzcjcq` |
| 4 | **Không** prefix `VITE_` cho service role key |
| 5 | Payment live OFF — `VITE_PAYMENT_MODE=dev`, provider `mock` |
| 6 | Ghi rollback deployment ID **trước** mọi deploy mới |

---

## 3. Vercel Production env — verify lần cuối (Phase 19B)

> **Phương pháp:** `npx vercel env ls production` (tên biến) + owner UI verify value (CLI không decrypt).  
> **Lần verify engineering:** 2026-07-05.

### 3.1 Checklist biến bắt buộc

| # | Biến | Kỳ vọng | CLI 2026-07-05 | Value verify |
|---|------|---------|----------------|--------------|
| P19B-E1 | `VITE_SUPABASE_URL` | Ref `expuvcohlcjzvrrauvud` | ✅ Có (Production) | ☑ Gate 3 owner |
| P19B-E1b | Không staging ref | Không `qyewbxjsiiyufanzcjcq` | ✅ (bundle Gate 3) | ☑ Gate 3 owner |
| P19B-E2 | `VITE_SUPABASE_ANON_KEY` | Set, Production anon | ✅ Có (Production only) | ☑ Gate 3 owner |
| P19B-E3 | `VITE_RBAC_ENABLED` | `true` | ✅ Có | ☑ Gate 3 bundle |
| P19B-E4 | `VITE_SEED_DEMO` | `false` | ✅ Có | ☑ Gate 3 |
| P19B-E5 | `VITE_BILLING_SUPABASE` | **`true`** | ✅ Có (Production only) | ☑ Owner 2026-07-05 |
| P19B-E6 | `VITE_PAYMENT_MODE` | `dev` | ✅ Có | ☑ Gate 3 |
| P19B-E7 | `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | ✅ Có | ☑ Gate 3 |
| P19B-E8 | `VITE_API_ENABLED` | `false` / unset | ✅ Absent | ☑ Gate 3 |
| P19B-E9 | `VITE_MARKETPLACE_ENABLED` | `false` | ✅ Có (verify value) | ☑ Gate 3 bundle off |
| P19B-E10 | `VITE_ENABLE_AI_ENGINE` | `false` / unset | ✅ Có (verify value) | ☑ Gate 3 bundle off |
| P19B-E11 | Live payment creds | OFF / empty | ✅ | ☑ Gate 3 |
| P19B-E12 | `VITE_*` service role | **Không có** | ✅ Không thấy | ☑ |

### 3.2 Server-only (không `VITE_`)

| Biến | Ghi chú |
|------|---------|
| `SUPABASE_URL` | ✅ Có — server-only OK |
| `API_KEY_STORE` | ✅ Có — giữ `memory` hoặc tương đương khi API OFF |
| `SUPABASE_SERVICE_ROLE_KEY` | Không list qua CLI — nếu có phải **không** `VITE_` prefix |

### 3.3 Env blocker — resolved

| Blocker | Trạng thái |
|---------|------------|
| `VITE_BILLING_SUPABASE=true` Production | ✅ **SET** — owner 2026-07-05; CLI `vercel env ls production` xác nhận biến có scope Production |

> **Lưu ý:** Giá trị `true` xác nhận qua owner UI (CLI không decrypt). Env mới **chưa** có trong bundle live cho đến khi redeploy Production sau GO.

**Cross-env note:** `VITE_SUPABASE_URL` hiện scope cả Preview + Production trên dashboard — Gate 3 owner đã xác nhận Production value đúng ref production. Preview nên dùng staging ref riêng (khuyến nghị tách scope sau pilot).

---

## 4. Engineering gates (local — chạy lại Phase 19B prep)

```bash
npm test
npm run build
npm run lint
```

| Gate | Kết quả 2026-07-05 | Evidence |
|------|---------------------|----------|
| `npm test` | ✅ **769/769 PASS** | 58 suites, ~8s |
| `npm run build` | ✅ PASS | Vite 8.1.0, PWA 182 precache |
| `npm run lint` | ✅ **0 errors** | 128 warnings `react-hooks/exhaustive-deps` (P2, pre-existing) |

---

## 5. Deploy plan

### 5.1 Target

| Field | Giá trị |
|-------|---------|
| Git branch | `v5-platform-edition` |
| Git tag | `v5.0.0-rc1` |
| Package version | `5.0.0-rc1` |
| Supabase project | `expuvcohlcjzvrrauvud` |
| Domain | `pickleball-scheduler-eight.vercel.app` |

### 5.2 Rollback reference (ghi **trước** deploy)

| Field | Giá trị (Gate 3) |
|-------|------------------|
| Deployment ID | `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| Commit | `6e28d25` |
| Ghi bởi | Phong |
| Ngày | 2026-07-05 |

**Rollback:** Vercel → Deployments → chọn deployment trên → **Promote to Production** (< 5 phút).

### 5.3 Pre-deploy sequence (sau owner GO)

| # | Bước | Owner / Engineering |
|---|------|---------------------|
| 1 | Confirm P19B-E1→E12 PASS (§3) | Owner |
| 2 | Confirm `VITE_BILLING_SUPABASE=true` (§3.3) | ☑ Owner 2026-07-05 |
| 3 | Ghi deployment ID hiện tại (§5.2) — xác nhận vẫn `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` hoặc cập nhật | Owner |
| 4 | Bootstrap tenant nếu `venues = 0` | Owner — `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` |
| 5 | Deploy Production RC1 | Engineering hoặc Owner (§6) |
| 6 | Smoke T+0 (15 phút P0) | Phong — `PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md` |
| 7 | Smoke T+1h / T+4h / T+24h | Phong |
| 8 | Ghi kết quả | `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md` |

### 5.4 Safe flags tại deploy

| Layer | Trạng thái |
|-------|------------|
| RBAC | `VITE_RBAC_ENABLED=true` |
| Billing | `VITE_BILLING_SUPABASE=true` |
| Payment | `dev` + `mock` — **không live** |
| API | OFF |
| Marketplace | OFF |
| AI Engine | OFF |

---

## 6. Cách deploy (chỉ sau owner GO — §8)

### Cách A — Vercel Dashboard (khuyến nghị owner)

1. [Vercel Dashboard](https://vercel.com/dashboard) → project **pickleball-scheduler**.
2. Tab **Deployments** → tìm deployment từ branch `v5-platform-edition` hoặc tag `v5.0.0-rc1`.
3. **⋯ → Promote to Production** (nếu deployment đã build sẵn), **hoặc**
4. **Redeploy** deployment mới nhất sau khi đã Save env `VITE_BILLING_SUPABASE=true`.

### Cách B — Git push (nếu Production auto-deploy từ branch)

```bash
git checkout v5-platform-edition
git pull origin v5-platform-edition
# Chỉ push nếu có commit mới đã review — không push tự động trong prep
git push origin v5-platform-edition
```

### Cách C — Vercel CLI

```bash
npx vercel --prod
# Chọn project pickleball-scheduler, confirm branch v5-platform-edition
```

**Sau deploy:** Mở Production URL → smoke §7 ngay (T+0).

---

## 7. Smoke scope (tóm tắt)

Chi tiết tick từng bước: `PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md`.

| Window | Mục tiêu |
|--------|----------|
| **T+0 (P0, ~15 ph)** | Login, dashboard, billing/trial, court-engine, API health 503, logout |
| **T+1h** | Court Engine session tạo/lưu |
| **T+4h** | Mobile viewport + bottom nav |
| **T+24h** | Auth/403 ổn định; subscription state không drift |

**Fail → rollback:** White screen, cross-tenant leak, billing crash loop — promote `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2`.

---

## 8. Owner GO / NO-GO deploy

### GO — cho phép deploy Production RC1

| # | Điều kiện | Tick |
|---|-----------|------|
| 1 | Gate 1 + 2 + 3 PASS | ☑ |
| 2 | P19B-E1→E4, E6→E12 PASS | ☐ Owner |
| 3 | `VITE_BILLING_SUPABASE=true` đã set Production | ☑ Owner 2026-07-05 |
| 4 | Rollback ID ghi nhận (§5.2) | ☑ |
| 5 | Bootstrap venue/owner (nếu cần) | ☐ Owner |
| 6 | Engineering test/build/lint PASS (§4) | ☑ |
| 7 | Smoke tester Phong + window xác nhận | ☑ |
| 8 | **Owner ký GO deploy** (dòng dưới) | ☐ |

```
Phase 19B Production Deploy — GO
Tôi approve deploy v5.0.0-rc1 lên Production controlled test.
Payment live: OFF · API/Marketplace/AI: OFF · Không bán thương mại.

Owner: ________________   Date: __________
```

### NO-GO — giữ nguyên

| Blocker | Trạng thái |
|---------|------------|
| Chưa ký GO deploy | ⛔ **ACTIVE** |
| `VITE_BILLING_SUPABASE` chưa set | ⛔ **ACTIVE** |
| Payment live | ⛔ NO |
| Commercial Beta / GA | ⛔ NO |

---

## 9. Gate progression sau Phase 19B

```
Gate 3 Production Runtime     ✅ PASS
Phase 19B Deploy + Smoke      ⏳ PENDING owner GO
Gate 4 Commercial Beta        ⛔ BLOCKED (cần smoke 24h PASS + payment staging)
Gate 5 Commercial GA          ⛔ NO-GO
```

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Gate 3 closure + env evidence |
| `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` | SQL bootstrap venue/owner/trial |
| `PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md` | Owner smoke tick list |
| `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md` | Verdict + evidence post-deploy |
| `PHASE_18_PRODUCTION_READINESS.md` | S1–S15 smoke reference |
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Staging smoke template |

**Phase 19B status (2026-07-05):** ✅ **DEPLOYED** · smoke owner **PENDING** · rollback `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2`

# Phase 21 — Production Preflight Plan

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Version:** `5.0.0-rc1` / V5.0 SaaS Preview RC1  
**Phạm vi:** Thiết kế + checklist owner — **không deploy Production**, **không bật payment live**.

---

## Executive summary

Tài liệu này chuẩn bị Production Preflight (Phase 19B+) từ trạng thái **Preview RC1** lên **Commercial GA Candidate**. Mọi hành động deploy/flag bật cần owner approval riêng.

| Gate | Trạng thái Phase 21 |
|------|---------------------|
| Production SQL #1–#22 | ⏳ NOT STARTED (Production DB trống) |
| Vercel Production env | ⏳ Owner verify |
| Backup/PITR | ⚠️ Free/Nano — không PITR |
| Monitoring | ⏳ Chưa triển khai |
| Payment live | ⛔ **NO-GO** Phase 21 |

---

## 1. Production Supabase SQL status

| Batch | Migrations | Production status | Blocker |
|-------|------------|-------------------|---------|
| A | #1–#15 | NEEDS APPLY | P0 — empty DB |
| B | #16–#21 | NEEDS APPLY | P0 — sau Batch A; #21 reconcile `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` |
| C | #22 | BLOCKED until #21 PASS | P0 — mobile QR |

**Owner source of truth:** `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` owner tick table.

**Sau SQL apply:** Env flags production vẫn OFF (§6).

---

## 2. Vercel Production env checklist

**Vị trí:** Vercel → Project → Settings → Environment Variables → scope **Production**.

### 2.1 Required (sau SQL apply)

| Biến | RC1 / Preflight | Bật khi |
|------|-----------------|---------|
| `VITE_SUPABASE_URL` | Production ref `expuvcohlcjzvrrauvud` | Trước deploy |
| `VITE_SUPABASE_ANON_KEY` | Production anon | Trước deploy |
| `VITE_RBAC_ENABLED` | `true` | Deploy |
| `VITE_SEED_DEMO` | `false` | Deploy |
| `VITE_BILLING_SUPABASE` | `true` | Sau Batch B #16–17 PASS |
| `VITE_PAYMENT_MODE` | `dev` | Deploy — không live |

### 2.2 Must remain OFF (Phase 21)

| Biến | Giá trị | Lý do |
|------|---------|-------|
| `VITE_API_ENABLED` | `false` | Chưa production API smoke |
| `VITE_MARKETPLACE_ENABLED` | `false` | Phụ thuộc API |
| `VITE_ENABLE_AI_ENGINE` | `false` | Không blocker GA core |
| `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` | empty | Payment chưa staging verify |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | Payment commercial Phase 23 |

### 2.3 Server-only

| Biến | Preflight | Bật khi |
|------|-----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Set server-only | Edge/API jobs |
| `API_KEY_STORE` | `memory` hoặc unset | Sau #21 PASS + API key seed + staging smoke |
| `AUDIT_STORE` | `memory` hoặc unset | Sau #21 PASS |

### 2.4 Cross-env safety

- Production **≠** staging URL/key (`qyewbxjsiiyufanzcjcq` vs `expuvcohlcjzvrrauvud`).
- Preview/Development **không** trỏ Production Supabase.
- Redeploy sau mỗi lần đổi env.

**Script local (staging pilot):** `npm run test:verify-staging-env` — không thay Vercel checklist.

**Tham chiếu:** `PHASE_19A_PRODUCTION_PREFLIGHT.md` §1, `GA-PRODUCTION-ENV-CHECKLIST.md`.

---

## 3. Backup / rollback plan

| Hạng mục | Trạng thái | Hành động |
|----------|------------|-----------|
| Supabase plan | Free/Nano | Cân nhắc nâng plan trước Commercial GA |
| PITR / snapshot | Không có | Export thủ công sau venue đầu tiên |
| SQL rollback | Scoped files trong apply pack | Không drop toàn DB |
| Vercel rollback | Promote deployment trước RC1 | Ghi deployment ID trước deploy |

**Pre-deploy:** Owner ghi Vercel Production deployment ID hiện tại.

**Post-deploy 24h:** Export sample `venues`, `profiles`, `tenant_subscriptions` nếu có dữ liệu thật.

---

## 4. Smoke test 24h plan

| Window | Check | Owner |
|--------|-------|-------|
| T+0 | Login owner + staff; `/dashboard` load | Owner |
| T+0 | Billing page; trial status hiển thị | Owner |
| T+0 | OperationalRouteGate — no_subscription blocked | Owner |
| T+1h | Court Engine session tạo/lưu (localStorage pilot) | Owner |
| T+4h | Mobile login + bottom nav | Owner |
| T+24h | Không spike lỗi auth/403; subscription state ổn | Owner |

**Automated local (pre-deploy):** `npm test`, `npm run build`, `npm run lint`.

**Staging scripts (pre-production):**

```bash
npm run test:verify-staging-env
npm run test:verify-billing-tenant-mapping
```

---

## 5. Monitoring / error tracking plan

| Layer | Phase 21 | Commercial GA target |
|-------|----------|----------------------|
| Vercel Analytics | Bật (free tier) | Dashboard weekly review |
| Vercel Logs | Runtime errors | Alert on 5xx spike |
| Supabase Dashboard | Auth + DB logs | Review RLS violations |
| Sentry / similar | ⏳ Chưa tích hợp | P1 blocker — cần trước GA |
| Uptime probe | ⏳ | External ping `/login` |

**Phase 21 deliverable:** Chọn tool (Sentry recommended) + env DSN server-only — **chưa bật** cho đến owner approve.

---

## 6. API / payment flags plan

| Flag | Commercial GA cần | Khi nào bật | Phase 21 |
|------|-------------------|-------------|----------|
| `VITE_API_ENABLED` | Có | Sau API staging smoke PASS | **OFF** |
| `API_KEY_STORE=supabase` | Có | Sau #21 PASS + API key seed | **OFF** |
| `AUDIT_STORE=supabase` | Có | Sau #21 PASS | **OFF** |
| `VITE_BILLING_SUPABASE` | Có | Sau billing tenant verify Production | **OFF** until SQL #16–17 |
| `VITE_PAYMENT_MODE` | Có | Sau payment staging | **`dev`** only |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | Có | Sau chọn provider | **`mock`** |
| `VITE_ENABLE_AI_ENGINE` | Không bắt buộc | Sau core SaaS ổn | **OFF** |
| `VITE_MARKETPLACE_ENABLED` | Không bắt buộc | Sau API/payment ổn | **OFF** |

**Thứ tự bật đề xuất:**

1. SQL Batch A+B+C complete  
2. Vercel Production env core (Supabase + RBAC + billing flag)  
3. Deploy RC1 — smoke 24h  
4. `AUDIT_STORE` + `API_KEY_STORE` (sau #21 prod PASS)  
5. `VITE_API_ENABLED` (staging smoke repeat on prod test tenant)  
6. Payment staging (`PHASE_23_PAYMENT_COMMERCIAL_PLAN.md`)  
7. Payment live — **owner sign-off riêng**

---

## 7. Legal / privacy readiness

| Hạng mục | Trạng thái | Ghi chú |
|----------|------------|---------|
| Terms of Service (VN) | ⏳ Draft needed | Blocker GA |
| Privacy Policy | ⏳ Draft needed | GDPR-lite + PDPA VN |
| Subscription/billing terms | ⏳ | Gắn trial/grace policy |
| Cookie / analytics notice | ⏳ | Nếu bật Vercel Analytics |
| Data retention policy | ⏳ | Supabase + localStorage disclosure |

**Phase 21:** Liệt kê blocker — không publish legal docs trong repo secret.

---

## 8. Support / runbook

| Tài liệu | Trạng thái |
|----------|------------|
| Owner staging smoke | ✅ `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` |
| Billing lock troubleshooting | ⏳ Cần runbook P1 |
| SQL rollback decision tree | ✅ Apply pack § Rollback |
| Payment manual override | ⏳ Phase 23 |
| Escalation contact | ⏳ Owner điền |

**Runbook tối thiểu cho Commercial Beta:**

- Tenant locked → check `tenant_subscriptions.status`
- QR fail → verify #22 applied + staff JWT
- Court data lost → localStorage backup export

---

## 9. Go / No-Go criteria (Production Preflight)

### GO (cho phép bắt đầu Phase 19B deploy discussion)

- Gate 1 Staging Pilot Ready — xem master plan  
- Gate 2 Production SQL Ready — #21 + #22 PASS  
- ENV checklist E1–E21 owner tick  
- Backup plan acknowledged (Free/Nano limitation)  
- Rollback files reviewed  
- Smoke 24h plan assigned  

### NO-GO (Phase 21 default)

- Bất kỳ P0 blocker mở trong `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md`  
- Production SQL chưa apply  
- Staging script BLOCKED  
- Payment live requested prematurely  
- Owner chưa approve deploy  

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `docs/v5/V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gates + decision tree |
| `docs/v5/PHASE_19A_PRODUCTION_PREFLIGHT.md` | ENV + backup baseline |
| `docs/v5/PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | #21/#22 order |
| `docs/v5/PHASE_23_PAYMENT_COMMERCIAL_PLAN.md` | Payment staging path |

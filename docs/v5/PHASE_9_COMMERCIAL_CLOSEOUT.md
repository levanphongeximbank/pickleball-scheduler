# Phase 9 — Commercial SaaS Closeout

**Ngày đóng:** 2026-07-01  
**Trạng thái:** ✅ Hoàn tất Phase 9 Commercial SaaS (product/technical scope)  
**Mức hoàn thiện:** 100%  
**Audit:** [PHASE_9_COMMERCIAL_AUDIT.md](./PHASE_9_COMMERCIAL_AUDIT.md)

---

## 1. Phạm vi Phase 9

Commercial SaaS billing: plans, subscriptions, trial, invoices, payments, plan limits, tenant lock, owner self-service UI, admin billing UI, RBAC, RLS SQL, audit, notification, tests.

**Không trong phạm vi:** Production deploy, payment gateway thật (VNPay/MoMo/Stripe), Phase 10 QA/Release.

---

## 2. Hạng mục đã hoàn thành

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Plans (TRIAL/STARTER/PROFESSIONAL/ENTERPRISE) | ✅ |
| 2 | Plan limits (17 fields) | ✅ |
| 3 | Tenant subscriptions lifecycle | ✅ |
| 4 | Trial 14 ngày | ✅ |
| 5 | Invoices + invoice items | ✅ |
| 6 | Payments + provider interface | ✅ |
| 7 | Manual / bank_transfer / mock flows | ✅ |
| 8 | BillingEngine | ✅ |
| 9 | PlanLimitService | ✅ |
| 10 | SubscriptionService | ✅ |
| 11 | InvoiceService | ✅ |
| 12 | PaymentService | ✅ |
| 13 | TenantAccessService | ✅ |
| 14 | Tenant lock/unlock rules | ✅ |
| 15 | Owner billing UI (7 routes) | ✅ |
| 16 | Admin billing UI (6 routes) | ✅ |
| 17 | Billing permissions | ✅ |
| 18 | Billing RLS SQL | ✅ |
| 19 | Billing audit log | ✅ |
| 20 | Billing notification events | ✅ |
| 21 | Billing tests (14) | ✅ |
| 22 | Documentation (5 files) | ✅ |

---

## 3. Schema

**Migration:** `docs/supabase-billing-phase9.sql`  
**Rollback:** `docs/supabase-billing-phase9-rollback.sql`

Tables: `plans`, `plan_limits`, `tenant_subscriptions`, `invoices`, `invoice_items`, `payments`, `billing_events`, `billing_audit_logs`

Indexes: tenant_id, status, created_at on subscriptions/invoices/payments/audit

---

## 4. Services / Engine

| Service | Chức năng |
|---------|-----------|
| BillingEngine | Trial, renew, suspend, changePlan, payment handlers, audit/notify |
| PlanLimitService | 17 limit checks + exceeded audit |
| SubscriptionService | Full lifecycle + past_due grace |
| InvoiceService | CRUD + markPaid + items |
| PaymentService | Provider intents, validation, success/fail |
| TenantAccessService | evaluateAccess, canPerformAction, lock/unlock |
| BillingAuditService | Commercial audit entries |
| BillingNotificationService | 16 billing event types |
| Payment providers | manual, bank_transfer, mock (+ vnpay/momo/stripe stubs) |

---

## 5. UI

**Owner routes:** `/billing`, `/billing/current-plan`, `/billing/usage`, `/billing/invoices`, `/billing/payment`, `/billing/upgrade`, `/billing/support`

**Admin routes:** `/admin/billing`, `/admin/billing/tenants`, `/admin/billing/plans`, `/admin/billing/invoices`, `/admin/billing/payments`, `/admin/billing/audit`

**Guards:** `BillingAccessGate`, `TenantOperationalGate`, `useBilling` hook (no hard-coded plan logic in JSX)

---

## 6. Permission / RLS

- SUPER_ADMIN: full billing
- COURT_OWNER: view-only billing (đã gỡ BILLING_MANAGE khỏi owner)
- COURT_MANAGER/CASHIER/REFEREE/PLAYER: no billing management
- RLS: tenant isolation on all billing tables

---

## 7. Test / Build

| Command | Result |
|---------|--------|
| `npm run lint` | ✅ 0 errors |
| `npm test` | ✅ 606/606 |
| `billing-phase9.test.js` | ✅ 14/14 |
| `npm run build` | ✅ PASS |
| Mobile Phase 8 | ✅ Pass |

---

## Phase 9 Final Hardening Result

**Ngày:** 2026-07-01  
**Trạng thái:** ✅ Code complete — ⏳ Staging gate **gần pass** (Final Manual QA Gate)

| Gate | Result |
|------|--------|
| Full test suite | ✅ 616/616 pass |
| 2 pre-existing test failures | ✅ Fixed |
| Billing Supabase repository bridge | ✅ `src/features/billing/repositories/` |
| Legacy subscription deduped | ✅ Bridge replaces TenantContext lifecycle |
| SQL staging | ✅ 8/8 tables (`verify-billing-phase9-staging.mjs`) |
| Vercel `VITE_BILLING_SUPABASE=true` | ✅ User bật + redeploy |
| Repository Supabase mode | ✅ `store.mode === "supabase"` khi flag + Supabase env |
| Hydrate/persist runtime | ✅ `billingStoreRuntime.js` + `useBilling` wired |
| Trial RPC (Option B) | ✅ SQL + `billingTrialRpc.js` — apply staging pending |
| RLS anon | ✅ 8/8 blocked |
| RLS cross-tenant (authenticated) | ⏳ Manual 2-user smoke |
| Browser QA Owner/Admin | ⏳ Manual sau redeploy |
| Lint / Build | ✅ 0 errors / PASS |
| **Chuyển Phase 10** | ⏳ **Chưa** — browser QA + trial RPC apply + cross-tenant |

---

## Phase 9 Staging Verification Result

**Ngày gate:** 2026-07-01 (Final Manual QA Gate)  
**Verify script:** `scripts/verify-billing-phase9-staging.mjs`

| Hạng mục | Kết quả |
|----------|---------|
| SQL staging đã apply | ✅ 8/8 tables |
| `VITE_BILLING_SUPABASE` Vercel Preview | ✅ Bật + redeploy |
| RLS anon | ✅ 8/8 blocked |
| Cross-tenant smoke | ✅ Service layer + anon RLS; ⏳ authenticated manual |
| Owner `/billing/*` (code) | ✅ 7 routes + RBAC |
| Admin `/admin/billing/*` (code) | ✅ 6 routes + `BILLING_MANAGE` |
| Owner/Admin browser QA | ⏳ Manual trên preview |
| Repository Supabase mode | ✅ Init supabase store |
| Hydrate/persist | ✅ Wired |
| Trial RPC | ✅ Code + SQL patch; ⏳ apply staging |
| Local full test | ✅ 616/616 |
| Browser QA | ⏳ User manual |
| **Phase 10** | ⏳ Browser + cross-tenant + trial RPC apply |

---

## Phase 9 Final Browser QA Result (2026-07-01)

| Hạng mục | Automated | Browser manual |
|----------|-----------|----------------|
| Vercel redeploy hydrate/persist code | ⏳ User | — |
| `VITE_BILLING_SUPABASE=true` | ✅ Env set | ⏳ Confirm post-redeploy |
| Owner `/billing/*` | ✅ RBAC/hydrate | ⏳ |
| Admin `/admin/billing/*` | ✅ RBAC/persist | ⏳ |
| Cross-tenant JWT | ⏳ Script + creds | ⏳ |
| Trial onboarding | ✅ Option B RPC | ⏳ Apply SQL |
| npm test 616/616 | ✅ | — |

**Kết luận Phase 9:** Code + automated gate **PASS**. Final gate **chưa đóng** — cần browser QA + trial RPC apply staging.

---

## 8. Rủi ro còn lại

1. ~~Billing data localStorage~~ → ✅ Supabase hydrate/persist wired in `useBilling`
2. ~~Legacy subscriptionLifecycleService song song~~ → TenantContext dùng bridge; legacy chỉ cho subscriptionGuard + Sprint 4 tests
3. ~~RLS SQL chưa apply staging~~ → ✅ applied 8/8
4. Authenticated cross-tenant RLS chưa smoke test (2 user JWT)
5. Trial RPC SQL chưa apply staging (`supabase-billing-phase9-trial-rpc.sql`)
6. Browser QA Owner/Admin chưa chạy trên Vercel preview
7. VNPay/MoMo/Stripe chưa có staging credential

---

## 9. Trước production

1. ~~Apply `supabase-billing-phase9.sql` staging~~ ✅
2. ~~Wire `hydrateAll` / `persistCollection` trong billing runtime~~ ✅
3. Apply `supabase-billing-phase9-trial-rpc.sql` staging
4. QA owner + admin billing flows trên Vercel preview (sau redeploy)
5. Security/RLS verification cross-tenant (authenticated)

---

## 10. Kết luận

**Phase 9 code complete** — automated gate pass (616 tests, lint, build, staging SQL, anon RLS, hydrate/persist, trial RPC code). Không deploy production.

**Chuyển Phase 10:** ⏳ **Chưa** — redeploy preview, apply trial RPC SQL, browser QA, authenticated cross-tenant.

**Bước tiếp theo:**

1. Redeploy Vercel Preview + apply `supabase-billing-phase9-trial-rpc.sql`
2. Browser QA Owner + Admin (checklist `PHASE_9_STAGING_BILLING_APPLY.md`)
3. Cross-tenant smoke (`verify-billing-cross-tenant-staging.mjs` + creds)
4. Phase 10 — QA & Release

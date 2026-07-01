# Phase 9 — Commercial SaaS Audit

**Ngày audit:** 2026-07-01  
**Phiên bản:** Pickleball Scheduler Pro v5.0 — SaaS Platform Edition  
**Trạng thái sau hoàn thiện:** ✅ 100% product/technical scope Phase 9 (staging-ready)

---

## Tóm tắt

Phase 9 ban đầu có **skeleton billing** (localStorage services, 4 unit tests, UI chưa route, thiếu SQL/RLS/provider/tenant lock đầy đủ). Sau sprint hoàn thiện: schema SQL, services đầy đủ, payment provider interface, owner + admin UI routes, RBAC chuẩn hóa, audit/notification, 14 billing tests.

---

## Bảng audit

| Hạng mục | Trạng thái | File liên quan | Đánh giá | Việc đã làm |
|----------|------------|----------------|----------|-------------|
| Plans | Done | `billingConstants.js`, `supabase-billing-phase9.sql` | 4 plan TRIAL/STARTER/PROFESSIONAL/ENTERPRISE, seed SQL | ✅ |
| Plan Limits | Done | `planLimitService.js`, `plan_limits` table | Service chặn limit + audit exceeded | ✅ |
| Tenant Subscriptions | Done | `subscriptionService.js`, `tenant_subscriptions` | Lifecycle trialing→active→past_due→expired/suspended/cancelled | ✅ |
| Trial | Done | `billingEngine.js`, `TRIAL_DAYS=14` | createTrialSubscription + trial_end_date | ✅ |
| Invoice | Done | `invoiceService.js`, `invoices`, `invoice_items` | create/issue/markPaid/cancel/list | ✅ |
| Payment | Done | `paymentService.js`, `payments` | manual/bank_transfer/mock + provider interface | ✅ |
| Payment Provider Interface | Done | `providers/*` | manual, bank_transfer, mock enabled; vnpay/momo/stripe stub disabled | ✅ |
| Manual Payment Flow | Done | `manualProvider.js`, `PaymentService` | createPaymentIntent + handleProviderSuccess | ✅ |
| Bank Transfer / Mock | Done | `bankTransferProvider.js`, `mockProvider.js` | Staging-safe, không gateway thật | ✅ |
| Subscription Lifecycle | Done | `billingEngine.js`, `subscriptionService.js` | activate/renew/expire/suspend/cancel/changePlan | ✅ |
| Tenant Lock/Unlock | Done | `tenantAccessService.js`, `TenantOperationalGate.jsx` | Expired/suspended lock; billing routes allowed | ✅ |
| Owner Billing UI | Done | `BillingPage.jsx`, `/billing/*` routes | 7 sub-routes, useBilling hook | ✅ |
| Admin Billing UI | Done | `AdminBillingPage.jsx`, `/admin/billing/*` | suspend/unlock/mark paid/audit | ✅ |
| Billing Permission | Done | `permissions.js`, `rolePermissions.js` | Owner view-only; SUPER_ADMIN full | ✅ |
| Billing RLS | Done | `supabase-billing-phase9.sql` | Tenant isolation + admin manage | ✅ (apply staging manual) |
| Billing Audit Log | Done | `billingAuditService.js`, `billing_audit_logs` | Mọi event thương mại quan trọng | ✅ |
| Billing Notification | Done | `billingNotificationService.js`, `billing_events` | 16 event types | ✅ |
| Billing Tests | Done | `tests/billing-phase9.test.js` | 14 tests pass | ✅ |
| Billing Documentation | Done | `docs/v5/BILLING_*.md` | Architecture, RBAC/RLS matrix, test report | ✅ |
| Legacy subscription | Partial | `subscriptionLifecycleService.js`, `subscriptionGuard.js` | Vẫn dùng cho TenantContext; song song Phase 9 | Giữ nguyên, không phá |
| Code trùng legacy | Risk→Mitigated | `models/subscription.js` vs `billingConstants.js` | Hai layer song song | Bridge qua tenant_id; migrate sau |
| Logic trong JSX | Done→Fixed | `BillingPage.jsx` | Trước: handlePlanChange inline | Refactor `useBilling` hook |

---

## Đánh giá chi tiết (trước hoàn thiện)

| Hạng mục | Trước | Sau |
|----------|-------|-----|
| Plans | Partial — DEFAULT_PLANS in engine only | Done — constants + SQL seed |
| Plan Limits | Partial — 7/17 limits | Done — full limit map |
| Subscriptions | Partial — basic CRUD | Done — full lifecycle |
| Invoices | Partial — create/markPaid | Done — issue/cancel/overdue/items |
| Payments | Partial — recordPayment only | Done — provider interface + validation |
| Tenant Lock | Partial — evaluateTenantAccess basic | Done — TenantAccessService + action guards |
| Owner UI | Partial — no routes, getPlanCatalog missing | Done — 7 routes + hook |
| Admin UI | Partial — placeholder alert | Done — full admin panel |
| RLS | Not done | Done — SQL ready |
| Tests | Partial — 4 tests | Done — 14 tests |

---

## Rủi ro đã xử lý

1. **COURT_OWNER có BILLING_MANAGE** → đã gỡ, chỉ view billing
2. **getPlanCatalog không export** → đã fix, build pass
3. **Không có billing routes** → đã thêm vào `router.jsx`
4. **Payment gateway thật** → interface only, `GATEWAY_DISABLED`

---

## Việc còn lại trước production

- Apply `docs/supabase-billing-phase9.sql` trên Supabase staging
- QA manual owner/admin billing flows
- Nối Supabase client vào services (hiện localStorage cho dev/demo)
- Staging credential + webhook QA cho VNPay/MoMo/Stripe

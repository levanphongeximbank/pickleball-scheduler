# Billing RBAC & RLS Matrix — Phase 9

## Permissions

| Permission | Description |
|------------|-------------|
| billing.view | Xem billing overview |
| billing.manage | Admin billing management |
| billing.invoice.view | Xem invoices |
| billing.invoice.create | Tạo invoice (admin) |
| billing.invoice.mark_paid | Đánh dấu paid (admin) |
| billing.payment.view | Xem payments |
| billing.payment.manage | Ghi nhận payment (admin/cashier nếu cấp) |
| billing.subscription.view | Xem subscription |
| billing.subscription.manage | Quản lý subscription (admin) |
| billing.plan.view | Xem plans |
| billing.plan.manage | CRUD plans (admin) |
| billing.tenant.lock | Khóa tenant |
| billing.tenant.unlock | Mở khóa tenant |
| billing.audit.view | Xem billing audit |

## Role defaults

| Role | Billing permissions |
|------|---------------------|
| SUPER_ADMIN | ALL |
| COURT_OWNER (TENANT_OWNER) | view, invoice.view, payment.view, subscription.view |
| COURT_MANAGER | None |
| CASHIER | None (có thể cấp payment.view/manage riêng) |
| ACCOUNTANT | None |
| REFEREE | None |
| CLUB_OWNER | None |
| PLAYER | None |

## Route access (`menuAccess.js`)

| Route | Permission |
|-------|------------|
| /billing/* | billing.view (+ invoice.view cho invoices) |
| /admin/billing/* | billing.manage |

## RLS policies (Supabase)

### plans
- SELECT: active plans OR super_admin
- ALL: super_admin only

### plan_limits
- SELECT: authenticated
- ALL: super_admin

### tenant_subscriptions
- SELECT: own tenant OR super_admin (`tenant_id` = `profiles.venue_id`)
- ALL: super_admin (owner không sửa status)
- INSERT trial: RPC `billing_create_trial_subscription` (security definer) — không insert trực tiếp

### invoices
- SELECT: own tenant OR super_admin
- INSERT/UPDATE: super_admin

### payments
- SELECT: own tenant OR super_admin
- ALL: super_admin (owner không sửa status)

### billing_events / billing_audit_logs
- SELECT: own tenant OR super_admin
- INSERT audit: super_admin OR own tenant (service-side)

## Tenant isolation tests

- `billing-phase9.test.js`: invoice list filtered by tenant_id
- RBAC: COURT_OWNER không có billing.manage
- Mobile Phase 8: REFEREE không thấy billing nav

## Phase 9 Final Hardening — RLS verification status

| Role | Expected | Automated | Staging manual |
|------|----------|-----------|----------------|
| SUPER_ADMIN | Full billing CRUD | ✅ RBAC tests | ⏳ SQL apply pending |
| COURT_OWNER / TENANT_OWNER | Own tenant read-only | ✅ service-layer isolation | ⏳ cross-tenant SQL |
| CASHIER | No subscription manage | ✅ RBAC test | ⏳ |
| STAFF / REFEREE / PLAYER | No billing management | ✅ RBAC test | ⏳ |
| Cross-tenant | A cannot read B invoices/payments | ✅ service test | ⏳ Supabase client QA |

**Staging checklist:** `docs/v5/PHASE_9_STAGING_BILLING_APPLY.md`

---

## Phase 9 Staging Verification Result (2026-07-01)

**Probe:** `node scripts/verify-billing-phase9-staging.mjs` → **8/8 billing tables OK**, **8/8 anon blocked**.

| Role | Automated (local) | Staging DB |
|------|-----------------|------------|
| SUPER_ADMIN | ✅ `billing-phase9.test.js` + `rbac.test.js` | ⏳ Manual JWT smoke |
| COURT_OWNER / TENANT_OWNER | ✅ view-only; no `billing.manage` | ⏳ Cross-tenant authenticated manual |
| CASHIER | ✅ no subscription manage | ✅ N/A (no billing perms) |
| STAFF | ✅ no billing nav | ✅ N/A |
| REFEREE | ✅ no billing nav (`mobile-phase8-hardening`) | ✅ N/A |
| PLAYER | ✅ no billing management | ✅ N/A |
| Cross-tenant isolation | ✅ service-layer invoice filter test | ✅ anon RLS; ⏳ authenticated 2-user |

**RLS policies in SQL** (`supabase-billing-phase9.sql`): reviewed ✅ — owner read own tenant via `profiles.venue_id`; admin-only write on subscriptions/invoices/payments.

**Vercel:** `VITE_BILLING_SUPABASE=true` ✅ — repository init Supabase mode + hydrate/persist.

**Trial RPC:** `billing_create_trial_subscription` — ✅ applied staging; validates `venues.id`, uses `user_venue_id()` for owners.

**App tenant resolution (2026-07-01):** `resolveBillingTenantId()` — `profiles.venue_id` / TenantContext; **không** `tenant-demo`.

**Gate status:** Anon RLS pass ✅. RPC probe pass ✅. Authenticated cross-tenant + browser QA **pending manual**.

## Expired tenant access

| Action | Allowed |
|--------|---------|
| view_billing | ✅ |
| create_booking | ❌ |
| create_tournament | ❌ |
| SUPER_ADMIN unlock | ✅ |

# Billing Architecture — Phase 9

## Overview

Phase 9 Commercial SaaS billing layer cho Pickleball Scheduler Pro v5.0.

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  BillingPage (/billing/*)  AdminBillingPage (/admin/billing/*) │
│  BillingAccessGate  TenantOperationalGate  useBilling hook   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     BillingEngine                            │
│  trial, renew, suspend, changePlan, payment success/fail     │
└───┬─────────┬──────────┬───────────┬────────────┬───────────┘
    │         │          │           │            │
    ▼         ▼          ▼           ▼            ▼
Subscription Invoice  Payment  PlanLimit  TenantAccess
 Service    Service   Service  Service    Service
    │         │          │           │            │
    └─────────┴──────────┴───────────┴────────────┘
                           │
              ┌────────────▼────────────┐
              │   billingStorage (LS)  │  ← dev/demo
              │   Supabase (staging+)    │  ← production path
              └─────────────────────────┘
```

## Data model

| Table | Purpose |
|-------|---------|
| `plans` | Catalog TRIAL/STARTER/PROFESSIONAL/ENTERPRISE |
| `plan_limits` | Feature + quota per plan |
| `tenant_subscriptions` | Active subscription per venue/tenant |
| `invoices` | Billing documents |
| `invoice_items` | Line items |
| `payments` | Payment records per provider |
| `billing_events` | Notification events |
| `billing_audit_logs` | Commercial audit trail |

`tenant_id` = `venues.id` (text) — consistent with Sprint 2 multi-tenant.

## Services

### BillingEngine
Orchestrator: trial creation, invoice from subscription, payment success/fail, plan change, suspend/unlock, audit + notification emission.

### PlanLimitService
`checkLimit({ resource, currentUsage, planCode })` → `{ allowed, reason, limitCode, currentUsage, maxAllowed }`

Resources: venues, clubs, players, courts, tournaments, bookings, staff_users, referees, ai_features, mobile_app, advanced_dashboard, payment_gateway, api_access, custom_branding, multi_venue, offline_mode, push_notification.

### SubscriptionService
CRUD + activate, expire, suspend, cancel, renew, setPastDue, changePlan.

### InvoiceService
create, issue, markPaid, markOverdue, cancel, listByTenant, generateInvoiceNumber.

### PaymentService
createPaymentIntent (via provider), recordPayment, handleProviderSuccess/Fail, refund placeholder, validateInvoiceAmount.

### TenantAccessService
`evaluateAccess`, `canPerformAction`, `lockTenant`, `unlockTenant`, grace period.

## Payment providers

| Provider | Status |
|----------|--------|
| manual | ✅ Enabled |
| bank_transfer | ✅ Enabled |
| mock | ✅ Staging/test |
| vnpay | 🔒 Interface only |
| momo | 🔒 Interface only |
| stripe | 🔒 Interface only |

## Tenant lock rules

**Expired allowed:** login, view billing/invoice/payment, renewal request, support  
**Expired blocked:** create booking/tournament/player/court, AI, mobile advanced, bulk notification  
**Suspended:** stronger lock — only SUPER_ADMIN unlock/extend/mark paid

## Storage strategy

- **Repository layer:** `src/features/billing/repositories/` — `resolveBillingStoreMode()` → `memory` | `local` | `supabase`
- **Client dev/demo:** `createLocalStorageBillingStore()` keys `pickleball-billing-*-v1` (local mode)
- **Test:** `createMemoryBillingStore()` (memory mode, auto in `NODE_ENV=test`)
- **Production/staging path:** `createSupabaseBillingStore()` + `hydrate()` / `persistCollection()` (supabase mode when Supabase env set)
- **Legacy parallel:** `subscriptionLifecycleService.js` deprecated for tenant access — `subscriptionAccessBridge.js` is source of truth for `TenantContext`

### Supabase hydrate/persist runtime wiring

```
VITE_BILLING_SUPABASE=true + VITE_SUPABASE_*
        │
        ▼
getBillingStore() ──► createSupabaseBillingStore()
        │                    │
        │                    ├─ hydrateAll() via ensureBillingStoreHydrated()
        │                    └─ persistCollection() via persistBillingCollections()
        ▼
useBilling bootstrap
  ├─ billingLoading / billingError
  ├─ skip seedDefaults() (plans from DB)
  └─ runMutation() → persist BILLING_PERSIST_SETS.*
```

| Mode | Hydrate | Persist | Seed |
|------|---------|---------|------|
| `supabase` | `useBilling` + `getBillingStore()` kickoff | `persistChanges()` after mutations | ❌ (DB seed SQL) |
| `local` | — | localStorage via `write()` | ✅ `seedDefaults()` |
| `memory` | — | in-memory only | ✅ `seedDefaults()` |

**Runtime modules:** `billingStoreRuntime.js`, `billingRowMap.js`, `billingTrialRpc.js`, `useBilling.js`

**Trial onboarding:** RPC `billing_create_trial_subscription` (Option B) — xem `docs/supabase-billing-phase9-trial-rpc.sql`. Owner không insert trực tiếp; SUPER_ADMIN onboarding (Option A) cho tenant mới.

**Persist sets:** `BILLING_PERSIST_SETS.SUBSCRIPTION | INVOICE | PAYMENT | PLAN_CHANGE`

### Repositories

| Repository | Collection | Supabase table |
|------------|------------|----------------|
| PlanRepository | plans | plans |
| PlanLimitRepository | planLimits | plan_limits |
| SubscriptionRepository | subscriptions | tenant_subscriptions |
| InvoiceRepository | invoices | invoices |
| PaymentRepository | payments | payments |
| BillingAuditRepository | billingAuditLogs | billing_audit_logs |

Services/engine use `store.read/write` only — never localStorage directly.

## Module path

`src/features/billing/` — export via `index.js`

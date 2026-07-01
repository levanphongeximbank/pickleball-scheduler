# Billing Test Report — Phase 9

**Date:** 2026-07-01

## Billing-specific tests

```bash
node --test tests/billing-phase9.test.js
```

**Result:** ✅ 14/14 pass

| Test | Status |
|------|--------|
| BillingEngine trial + expired lock | ✅ |
| PlanLimitService limits | ✅ |
| SubscriptionService lifecycle | ✅ |
| Invoice + Payment flow | ✅ |
| TenantAccessService expired/suspended | ✅ |
| Grace period | ✅ |
| Plan upgrade audit/notification | ✅ |
| Payment providers manual/vnpay | ✅ |
| RBAC SUPER_ADMIN vs COURT_OWNER | ✅ |
| RBAC CASHIER no subscription manage | ✅ |
| Tenant invoice isolation | ✅ |
| Suspended stronger lock | ✅ |
| Payment failed keeps subscription | ✅ |
| Admin unlock tenant | ✅ |

## Full suite

```bash
npm run lint    # 0 errors, 126 warnings (pre-existing)
npm test        # 606/606 pass
npm run build   # ✅ PASS
```

## Phase 9 Final Hardening Result (2026-07-01)

| Item | Status |
|------|--------|
| 2 failing tests fixed | ✅ auth signOut sync clear + tenant await signOut |
| Billing repository / Supabase bridge | ✅ `repositories/` + `resolveBillingStoreMode()` |
| Legacy subscription conflict | ✅ `subscriptionAccessBridge` → TenantContext SoT |
| SQL staging apply | ⏳ Manual guide: `PHASE_9_STAGING_BILLING_APPLY.md` |
| RLS/RBAC verification | ✅ Automated RBAC + service isolation; ⏳ staging SQL manual |
| Full test suite | ✅ 606/606 |
| Lint | ✅ 0 errors |
| Build | ✅ PASS |
| Phase 10 ready | ✅ Yes (staging SQL apply + manual RLS QA remain) |

## Mobile Phase 8 regression

```bash
node --test tests/mobile-phase8-hardening.test.js tests/mobile-sprint9.test.js
```

**Result:** ✅ Pass (included in full suite)

## RBAC regression

```bash
node --test tests/rbac.test.js
```

**Result:** ✅ Pass — rolePermissions COURT_OWNER billing view-only verified

## Staging manual QA (Final Manual QA Gate — 2026-07-01)

- [x] Apply `supabase-billing-phase9.sql` on staging — 8/8 tables OK
- [x] `VITE_BILLING_SUPABASE=true` on Vercel Preview — user bật + redeploy
- [x] Repository Supabase mode — `createBillingStore()` → `store.mode === "supabase"`
- [x] Anon RLS — 8/8 tables blocked
- [x] Automated cross-tenant — service layer (`billing-phase9.test.js`)
- [ ] Owner `/billing/*` — browser QA trên preview (COURT_OWNER)
- [ ] Admin `/admin/billing/*` — browser QA (SUPER_ADMIN suspend/unlock/mark paid)
- [ ] Authenticated cross-tenant RLS — owner A không đọc data tenant B
- [x] Wire `useBilling` → `hydrateAll()` / `persistCollection()` — ✅ 2026-07-01
- [x] VNPay/MoMo/Stripe remain disabled (provider tests pass)

---

## Phase 9 Final Manual QA Gate (2026-07-01)

### Staging probe

```bash
node scripts/verify-billing-phase9-staging.mjs
```

**Result:** ✅ PASS — 8/8 tables, 8/8 anon blocked.

### Supabase hydrate/persist runtime wiring

| Item | Status |
|------|--------|
| `hydrateAll()` in `useBilling` | ✅ |
| `persistCollection()` via `persistChanges()` | ✅ |
| `billingStoreRuntime.js` helpers | ✅ |
| `billingRowMap.js` plan_id mapping | ✅ |
| `BillingEngine.seedDefaults()` skip supabase | ✅ |
| Error state (hydrate/persist) không crash | ✅ |
| Tests `billing-repository-runtime.test.js` | ✅ 10/10 (incl. trial RPC) |
| Trial RPC `billing_create_trial_subscription` | ✅ Code + SQL patch |

## Phase 9 Final Browser QA Result (2026-07-01)

| Item | Status |
|------|--------|
| Vercel Preview redeploy | ⏳ User — sau merge hydrate/persist + trial RPC |
| Owner `/billing/*` browser | ⏳ Manual |
| Admin `/admin/billing/*` browser | ⏳ Manual |
| Cross-tenant JWT | ⏳ `verify-billing-cross-tenant-staging.mjs` + creds |
| Trial RPC SQL apply staging | ⏳ `supabase-billing-phase9-trial-rpc.sql` |

### Re-run local verification (gate)

| Command | Result |
|---------|--------|
| `node --test tests/billing-phase9.test.js` | ✅ 14/14 |
| `node --test tests/billing-repository-runtime.test.js` | ✅ 10/10 |
| `node scripts/verify-billing-cross-tenant-staging.mjs` | ⏳ Cần staging user creds |
| `npm test` | ✅ 616/616 |
| `npm run lint` | ✅ 0 errors, 121 warnings |
| `npm run build` | ✅ PASS |

### Staging QA checklist

| Item | Status |
|------|--------|
| SQL 8 tables | ✅ |
| Vercel `VITE_BILLING_SUPABASE=true` | ✅ |
| Repository Supabase mode init | ✅ |
| Hydrate/persist runtime | ✅ Wired |
| Anon RLS | ✅ 8/8 |
| Cross-tenant (service) | ✅ |
| Cross-tenant (RLS authenticated) | ⏳ Manual |
| Trial RPC SQL apply | ⏳ |
| Owner browser QA | ⏳ Manual |
| Admin browser QA | ⏳ Manual |
| Cross-tenant authenticated | ⏳ Manual / script |

### Phase 10 ready?

**Code / automated gate:** ✅ Pass (616 tests)  
**Final browser gate:** ⏳ Pending — redeploy + trial RPC apply + manual QA

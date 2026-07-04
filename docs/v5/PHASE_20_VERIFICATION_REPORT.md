# Phase 20 — Verification Report

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Commit (trước commit Phase 20):** `9f63fce5f8fbace6752668500ad78cc720f1ebb1`

---

## Summary

| Gate | Kết quả |
|------|---------|
| `npm test` | ✅ **766/766 PASS** |
| `npm run build` | ✅ PASS (3.24s) |
| `npm run lint` | ⚠️ **1 error fixed** trong Phase 20 tests; 128 warnings legacy (không mới) |

**Verdict tổng thể:** **PARTIAL PASS** — code + automated gates PASS; pilot manual QA (mobile thiết bị thật, staging trial RPC) cần owner thực hiện theo checklist.

---

## Files changed (Phase 20)

### Code

| File | Thay đổi |
|------|----------|
| `src/features/billing/services/tenantAccessResolver.js` | **Mới** — SSOT helpers |
| `src/features/billing/services/tenantAccessService.js` | `no_subscription` → blocked |
| `src/features/billing/services/subscriptionService.js` | `checkTenantAccess` blocked |
| `src/features/billing/bridges/subscriptionAccessBridge.js` | `assertSubscriptionOperational` blocked |
| `src/features/billing/guards/operationalRoutePolicy.js` | **Mới** — exempt paths |
| `src/features/billing/components/OperationalRouteGate.jsx` | **Mới** — layout gate |
| `src/features/billing/components/TenantOperationalGate.jsx` | UI tiếng Việt |
| `src/layouts/MainLayout.jsx` | Wire `OperationalRouteGate` |
| `src/features/court-engine/storage/courtEngineStorage.js` | Tenant-scoped keys |
| `src/features/court-engine/services/courtSessionService.js` | Pass tenant scope |
| `src/config/appVersion.js` | `V5.0 SaaS Preview RC1` |
| `package.json` | `5.0.0-rc1` + test scripts |

### Tests

| File | Thay đổi |
|------|----------|
| `tests/billing-phase20-pilot-hardening.test.js` | **Mới** — 7 tests |
| `tests/court-engine-storage.test.js` | **Mới** — 5 tests |
| `tests/billing-phase9.test.js` | Regression `no_subscription` |
| `tests/billing-tenant-mapping.test.js` | `NO_SUBSCRIPTION` blocks |
| `tests/app-shell-v5.test.js` | Version + OperationalRouteGate |

### Docs

- `docs/v5/PHASE_20_V5_PILOT_HARDENING_PLAN.md`
- `docs/v5/PHASE_20_COURT_ENGINE_PERSISTENCE.md`
- `docs/v5/PHASE_20_PILOT_SETUP_CHECKLIST.md`
- `docs/v5/PHASE_20_MOBILE_PILOT_QA.md`
- `docs/v5/RELEASE_NOTES_v5.0-rc1.md`

---

## Tests run

```bash
npm test          # 766 pass, 0 fail
npm run build     # success
npm run lint      # 0 errors after fix (128 pre-existing warnings)
```

### Phase 20 tests cụ thể

- `no_subscription` blocked — regression ✅
- `trialing` / `active` operational ✅
- `expired` / `suspended` locked ✅
- Billing exempt paths ✅
- `past_due` grace ✅
- Court engine tenant isolation ✅

---

## Behavior changes (no_subscription fix)

| File | Trước | Sau |
|------|-------|-----|
| `tenantAccessService.js` | `no_subscription` → `allowed: true` | `allowed: false` |
| `subscriptionService.js` | `allowed: true` | `allowed: false` |
| `subscriptionAccessBridge.js` | `ok: true` khi không có sub | `ok: false`, code `NO_SUBSCRIPTION` |
| `MainLayout.jsx` | `SubscriptionGate` (legacy bridge) | `OperationalRouteGate` + Phase 9 billing |

---

## Remaining risks

1. **Manual mobile QA** chưa chạy trên Android/iPhone thật
2. **Court Engine** vẫn localStorage — pilot cần backup
3. **Sprint 4 `subscriptionGuard`** vẫn dùng local venue plans (limits only)
4. **Staging trial RPC** — cần verify trên Supabase staging thật
5. **Payment** mock/manual only
6. **Lint warnings** legacy (128) — không chặn pilot

---

## Go/No-Go cho pilot 1 sân

| Tiêu chí | Trạng thái |
|----------|------------|
| Automated tests | ✅ GO |
| Build | ✅ GO |
| Billing lock wired | ✅ GO |
| no_subscription regression | ✅ GO |
| Staging tenant + trial (manual) | ⏳ Owner checklist |
| Mobile device QA | ⏳ Owner checklist |

**Go/No-Go:** **CONDITIONAL GO** — có thể bắt đầu pilot staging sau khi hoàn tất `PHASE_20_PILOT_SETUP_CHECKLIST.md` bước 1–8.

---

## Đề xuất Phase 21

1. Production Preflight SQL apply (Phase 19A tiếp)
2. Staging smoke với owner thật + trial RPC
3. Court Engine Supabase persistence design
4. Payment gateway staging (không live)
5. Mobile GA checklist hoàn tất

---

## Staging scripts (không chạy — thiếu credentials)

```bash
npm run test:verify-mobile-staging
npm run test:verify-phase16-kn6
node scripts/verify-billing-tenant-mapping-staging.mjs
```

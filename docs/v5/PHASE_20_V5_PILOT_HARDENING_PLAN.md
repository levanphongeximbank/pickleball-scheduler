# Phase 20 — V5 Pilot Hardening Plan

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Mục tiêu:** V5.0 SaaS **Pilot-ready** (1–2 venue có kiểm soát) — **không** production thương mại.

---

## Current state (sau inspection)

| Khu vực | Trạng thái trước Phase 20 | Ghi chú |
|---------|---------------------------|---------|
| Billing Phase 9 | Có `tenant_subscriptions` Supabase + local fallback | `TenantAccessService` cho phép `no_subscription → allowed: true` |
| Sprint 4 subscription | `subscriptionGuard.js` — plan limits, local venue | Giữ cho feature limits; **không** là SSOT access |
| `TenantOperationalGate` | Component có, **chưa wire** route | `MainLayout` dùng `SubscriptionGate` legacy |
| `assertSubscriptionOperational` | Bridge Phase 9 cho phép `NO_SUBSCRIPTION` | Rủi ro full access |
| Court Engine storage | `localStorage` keyed theo `clubId` | Chưa tenant-scoped |
| Version | `package.json` 4.0.0 vs UI `V5.0 SaaS Preview` | Lệch nhau |
| Mobile/PWA | Sprint 9 code có, QA thiết bị thật chưa đủ | Cần checklist pilot |
| Payment gateway | Mock/manual only | Đúng phạm vi Phase 20 |

### Files đã inspect

- `src/auth/subscriptionGuard.js` — Sprint 4 plan limits (clubs/courts/users/features)
- `src/features/billing/services/tenantAccessService.js` — **bug** `no_subscription`
- `src/features/billing/components/TenantOperationalGate.jsx` — chưa gắn layout
- `src/features/billing/bridges/subscriptionAccessBridge.js` — TenantContext subscription check
- `src/layouts/MainLayout.jsx` — shell protected routes
- `src/features/court-engine/storage/courtEngineStorage.js` — local-only
- `src/config/appVersion.js`, `package.json`

---

## Scope (Phase 20)

1. **Billing SSOT** — Phase 9 `tenant_subscriptions` qua `tenantAccessResolver.js`
2. **Wire `OperationalRouteGate`** vào `MainLayout` — khóa route vận hành
3. **Fix `no_subscription`** — khóa vận hành, chỉ billing/support
4. **Court Engine pilot-safe** — tenant-scoped local keys + export/import
5. **Checklists** — pilot setup + mobile QA
6. **Version alignment** — `5.0.0-rc1` / `V5.0 SaaS Preview RC1`
7. **Verification report** — test + build + lint

---

## Non-goals

- Không deploy production
- Không bật payment live (VNPay/MoMo/Stripe)
- Không migrate production DB
- Không xóa legacy Sprint 4 code
- Không cloud-native 100% Court Engine / Club blob
- Không đổi app shell architecture lớn

---

## Risk list

| # | Rủi ro | Mức | Mitigation Phase 20 |
|---|--------|-----|---------------------|
| R1 | Owner chưa có trial RPC trên staging | Cao | Checklist bước 4; `ensureTrialSubscriptionRpc` |
| R2 | Court Engine vẫn localStorage | Trung bình | Tenant-scoped keys; docs + backup |
| R3 | Hai hệ subscription gây nhầm | Trung bình | SSOT resolver; bridge chặn no_sub |
| R4 | SUPER_ADMIN bypass gate | Thấp | Cố ý — admin vận hành platform |
| R5 | Mobile QA thiết bị thật chưa xong | Trung bình | Checklist manual Phase 20 |
| R6 | `useBilling` auto-trial local dev | Thấp | Chỉ local store; Supabase dùng RPC |

---

## Implementation checklist

- [x] `tenantAccessResolver.js` — `resolveTenantAccessStatus`, `isTenantOperational`, `getTenantSubscriptionState`
- [x] Fix `TenantAccessService.evaluateAccess` — `no_subscription` → `allowed: false`
- [x] Fix `SubscriptionService.checkTenantAccess`
- [x] Fix `assertSubscriptionOperational` bridge
- [x] `OperationalRouteGate` + `operationalRoutePolicy.js`
- [x] Wire vào `MainLayout.jsx`
- [x] Vietnamese UI trong `TenantOperationalGate`
- [x] Court engine tenant-scoped storage
- [x] Tests: `billing-phase20-pilot-hardening.test.js`, `court-engine-storage.test.js`
- [x] Docs: pilot setup, mobile QA, court persistence, release notes
- [x] Version `5.0.0-rc1`

---

## Verification commands

```bash
# Unit tests (bao gồm Phase 20)
npm test

# Build production bundle
npm run build

# Lint
npm run lint

# Staging scripts (cần credentials — không chạy tự động Phase 20)
npm run test:verify-mobile-staging
npm run test:verify-phase16-kn6
node scripts/verify-billing-tenant-mapping-staging.mjs
```

---

## Behavior matrix (sau Phase 20)

| Trạng thái | Quyền truy cập |
|------------|----------------|
| `trialing` | Cho dùng |
| `active` | Cho dùng |
| `past_due` trong grace | Cho dùng (cảnh báo banner) |
| `past_due` hết grace | Khóa vận hành |
| `expired` | Khóa vận hành |
| `cancelled` | Khóa vận hành |
| `suspended` | Khóa vận hành |
| `no_subscription` | Khóa vận hành; `/billing` OK |
| `tenant_not_found` | Chặn; báo lỗi cấu hình |

**Route exempt:** `/billing/*`, `/profile`, `/403`

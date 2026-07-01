# Subscription — Sprint 4

**Trạng thái:** Local-first lifecycle + UI banner/gate. Chưa deploy production.

## Gói (canonical plan id)

| Plan | Giá/tháng | Trial | Sân | CLB | User |
|------|-----------|-------|-----|-----|------|
| `trial` | 0 | 14 ngày | 4 | 2 | 5 |
| `starter` | 990k | — | 8 | 5 | 15 |
| `professional` | 1.99M | — | 20 | 20 | 50 |
| `enterprise` | 3.99M | — | 50 | 50 | 200 |

Alias legacy: `basic` → `starter`, `pro` → `professional`.

## Lifecycle tự động

```
currentPeriodEnd
  ├── còn hạn → OK
  ├── quá hạn ≤ 3 ngày → past_due + banner nhắc
  ├── quá hạn > 3 ngày → expired + khóa venue (suspended)
  └── autoRenew (gói trả phí) → gia hạn +1 tháng (dev: tự động)
```

Nhắc thanh toán: 7, 3, 1 ngày trước hết hạn.

## Module

```
src/features/subscription/
  constants/subscriptionPolicy.js
  services/subscriptionLifecycleService.js
  index.js

src/models/subscription.js          # plans + normalize
src/auth/subscriptionGuard.js       # feature/limit guards
src/domain/paymentService.js        # upgrade + webhook
src/components/SubscriptionBanner.jsx
src/components/SubscriptionGate.jsx
```

## Storage

- Subscriptions: `pickleball-subscriptions-v1` (qua `src/data/venue.js`)
- Tenant lock: `venues[].status = suspended` khi expired

## QA

`docs/SUBSCRIPTION-SPRINT4-CHECKLIST.md`

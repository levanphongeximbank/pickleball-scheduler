# Sprint 10 — API, Marketplace & Integrations

**Trạng thái:** Local-first foundation. Feature flags mặc định **tắt**. Chưa deploy production.

## Kiến trúc

```
src/features/
  api/              # invokeApi(), API keys, logs, OpenAPI docs
  marketplace/      # products, orders, entitlements
  payments/         # PaymentProvider (mock, vnpay, momo, stripe)
  notifications/    # NotificationProvider (mock, email, sms, zalo)
  integrations/     # tenant settings, webhooks, feature flags
```

## API layer

- Base path: `/api/v1` (client-side router `invokeApi()` — sẵn sàng migrate sang Edge Functions)
- Auth: session hiện có hoặc `X-API-Key` gắn tenant + scopes
- Response chuẩn: `{ success, data?, error?, meta? }`
- Docs: `docs/openapi.yaml`

## Feature flags (.env)

| Biến | Mặc định |
|------|----------|
| `VITE_API_ENABLED` | false |
| `VITE_MARKETPLACE_ENABLED` | false |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | mock |

## UI routes

| Route | Mô tả |
|-------|-------|
| `/marketplace` | Tenant mua gói |
| `/settings/integrations` | Quản lý tích hợp |
| `/admin/marketplace` | Admin sản phẩm/đơn |
| `/admin/integration-logs` | Monitoring |

## SQL (staging)

- Apply: `docs/supabase-sprint10.sql`
- Rollback: `docs/supabase-sprint10-rollback.sql`

## Tests

`tests/sprint10-integrations.test.js`

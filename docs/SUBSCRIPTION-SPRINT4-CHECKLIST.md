# Sprint 4 — Subscription Manual QA Checklist

**Trạng thái:** Local-first — automated tests pass, build pass.

## Chuẩn bị

1. `npm run dev`
2. Bật RBAC: **Cài đặt** → dev panel hoặc `VITE_RBAC_ENABLED=true`
3. Login tenant owner: `owner@futurearena.local`

## Gói thuê

| Gói | Giá | Giới hạn |
|-----|-----|----------|
| Trial | Miễn phí 14 ngày | 4 sân · 2 CLB · 5 user |
| Starter | 990k/tháng | 8 sân · 5 CLB · 15 user |
| Professional | 1.99M/tháng | 20 sân · 20 CLB · 50 user |
| Enterprise | 3.99M/tháng | 50 sân · 50 CLB · 200 user |

## Test 1: Chọn gói trong Cài đặt

- [ ] Vào **Cài đặt** → cuộn tới **Tenant / Venue**
- [ ] Thấy 4 thẻ gói: Trial, Starter, Professional, Enterprise
- [ ] Chọn **Starter** → thông báo thành công (dev mode)

## Test 2: Nhắc thanh toán (banner)

- [ ] DevTools → `localStorage` key subscriptions
- [ ] Sửa `currentPeriodEnd` còn 3 ngày
- [ ] Reload → banner vàng "còn 3 ngày" + nút **Gia hạn**

## Test 3: Past due (grace 3 ngày)

- [ ] Sửa `currentPeriodEnd` quá hạn 2 ngày, `status: "active"`
- [ ] Reload → banner cảnh báo quá hạn, app vẫn dùng được

## Test 4: Khóa khi hết hạn

- [ ] Sửa `currentPeriodEnd` quá hạn > 3 ngày
- [ ] Reload → màn hình **Gói thuê đã hết hạn** (SubscriptionGate)
- [ ] Tenant owner bị chặn; SUPER_ADMIN vẫn vào được

## Test 5: Gia hạn mở khóa

- [ ] SUPER_ADMIN login → vào tenant bị khóa
- [ ] **Cài đặt** → chọn lại gói trả phí
- [ ] Login lại owner → truy cập bình thường

## Test 6: Auto renew (dev)

- [ ] Gói Starter, `autoRenew: true`, `currentPeriodEnd` qua hạn 1 ngày
- [ ] Reload → kỳ mới +1 tháng, status `active`

## Test 7: Giới hạn gói

- [ ] Gói Trial → Director Mode bị chặn
- [ ] Nâng Professional → Director Mode mở

## Automated tests

```bash
node --test tests/subscription-sprint4.test.js
npm run test:unit
npm run build
```

## Supabase staging (optional)

Chạy `docs/supabase-subscription-sprint4.sql` sau sprint2 SQL.

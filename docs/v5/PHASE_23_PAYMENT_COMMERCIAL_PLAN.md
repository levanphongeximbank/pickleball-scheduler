# Phase 23 — Payment Commercial Plan

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Phạm vi:** Kế hoạch thương mại — **không bật payment live trong Phase 21**

---

## 1. Payment provider ưu tiên (Việt Nam)

| Provider | Vai trò | Ghi chú |
|----------|---------|---------|
| **VNPay** | Primary — thẻ nội địa, QR VNPay | Phổ biến B2B venue VN; cần merchant contract |
| **MoMo** | Primary mobile wallet | Phù hợp cá nhân/small venue |
| **Chuyển khoản / manual invoice** | Fallback B2B | `manualProvider.js` đã có — cần invoice pháp lý |
| **Stripe** | Phụ — quốc tế / expat | Chỉ nếu có nhu cầu USD; không ưu tiên VN core |

**Code hiện có:** `src/features/billing/providers/vnpayProvider.js`, `momoProvider.js`, `stripeProvider.js`, `manualProvider.js` — interface `paymentProviderInterface.js`.

---

## 2. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|----------|------------|
| Runtime mode | `VITE_PAYMENT_MODE=dev` |
| Default provider | `mock` / manual |
| Live gateway | ⛔ **Chưa** — không merchant keys production |
| Webhook verify | ⛔ Chưa staging E2E |
| Invoice pháp lý (VAT, MST) | ⛔ Chưa |
| Subscription renewal auto-charge | ⛔ Logic billing có; payment capture chưa live |
| Audit log payment events | ✅ Schema `payments`, `billing_audit_logs` (Phase 9 SQL) |

---

## 3. Cần có trước Commercial GA

### 3.1 Payment staging

- VNPay/MoMo **sandbox** credentials trên Vercel Preview only.
- Test flow: chọn plan → checkout → redirect → return URL.
- Không dùng production merchant trên staging URL công khai without IP restrict.

### 3.2 Webhook verify

- Endpoint server-side verify signature (VNPay `vnp_SecureHash`, MoMo signature).
- Idempotent webhook handler — `webhook_events` table (Sprint 10).
- Replay protection + audit row.

### 3.3 Invoice

- PDF/HTML invoice với thông tin pháp lý VN (tên công ty, MST, địa chỉ).
- Map `invoices` + `invoice_items` Phase 9 schema.
- Manual bank transfer — confirm workflow (`manualProvider.confirmPayment`).

### 3.4 Subscription renewal

- Tie payment success → `billingEngine.handlePaymentSuccess`.
- Auto-renew cron (Edge function hoặc external scheduler) — **server role**.
- Grace `past_due` đã wired app-side Phase 20.

### 3.5 past_due / grace lock

- App: `OperationalRouteGate` — ✅ Phase 20.
- Server: RPC lock subscription status — verify on staging.

### 3.6 Audit log

- Mọi payment attempt → `billing_audit_logs` + `payment_transactions`.
- Không log full card/account numbers.

### 3.7 Rollback / manual override

- Owner SUPER_ADMIN override subscription status (existing identity RPC).
- Refund policy documented — manual Phase 23 MVP.

---

## 4. Thứ tự triển khai đề xuất

```
Phase 21  — Design + blocker register (no live)
    ↓
Phase 23a — VNPay sandbox staging + webhook
    ↓
Phase 23b — MoMo sandbox + invoice template
    ↓
Phase 23c — Manual bank transfer production pilot (1 venue)
    ↓
Phase 23d — Live gateway owner sign-off (per provider)
```

---

## 5. Env flags (không bật Phase 21)

| Biến | Staging target | Production target |
|------|----------------|-------------------|
| `VITE_PAYMENT_MODE` | `staging` | `live` (sau sign-off) |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `vnpay` hoặc `momo` | Owner chọn |
| `VITE_VNPAY_*` | Sandbox | Live merchant |
| `VITE_MOMO_*` | Sandbox | Live |
| `VITE_STRIPE_*` | Test keys | Optional |

**Phase 21 rule:** Giữ `VITE_PAYMENT_MODE=dev` và `mock` provider trên mọi Production scope.

---

## 6. Rủi ro & compliance

| Rủi ro | Mitigation |
|--------|------------|
| PCI — lưu thẻ | Không lưu — redirect gateway |
| Thuế VAT | Invoice module + kế toán review |
| Chargeback | Manual policy Phase 23 MVP |
| Webhook spoof | Signature verify + IP allowlist |

---

## 7. Blocker link

- **B07** — Payment gateway mock/dev — `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md`
- Close condition: Payment staging PASS + owner sign-off live

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `docs/supabase-billing-phase9.sql` | Billing schema |
| `src/features/billing/services/billingEngine.js` | Renewal logic |
| `docs/v5/PHASE_9_COMMERCIAL_CLOSEOUT.md` | Phase 9 baseline |
| `docs/v5/PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | Flag sequencing |

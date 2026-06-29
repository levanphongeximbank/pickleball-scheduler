# Payment webhook — Stripe / VNPay

## Dev mode (mặc định)

`.env`:

```env
VITE_PAYMENT_MODE=dev
```

Nâng cấp gói trong **Cài đặt → Tenant** áp dụng ngay, ghi ledger local.

## Stripe Payment Links

```env
VITE_PAYMENT_MODE=stripe
VITE_STRIPE_LINK_BASIC=https://buy.stripe.com/...
VITE_STRIPE_LINK_PRO=https://buy.stripe.com/...
```

App redirect tới Payment Link với `client_reference_id={venueId}`.

## Webhook (Supabase Edge Function mẫu)

Sau khi thanh toán thành công, gọi logic tương tự `applyPaymentWebhook()`:

```typescript
// supabase/functions/payment-webhook/index.ts (mẫu)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const payload = await req.json();
  const venueId = payload?.data?.object?.client_reference_id;
  const planId = payload?.data?.object?.metadata?.plan_id || "pro";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await supabase.from("payment_events").insert({
    id: `pay-${Date.now()}`,
    venue_id: venueId,
    plan_id: planId,
    amount: payload?.data?.object?.amount_total || 0,
    provider: "stripe",
    status: "completed",
    external_id: payload?.data?.object?.id,
    payload,
  });

  await supabase.from("subscriptions").upsert({
    id: `sub-${venueId}`,
    venue_id: venueId,
    plan_id: planId,
    status: "active",
    updated_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

## App callback (dev simulate)

```javascript
import { applyPaymentWebhook } from "./src/domain/paymentService.js";

applyPaymentWebhook({
  venueId: "venue-demo",
  planId: "pro",
  status: "completed",
  provider: "dev",
});
```

Bảng `payment_events` — xem `docs/supabase-rbac.sql`.

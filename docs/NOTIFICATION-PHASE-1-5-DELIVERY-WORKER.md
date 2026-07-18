# Notification Phase 1.5 — Delivery Worker Foundation

**Target:** Staging only. Production untouched. No live Email/SMS/Zalo/Web Push.

## Scope

- Canonical delivery job state machine
- Atomic claim + lease (`notification_delivery_claim_jobs`)
- Attempt audit (`notification_delivery_attempts`)
- Retry / backoff / dead-letter
- Sandbox / disabled provider adapters
- In-app idempotent delivery (reuse inbox row)
- Staging QA cleanup RPC for `phase14s:` rows
- Controlled legacy dual-write retirement notes

## SQL

| File | Purpose |
|------|---------|
| `docs/supabase-notification-phase15.sql` | Apply |
| `docs/supabase-notification-phase15-rollback.sql` | Rollback |

```bash
node scripts/apply-notification-phase15-staging-sql.mjs
node scripts/verify-notification-phase15-delivery-worker-staging.mjs
npm run notification:verify:phase14s
```

## Worker

Server-side only:

```js
import { runNotificationWorkerOnce } from "./src/features/notifications/workers/notificationDeliveryWorker.js";
```

Production execution is blocked by default.

## Explicitly out of scope

- Live Email / SMS / Zalo / Web Push
- Competition Engine internals
- Production SQL apply / deploy / merge to main

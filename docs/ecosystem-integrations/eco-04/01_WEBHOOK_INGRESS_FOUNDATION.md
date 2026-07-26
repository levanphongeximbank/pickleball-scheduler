# ECO-04 — Webhook Ingress Foundation

## Goal

Establish a vendor-neutral webhook ingress foundation for Ecosystem &
Integrations: canonical ingress envelope, verification contracts, timestamp
tolerance / replay classification, idempotency projection, immutable
route/subscription registry, deterministic routing, ingress receipt +
observation metadata, failure mapping onto ECO error taxonomy with retry
classification metadata, and deterministic fake verifier/handler.

## Architecture decision

**PROVIDER-NEUTRAL WEBHOOK INGRESS FOUNDATION**

1. `createWebhookIngressEnvelope`
2. Verification request/result via `createWebhookVerificationRequest` /
   `verifyWebhookRequestFailClosed` (fail-closed)
3. `createWebhookTimestampPolicy` / `classifyWebhookTimestampTolerance`
4. `createWebhookReplayProjection` / `evaluateWebhookReplayProjection`
   (NEW / DUPLICATE / CONFLICT)
5. `createWebhookRouteDescriptor` + `createWebhookSubscriptionDescriptor`
6. `createWebhookRouteRegistry` (immutable, explicit input)
7. `routeWebhookIngress` (deterministic; Production blocked)
8. `createWebhookIngressReceipt`
9. `mapWebhookFailureToIntegrationError` (+ retry classification metadata)
10. `createWebhookIngressObservation`
11. `createFakeWebhookVerifier` + `createFakeWebhookIngressHandler`
12. Architecture / security certification tests

No live vendor webhooks. No network. No credentials. No global service locator.
`hasProductionWebhooks=false`, `productionBlocked=true`.

## Exact file scope

- `src/features/ecosystem-integrations/constants/catalogues.js`
- `src/features/ecosystem-integrations/contracts/webhookIngressEnvelope.js`
- `src/features/ecosystem-integrations/contracts/webhookTimestampTolerance.js`
- `src/features/ecosystem-integrations/contracts/webhookReplayProjection.js`
- `src/features/ecosystem-integrations/contracts/webhookRouteDescriptor.js`
- `src/features/ecosystem-integrations/contracts/webhookSubscriptionDescriptor.js`
- `src/features/ecosystem-integrations/contracts/webhookIngressReceipt.js`
- `src/features/ecosystem-integrations/contracts/webhookIngressObservation.js`
- `src/features/ecosystem-integrations/registry/createWebhookRouteRegistry.js`
- `src/features/ecosystem-integrations/routing/routeWebhookIngress.js`
- `src/features/ecosystem-integrations/errors/mapWebhookFailureToIntegrationError.js`
- `src/features/ecosystem-integrations/handlers/createFakeWebhookIngressHandler.js`
- `src/features/ecosystem-integrations/ports/webhookVerificationPort.js` (reuse)
- `src/features/ecosystem-integrations/index.js` / `ARCHITECTURE.md`
- `tests/ecosystem-integrations-eco-04-*.test.js`
- `docs/ecosystem-integrations/**`
- `scripts/ci/unit-test-files.json`

## Explicit non-goals

- No SQL / Supabase / migration / deployment
- No real VNPay / MoMo / Stripe / Zalo / SMS / SMTP / calendar / OAuth calls
- No live credential resolver / vault
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes
- No public Production webhook routes
- No retry worker / durable persistence

## Inventory / ownership (read-only audit)

| Surface | Owner | Gap vs ECO-04 |
|---------|-------|---------------|
| ECO webhook verification port | Ecosystem | Reused (fail-closed outcomes) |
| ECO idempotency projection | Ecosystem | Extended via webhook replay projection |
| Sprint 10 `webhookFoundation` / local `webhookEventService` | `src/features/integrations/` | Legacy design / localStorage — not ECO ingress |
| Finance payment provider webhook evidence contracts | Finance | Out of scope — consume later |
| Billing provider stubs | Billing | Interface only — out of scope |
| API `/webhooks/test` | API feature | Test harness only — not Production ingress |

## Follow-ups

- Staging-only webhook HTTP binding (Owner GO)
- Live vendor signature verifiers behind ECO ports (Owner GO)
- Durable idempotency store ownership (Owner GO)
- Gradual cutover of Sprint 10 / Finance callback evidence behind ECO ingress

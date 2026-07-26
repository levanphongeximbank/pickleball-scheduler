# Ecosystem & Integrations — Architecture (ECO-01 … ECO-04)

## Phase

**ECO-04 — Webhook Ingress Foundation**

Builds on ECO-01 connector/event foundation, ECO-02/ECO-02b secret boundary,
and ECO-03 provider adapter foundation. Adds provider-neutral webhook ingress
envelope, verification/replay classification, immutable route/subscription
registry, deterministic routing, ingress receipt/observation contracts,
failure→taxonomy mapping, and deterministic fake verifier/handler —
**contract-only, no live providers, no Production webhook routes**.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, adapter descriptors, invocation request/result, capability bindings, immutable registries, selection policy, readiness/observation projections, webhook ingress envelope/route registry/routing/receipt, error/retry/idempotency reuse, no-op/fake adapters + fake ingress handler, secret boundary + cutover policy |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Payment business state, ledger, notification content/recipients, booking rules, identity rules, competition rules |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue / Phase 11A local webhook_events design (not ECO ingress runtime) |

## Non-goals (ECO-04)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Live credential resolver / vault
- Network requests / public Production webhook HTTP routes
- Mutable global service locator
- Vendor-specific request/response models in canonical contracts
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy
- Retry worker / persistence ownership

## Public import

```js
import {
  createWebhookIngressEnvelope,
  createWebhookRouteRegistry,
  routeWebhookIngress,
  createFakeWebhookIngressHandler,
  createFakeWebhookVerifier,
  evaluateWebhookReplayProjection,
  mapWebhookFailureToIntegrationError,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO projects connector metadata onto Platform `IntegrationPortDescriptor` and
reads Capability Discovery via the public barrel `src/core/platform/index.js` only.
Idempotency keys reuse Platform `createIdempotencyKey`.

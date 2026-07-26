# Ecosystem & Integrations — Architecture (ECO-01 … ECO-05)

## Phase

**ECO-05 — Integration Observability & Structural Final Certification**

Builds on ECO-01→04. Adds canonical integration observation contract,
connector/provider/webhook observation aggregation, aggregate health/readiness
projection, audit-safe evidence projection, ECO-01→04 certification matrix,
and final structural readiness projection —
**contract-only, no live providers, no Production webhook routes**.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, adapter descriptors, invocation request/result, capability bindings, immutable registries, selection policy, readiness/observation projections, webhook ingress envelope/route registry/routing/receipt, observability aggregation, certification matrix, structural readiness, error/retry/idempotency reuse, no-op/fake adapters + fake ingress handler, secret boundary + cutover policy |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Payment business state, ledger, notification content/recipients, booking rules, identity rules, competition rules |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue / Phase 11A local webhook_events design (not ECO ingress runtime) |

## Non-goals (ECO-05)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Live credential resolver / vault
- Network requests / public Production webhook HTTP routes
- Mutable global service locator
- Vendor-specific request/response models in canonical contracts
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy
- Retry worker / persistence ownership
- Staging/Production activation (Owner GO required later)

## Public import

```js
import {
  createIntegrationObservation,
  aggregateIntegrationObservations,
  projectAggregateIntegrationHealth,
  projectAuditSafeEvidence,
  projectCertificationMatrix,
  projectStructuralFoundationReadiness,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO projects connector metadata onto Platform `IntegrationPortDescriptor` and
reads Capability Discovery via the public barrel `src/core/platform/index.js` only.
Idempotency keys reuse Platform `createIdempotencyKey`.

## Structural certification invariants

- `hasRealProviders=false`
- `hasLiveCredentialResolver=false`
- `hasProductionWebhooks=false`
- `productionBlocked=true`
- `structuralFoundationComplete=true` only when certification matrix gates PASS

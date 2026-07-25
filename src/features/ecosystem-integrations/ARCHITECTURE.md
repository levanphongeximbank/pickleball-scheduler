# Ecosystem & Integrations — Architecture (ECO-01 + ECO-02 + ECO-02b + ECO-03)

## Phase

**ECO-03 — Provider Adapter Foundation**

Builds on ECO-01 connector/event foundation and ECO-02/ECO-02b secret boundary.
Adds provider-neutral adapter descriptors, invocation contracts, immutable
adapter registry, deterministic selection, readiness projection, no-op/fake
adapters, and domain readiness contracts (payment / messaging / calendar /
identity / data-exchange) — **contract-only, no live providers**.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, adapter descriptors, invocation request/result, capability bindings, immutable registries, selection policy, readiness/observation projections, error/retry/idempotency reuse, no-op/fake adapters, secret boundary + cutover policy |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Payment business state, ledger, notification content/recipients, booking rules, identity rules, competition rules |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue (not ECO adapter runtime) |

## Non-goals (ECO-03)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Live credential resolver / vault
- Network requests / Production webhook ingress
- Mutable global service locator
- Vendor-specific request/response models in canonical contracts
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy

## Public import

```js
import {
  createProviderAdapterDescriptor,
  createProviderAdapterRegistry,
  selectProviderAdapter,
  projectProviderAdapterReadiness,
  createProviderInvocationRequest,
  createProviderInvocationResult,
  createNoOpProviderAdapter,
  createFakeProviderAdapter,
  createPaymentAdapterReadinessContract,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO projects connector metadata onto Platform `IntegrationPortDescriptor` and
reads Capability Discovery via the public barrel `src/core/platform/index.js` only.

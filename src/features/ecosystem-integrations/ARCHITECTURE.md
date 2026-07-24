# Ecosystem & Integrations — Architecture (ECO-01)

## Phase

**ECO-01 — Canonical Connector & Event Foundation**

Structural readiness only. No real providers, no Production webhooks, no credentials, no SQL/Supabase activation.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, immutable registry, inbound/outbound envelopes, webhook verification port, error taxonomy, retry classification, idempotency projection, readiness projection, no-op test provider |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Business validation, ledger, notification decisions, competition behavior, customer identity |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue (unchanged by ECO-01) |

## Non-goals (ECO-01)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Mutable global service locator
- Vendor request/response models in canonical contracts
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy

## Public import

```js
import {
  createConnectorDescriptor,
  createIntegrationRegistry,
  createInboundIntegrationEnvelope,
  createNoOpTestProvider,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO-01 projects connector metadata onto Platform `IntegrationPortDescriptor` and reads Capability Discovery via the public barrel `src/core/platform/index.js` only.

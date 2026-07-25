# Ecosystem & Integrations — Architecture (ECO-01 + ECO-02)

## Phase

**ECO-02 — Integration Secret & Environment Boundary**

Builds on ECO-01 structural readiness. Adds canonical secret references,
environment classification, client-safe public projection, server-only
credential boundary, fail-closed no-op credential resolver, and redacted
diagnostics — without live providers, Production webhooks, or real credentials.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, immutable registry, envelopes, webhook verification port, error taxonomy, idempotency/readiness projections, secret reference + credential requirement descriptors, environment/endpoint classification, client-safe public config projection, server-only credential boundary, no-op test provider + credential resolver |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Business validation, ledger, notification decisions, competition behavior, customer identity |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue + legacy `VITE_*` env readers (classified; cutover deferred / Owner GO) |

## Non-goals (ECO-02)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Real credential material in contracts or tests
- Mutable global service locator / live env readers in canonical namespace
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy
- Immediate cutover of Sprint 10 `integrationFlags.js` (DEFERRED / REQUIRES_OWNER_GO)

## Public import

```js
import {
  createSecretReference,
  createCredentialRequirementDescriptor,
  projectClientSafePublicConfig,
  createServerOnlyCredentialBoundary,
  createNoOpTestCredentialResolver,
  projectSecretBoundaryReadiness,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO projects connector metadata onto Platform `IntegrationPortDescriptor` and
reads Capability Discovery via the public barrel `src/core/platform/index.js` only.

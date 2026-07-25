# Ecosystem & Integrations — Architecture (ECO-01 + ECO-02 + ECO-02b)

## Phase

**ECO-02b — Legacy Vite Secret Cutover**

Builds on ECO-02 secret/environment boundary. Removes browser reads of legacy
`VITE_*` integration secrets, projects client-safe flags/IDs/URLs only, and
fail-closes credential-requiring providers until a server resolver exists.

## Ownership

| Owner | Owns |
|-------|------|
| **Ecosystem & Integrations** (`src/features/ecosystem-integrations/`) | Connector/provider descriptors, immutable registry, envelopes, webhook verification port, error taxonomy, idempotency/readiness projections, secret reference + credential requirement descriptors, environment/endpoint classification, client-safe public config projection, server-only credential boundary, browser secret cutover policy, no-op test provider + credential resolver |
| **Platform Core** | Public Integration Port Descriptor + Capability Discovery (consume only) |
| **Business Modules** | Business validation, ledger, notification decisions, competition behavior, customer identity |
| **Sprint 10 `src/features/integrations/`** | Tenant marketplace settings UI / legacy provider catalogue; env config reader cut over to client-safe projection |

## Non-goals (ECO-02b)

- Real VNPay / MoMo / Stripe / SMS / email / calendar / OAuth clients
- Real credential material in contracts or tests
- Live env readers for secrets in browser bundles
- Mutable global service locator / live credential resolver
- Editing `src/core/platform/**`
- Editing Competition Engine / Finance ledger / Notification worker
- SQL migrations / Supabase writes / Production deploy

## Public import

```js
import {
  createSecretReference,
  createCredentialRequirementDescriptor,
  projectClientSafePublicConfig,
  createServerOnlyCredentialBoundary,
  createNoOpTestCredentialResolver,
  projectSecretBoundaryReadiness,
  isLegacyViteCredentialEnvName,
  isBrowserProviderCredentialResolved,
  createServerCredentialCutoverMarkers,
} from "../features/ecosystem-integrations/index.js";
```

## Relationship to Platform Core

ECO projects connector metadata onto Platform `IntegrationPortDescriptor` and
reads Capability Discovery via the public barrel `src/core/platform/index.js` only.

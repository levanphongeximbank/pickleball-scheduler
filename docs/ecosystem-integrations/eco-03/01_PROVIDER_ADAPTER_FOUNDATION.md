# ECO-03 — Provider Adapter Foundation

## Goal

Establish a provider-neutral adapter invocation foundation for Ecosystem &
Integrations: descriptors, ports, invocation contracts, capability bindings,
immutable registry, deterministic selection, readiness projection, observability
metadata, error/retry/idempotency reuse, and deterministic no-op/fake adapters.

## Architecture decision

**PROVIDER-NEUTRAL ADAPTER INVOCATION FOUNDATION**

1. `createProviderAdapterDescriptor`
2. `createProviderAdapterPort`
3. `createProviderInvocationRequest` / `createProviderInvocationResult`
4. `createConnectorCapabilityBinding`
5. `createProviderAdapterRegistry` (immutable, explicit input)
6. `selectProviderAdapter` (deterministic; enabled ≠ ready)
7. `projectProviderAdapterReadiness`
8. `createProviderAdapterObservation`
9. `mapProviderFailureToIntegrationError` (reuses ECO-01 taxonomy)
10. Deterministic no-op + fake adapters
11. Domain readiness contracts (payment / messaging / calendar / identity /
    data-exchange) — **contract-only**

No live vendor adapters. No network. No credentials. No global service locator.

## Exact file scope

- `src/features/ecosystem-integrations/constants/catalogues.js`
- `src/features/ecosystem-integrations/contracts/providerAdapterDescriptor.js`
- `src/features/ecosystem-integrations/contracts/connectorCapabilityBinding.js`
- `src/features/ecosystem-integrations/contracts/providerInvocationRequest.js`
- `src/features/ecosystem-integrations/contracts/providerInvocationResult.js`
- `src/features/ecosystem-integrations/contracts/providerAdapterReadiness.js`
- `src/features/ecosystem-integrations/contracts/providerAdapterObservation.js`
- `src/features/ecosystem-integrations/contracts/domainAdapterReadinessContracts.js`
- `src/features/ecosystem-integrations/registry/createProviderAdapterRegistry.js`
- `src/features/ecosystem-integrations/selection/selectProviderAdapter.js`
- `src/features/ecosystem-integrations/ports/providerAdapterPort.js`
- `src/features/ecosystem-integrations/errors/mapProviderFailureToIntegrationError.js`
- `src/features/ecosystem-integrations/providers/createNoOpProviderAdapter.js`
- `src/features/ecosystem-integrations/providers/createFakeProviderAdapter.js`
- `src/features/ecosystem-integrations/index.js` / `ARCHITECTURE.md`
- `tests/ecosystem-integrations-eco-03-*.test.js`
- `docs/ecosystem-integrations/**`
- `scripts/ci/unit-test-files.json`

## Explicit non-goals

- No SQL / Supabase / migration / deployment
- No real VNPay / MoMo / Stripe / Zalo / SMS / SMTP / calendar / OAuth calls
- No live credential resolver / vault
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes
- No production webhook ingress (ECO-04)

## Follow-ups

- ECO-04: webhook ingress (staging only, Owner GO)
- Live vendor adapter implementors behind ECO registry (Owner GO)
- Server-side credential injection / resolver wiring (Owner GO)
- Gradual migration of Sprint 10 payments / notifications behind ECO adapters

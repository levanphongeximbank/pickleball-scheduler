# ECO-05 — Integration Observability & Structural Final Certification

## Goal

Close the Ecosystem & Integrations structural foundation with provider-neutral
observability, aggregate readiness/health, audit-safe evidence projection, an
ECO-01→04 certification matrix, and a final structural readiness projection.

Production / staging live activation remains **out of scope**.

## Architecture decision

**STRUCTURAL OBSERVABILITY + FINAL CERTIFICATION**

1. `createIntegrationObservation` — canonical observation contract
2. `projectCanonicalFromProviderAdapterObservation` /
   `projectCanonicalFromWebhookIngressObservation`
3. `aggregateIntegrationObservations` — connector/adapter/webhook aggregation
4. `projectAggregateIntegrationHealth` — readiness/health aggregate
5. `projectAuditSafeEvidence` / `projectAuditSafeEvidenceFromObservation`
6. `projectCertificationMatrix` — ECO-01→04 + invariant gates
7. `projectStructuralFoundationReadiness` — `structuralFoundationComplete`
   only when every required gate PASSes
8. Architecture / security / regression certification tests
9. Closure evidence docs

Invariants enforced:

- `hasRealProviders=false`
- `hasLiveCredentialResolver=false`
- `hasProductionWebhooks=false`
- `productionBlocked=true`
- diagnostics redacted
- no env / network / vendor SDK / live resolver

## Exact file scope

- `src/features/ecosystem-integrations/constants/catalogues.js`
- `src/features/ecosystem-integrations/contracts/integrationObservation.js`
- `src/features/ecosystem-integrations/contracts/observationAggregation.js`
- `src/features/ecosystem-integrations/contracts/aggregateHealthReadiness.js`
- `src/features/ecosystem-integrations/contracts/auditSafeEvidenceProjection.js`
- `src/features/ecosystem-integrations/contracts/certificationMatrix.js`
- `src/features/ecosystem-integrations/index.js` / `ARCHITECTURE.md`
- `tests/ecosystem-integrations-eco-05-*.test.js`
- `docs/ecosystem-integrations/**`
- `scripts/ci/unit-test-files.json`

## Explicit non-goals

- No SQL / Supabase / migration / deployment
- No real VNPay / MoMo / Stripe / Zalo / SMS / SMTP / calendar / OAuth calls
- No live credential resolver / vault
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes
- No public Production webhook routes
- No mutable global service locator
- No Staging/Production activation

## Certification matrix (structural)

| Gate | Expected |
|------|----------|
| ECO-01→04 present on main | PASS |
| Connector / secret / adapter / webhook compatible | PASS |
| Observability provider-neutral | PASS |
| Diagnostics redacted | PASS |
| No env / network / vendor SDK / live resolver | PASS |
| `hasRealProviders=false` | PASS |
| `hasLiveCredentialResolver=false` | PASS |
| `hasProductionWebhooks=false` | PASS |
| `productionBlocked=true` | PASS |
| `structuralFoundationComplete` | PASS only if all above PASS |

## Follow-ups (Owner GO)

- Staging-only webhook HTTP binding
- Live vendor signature verifiers behind ECO ports
- Durable idempotency store ownership
- Live provider activation behind domain readiness contracts

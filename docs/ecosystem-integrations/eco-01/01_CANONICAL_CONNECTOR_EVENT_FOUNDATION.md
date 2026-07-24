# ECO-01 — Canonical Connector & Event Foundation

## Goal

Establish provider-neutral connector/event contracts so Business Modules and future provider adapters share one immutable foundation — without live network, credentials, or Production webhooks.

## Architecture decision (priority order)

1. Connector descriptor
2. Provider capability descriptor
3. Immutable integration registry
4. Provider-neutral inbound envelope
5. Provider-neutral outbound envelope
6. Webhook verification port (fail-closed)
7. Integration error taxonomy
8. Retry classification (deterministic; no worker)
9. Idempotency projection (no persistence ownership)
10. Health/readiness projection
11. No-op / deterministic test provider
12. Architecture + security tests

## Exact file scope

- `src/features/ecosystem-integrations/**` (new namespace — does not extend Sprint 10 `integrations/`)
- `docs/ecosystem-integrations/**`
- `tests/ecosystem-integrations-eco-01-*.test.js`
- `scripts/ci/unit-test-files.json` (manifest registration only)

## Explicit non-goals

- No SQL / Supabase / migration
- No real provider / credential / Production webhook
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes

## Security assertions

- Contracts reject credential-like payload keys
- Error context sanitizes secret-like fields
- Webhook verifier never retains raw signature/secret
- No `process.env` access in ECO-01 module
- No network clients

## Follow-ups

- ECO-02: secret boundary (move secrets off `VITE_*` client surface) — Owner GO
- ECO-03: adapter ports for payment/notification behind ECO registry
- ECO-04: webhook ingress worker (staging only, Owner GO)

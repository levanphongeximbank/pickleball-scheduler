# ECO-02b — Legacy Vite Secret Cutover

## Goal

Eliminate browser-side reads of legacy integration secrets (`VITE_*` secret /
token / password / signing material) and fail closed until a server credential
resolver exists.

## Architecture decision

**LEGACY SECRET READ ELIMINATION + FAIL-CLOSED CUTOVER**

1. Remove secret-valued fields from `getIntegrationEnvConfig()`.
2. Stop reading legacy credential-shaped `VITE_*` variables in browser code.
3. Retain audited client-safe flags / public IDs / URLs.
4. Attach canonical credential requirement metadata (names/paths only).
5. Providers requiring credentials stay unavailable without a server resolver.
6. No live resolver, no real providers, no network, no secret values in repo.

## Exact file scope

- `src/features/ecosystem-integrations/cutover/browserSecretCutoverPolicy.js`
- `src/features/ecosystem-integrations/index.js` / catalogues / secretBoundaryShared
- `src/features/integrations/config/integrationFlags.js`
- `src/features/integrations/config/legacyViteSecretCutover.js`
- Payment/notification provider `isConfigured` wiring (minimal)
- `tests/ecosystem-integrations-eco-02b-*.test.js`
- `docs/ecosystem-integrations/**`
- `scripts/ci/unit-test-files.json`

## Explicit non-goals

- No SQL / Supabase / migration / deployment
- No real VNPay / MoMo / Stripe / Zalo / SMS / SMTP calls
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes
- No live server credential resolver

## Follow-ups

- ECO-03: provider adapters behind ECO registry
- ECO-04: webhook ingress (staging only, Owner GO)
- Server-side credential injection / resolver wiring (Owner GO)

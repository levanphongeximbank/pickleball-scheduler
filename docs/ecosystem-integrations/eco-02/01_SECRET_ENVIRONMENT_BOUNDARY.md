# ECO-02 — Integration Secret & Environment Boundary

## Goal

Establish a canonical secret/environment boundary so integration credentials are
classified, referenced without values, projected safely to the browser, and
resolved fail-closed in tests — without live providers or real secrets.

## Architecture decision (priority order)

1. Credential requirement descriptor (no values)
2. Secret reference contract (names/paths only)
3. Environment classification + eligibility
4. Provider endpoint classification
5. Client-safe public configuration projection
6. Server-only credential boundary
7. Deterministic secret-boundary readiness projection
8. Fail-closed validation
9. Redacted diagnostics
10. No-op / test credential resolver (injected presence only)
11. Architecture + security tests

## Exact file scope

- `src/features/ecosystem-integrations/**` (extend ECO-01 namespace)
- `docs/ecosystem-integrations/**`
- `tests/ecosystem-integrations-eco-02-*.test.js`
- `scripts/ci/unit-test-files.json` (manifest registration only)
- ECO-01 phase-metadata assertion update in `tests/ecosystem-integrations-eco-01-foundation.test.js`

## Explicit non-goals

- No SQL / Supabase / migration
- No real provider / credential / Production webhook
- No edits to `src/core/platform/**`
- No Competition Engine / Finance ledger / Notification worker changes
- No immediate rewrite of Sprint 10 `src/features/integrations/config/integrationFlags.js` (legacy `VITE_*` secret readers remain classified as `BROWSER_EXPOSED_SECRET_RISK` + `LEGACY` + `REQUIRES_OWNER_GO`)

## Security assertions

- Descriptors reject secret value fields
- Client-safe projection rejects secret-shaped keys
- Resolver fail-closed; never reads `process.env` / `import.meta.env`
- Production credentials ineligible in Sandbox and vice versa
- Diagnostics redact secret-shaped keys
- No network clients / vendor models / Business Module imports in canonical namespace

## Follow-ups

- ECO-02b (Owner GO): cutover Sprint 10 payment/notification providers off `VITE_*` secret readers onto server-only references
- ECO-03: adapter ports for payment/notification behind ECO registry
- ECO-04: webhook ingress worker (staging only, Owner GO)

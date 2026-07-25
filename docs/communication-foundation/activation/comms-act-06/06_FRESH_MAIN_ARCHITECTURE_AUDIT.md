# COMMS-ACT-06 — Fresh-main Architecture Audit

**Audit date:** 2026-07-25  
**Baseline:** `origin/main` @ `073ced2f6977d894ef3130588f85be6fd823f175`  
**Method:** fresh tree inspection — not copy-paste of ACT-05 report.

## Runtime host (canonical)

| Candidate | Decision |
|-----------|----------|
| Vercel serverless `api/` | **Selected** — `api/communication/command.js`, `system-produce.js` |
| Netlify Functions | Rejected — `netlify.toml` has SPA redirect only, no Communication functions |
| Supabase Edge | Rejected — domain-locked elsewhere |
| Browser + service-role | Rejected — absolute violation |

Evidence: `vercel.json` SPA rewrites exclude `api/`; package scripts use `npx vercel deploy`; ACT-05 host decision file still accurate on fresh main.

## Gateway / provider

| Layer | Path | Finding |
|-------|------|---------|
| HTTP command host | `api/communication/command.js` | JWT actor + service-role backend; spoof fields stripped |
| System producer host | `api/communication/system-produce.js` | Producer key required; browser JWT alone denied |
| Browser gateway | `createTrustedBackendHttpMessagingGateway.js` | POST command; Community fail-closed; realtime = manual refresh |
| Runtime provider | `CommunicationRuntimeProvider.jsx` | Opt-in only via `VITE_COMMUNICATION_TRUSTED_BACKEND=true` |
| Mode resolver | `resolveCommunicationRuntimeMode.js` | Prod build never DEMO; missing gates → UNAVAILABLE |

## Server boundary

- `serverOnlyBoundary.js` + hosts under `api/communication/`
- No `VITE_*SERVICE_ROLE` in experience/runtime
- Composition root constructs service client only on server

## Capability state (code)

- ACT-05 capability constants remain; Production still `PRODUCTION_UNTOUCHED` until ACT-07
- `activationGates.PRODUCTION_READY = false`, `STAGING_MIGRATION_READY = false`
- ACT-06 adds Owner-GO Production ref gate (`COMMS_PRODUCTION_RUNTIME_ENABLE`) — fail-closed by default

## pairKey / idempotency / typed errors

- Domain pairKey vs DB encode/decode (U+001F) unchanged
- Idempotency ledger on `communication_idempotency`
- `CommunicationFoundationError` + `mapCommunicationHttpError`

## No silent demo fallback

Trusted hosts have no DEMO imports. Network failure → UNAVAILABLE / typed error — never local success write.

## Test / registry coverage

Communication unit tests registered through ACT-05; ACT-06 adds `tests/communication-comms-act-06-production-readiness.test.js`.

# COMMS-ACT-06 — Security & Abuse Readiness

## Controls present (fresh main + ACT-06)

| Control | Status | Class |
|---------|--------|-------|
| Authentication required (Bearer JWT) | Present | — |
| JWT verification (`auth.getUser`) | Present | — |
| Tenant/Club from profile SoT | Present | — |
| Sender spoof prevention | Present (strip + server actor) | — |
| Cross-tenant denial | Present (application policies) | — |
| System producer authentication | Present (`COMMS_SYSTEM_PRODUCER_KEY`) | — |
| Browser System deny | Present | — |
| Idempotency | Present | — |
| Request size limit | **Added ACT-06** (32 KiB) | REQUIRED_BEFORE_SCALE for distributed |
| Rate limiting | **Added ACT-06** (in-memory isolate) | REQUIRED_BEFORE_SCALE for edge/WAF |
| Replay resistance | Partial (idempotency keys) | REQUIRED_BEFORE_SCALE |
| Audit-safe logging | Present (safe diagnostics) | — |
| Error redaction | Present (typed codes) | — |
| Secret boundary | Present (server-only) | — |
| Production ref fail-closed | Present (Owner-GO enable) | RELEASE_BLOCKER until ACT-07 GO |
| CORS | Same-origin Vercel SPA assumed | DEFERRED_NON_BLOCKING |
| Timeout/retry | Client fail → UNAVAILABLE | REQUIRED_BEFORE_SCALE |
| Privileged response leakage | Denied by design | — |

## Release blockers (security path)

1. Production enable token must stay unset until ACT-07.
2. `PRODUCTION_READY` gate must stay `false` until ACT-07 Owner flip.
3. Service-role must never enter browser/`VITE_*`.

## Not lowered for READY

Community + Realtime remain fail-closed. No “temporary open” for Production smoke convenience.

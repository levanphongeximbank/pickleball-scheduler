# Persistence authority

## Authorities

| Value | Meaning |
|-------|---------|
| `durable` | Supabase `court_engine_stores` + `court_engine_active_sessions` |
| `development_local` | Explicit localStorage adapter |
| `offline_local` | Explicit offline localStorage adapter |
| `test_memory` | Explicit in-memory adapter (tests) |

## Resolution (once)

Implemented in `resolveCourtRuntimeAuthority` + `getCourtRuntimeWriter` composition root.

Rules:

- Production / Staging / Preview → `durable`
- Development default → `durable` (fail-closed without store)
- Local requires explicit `VITE_COURT_RUNTIME_AUTHORITY` or legacy `VITE_COURT_ENGINE_STORE=local` **only outside secure deploy**
- Cloud failure / `RPC_NOT_DEPLOYED` never changes authority

## Typed errors

- `COURT_RUNTIME_AUTHORITY_UNRESOLVED`
- `COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE`
- `COURT_RUNTIME_WRITE_FAILED`
- `COURT_RUNTIME_SCOPE_REQUIRED`
- `COURT_RUNTIME_SCOPE_MISMATCH`
- `COURT_RUNTIME_UNAUTHORIZED`
- `COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT`
- `COURT_RUNTIME_DUAL_WRITE_FORBIDDEN`
- `COURT_RUNTIME_UNSUPPORTED_DURABLE_COMMAND`

## Facade

`src/features/court-engine/runtime/facade.js` — create/load/persist/hydrate/active session + authority inspection.

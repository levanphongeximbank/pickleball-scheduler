# COMMS-ACT-05 — Server-only Secret Boundary

## Where secrets live

| Location | Allowed |
|----------|---------|
| Vercel env `SUPABASE_SERVICE_ROLE_KEY` | Yes (serverless `api/**`) |
| Vercel env `COMMS_SYSTEM_PRODUCER_KEY` | Yes (System producer) |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` (Owner ops scripts outside repo secrets) | Ops only |
| `VITE_*SERVICE_ROLE*` / browser bundle | **Never** |

## Construction rule

1. `api/communication/*` reads service-role via `getSupabaseServiceRoleKey()`.
2. Creates service client locally.
3. Injects client into `createTrustedCommunicationBackend` / `createSystemMessageProducer`.
4. Those factories **do not** read service-role env themselves.
5. HTTP gateway in browser only sends user JWT.

## Proofs

- `assertNoServiceRoleInCommunicationBrowserSurface()`
- Ownership lock continues to forbid client-boundary service-role reads under `src/`
- ACT-05 host files live under `api/` (same pattern as identity)

## Leakage forbid list

- No privileged client in JSON responses
- No token echo
- Error mapper strips secret-like detail keys

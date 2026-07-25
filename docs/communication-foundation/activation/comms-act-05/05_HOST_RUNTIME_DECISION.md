# COMMS-ACT-05 — Host / Runtime Decision

## Fresh-main audit verdict

Canonical **host family** already in repository: **Vercel serverless `api/`** with JWT + server-only service-role (proven by `api/identity/*`).

| Candidate | Decision |
|-----------|----------|
| `api/identity/*` | Pattern source — not Communication write host |
| `api/v1/*` (API key Edge) | **Rejected** — wrong caller model for end-user messaging |
| Supabase Edge (Rating/Referee) | **Rejected** — domain-locked product hosts |
| Browser + service-role | **Rejected** — absolute security violation |
| **`api/communication/*`** | **Selected** — extends existing `api/` family |

## Chosen host

- Family: `vercel_serverless_api`
- Paths: `/api/communication/command`, `/api/communication/system-produce`
- Auth mirror: `authorizeUserManage` → `authorizeCommunicationActor`

## Runtime honesty

| Mode | When |
|------|------|
| DEMO | Dev/preview/test default only |
| PRODUCTION | Explicit certified deps + activation remote-ready **or** test force |
| UNAVAILABLE | Production build missing deps/gates; network failure never becomes local success |

`VITE_COMMUNICATION_TRUSTED_BACKEND=true` opts into HTTP gateway wiring. It does **not** flip `STAGING_MIGRATION_READY` / `PRODUCTION_READY` and does **not** enable DEMO.

## Not selected

- New Express/Fastify platform
- New Supabase Edge Function product for Communication
- Putting `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*`

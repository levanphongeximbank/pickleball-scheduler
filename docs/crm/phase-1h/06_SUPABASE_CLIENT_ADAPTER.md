# 06 — Supabase Client Adapter (Phase 1H-A)

**Status:** Implemented (injectable). No live Supabase connection. Not wired as runtime default.

## Factory

`createSupabaseCrmDatabaseClient({ client })`
Path: `src/features/crm/persistence/supabase/supabaseCrmDatabaseClient.js`
Implements `CrmDatabaseClientPort` via `requireCrmDatabaseClientPort`.

## Guarantees

- Accepts injected Supabase-like client only
- Does not construct a global client
- Does not read credentials at module import
- Does not import Production configuration
- Operations: `select`, `insert`, `update`, `delete`, `rpc`
- Validates `TenantVenueScope` before scoped table ops and RPC args
- Returns normalized arrays / counts
- Preserves `{ code, message, details }` errors for `translatePersistenceError`
- Does not expose client internals on the returned port

## Table allowlist

| Table | Allowed ops |
|-------|-------------|
| `crm_tags` | select, insert, update |
| `crm_tag_assignments` | select, insert, delete |
| `crm_consent_records` | select, insert |
| `crm_pending_events` | select, insert, update |

## RPC allowlist

- `crm_claim_pending_events`
- `crm_release_expired_pending_event_claims`

## Query semantics

- No arbitrary raw SQL
- Every table op requires `tenant_id` + `venue_id` filters (or row columns on insert)
- Delete only for `crm_tag_assignments`
- Consent update/delete rejected by operation allowlist
- Pending-event guarded status filters supported by callers (durable repo)
- Unknown tables/operations rejected
- Wildcard `*` select allowed only after allowlist + scope; prefer explicit columns at call sites
- Deterministic `order` arrays forwarded to client

## Runtime composition

Default remains memory. Durable activation gated by
`assertCrmRuntimeCompositionGuard` (`persistence/runtimeCompositionGuard.js`).
Production blocked. Staging requires explicit approval + injected client.

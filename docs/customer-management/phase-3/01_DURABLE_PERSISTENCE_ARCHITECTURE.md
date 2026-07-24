# 01 — Durable Persistence Architecture (CUSTOMER-03)

## Boundary

```
Application service
  -> CustomerRepository port (CUSTOMER-01)
  -> durable adapter (CUSTOMER-03)  OR  in-memory (tests only)
  -> CustomerDatabaseClientPort
  -> (future) concrete Supabase / service-role driver
```

Domain models and application services **must not** import a concrete Supabase client.

## Aggregate ownership

| Concern | Owner table / storage |
|---------|------------------------|
| Aggregate root (ids, names, type, status, version, linkages, overlays) | `public.customers` |
| Contact points | `public.customer_contact_points` |
| Addresses | `public.customer_addresses` |
| Classification / tags / segment refs / prefs / consent refs | jsonb on `customers` (CUSTOMER-01 public overlays) |

No separate `customer_linkages` table — opaque linkage ids are columns on the root (`account_user_id`, `player_id`, `organization_id`).

## Scope key

Canonical scope remains `{ tenantId, venueId }` (matches CRM directory).

SQL columns: `tenant_id` + `venue_id` on every Customer table.

## Transaction boundary

Logical aggregate writes (create/update including contacts + addresses) go through **`customer_save_aggregate`** RPC:

1. Lock root row (`FOR UPDATE`) when present.
2. Enforce optimistic concurrency (`version` must be `existing + 1`; create requires `version = 1`).
3. Upsert root; replace children atomically in the same function transaction.
4. Reject partial child writes — failure rolls back the whole call.

## Optimistic concurrency

- Column: `customers.version` (`integer >= 1`, starts at 1).
- Application domain mutations bump version before `save`.
- RPC checks payload version against stored version; mismatch → `CUSTOMER_VERSION_CONFLICT`.
- Child `version` columns are stored for audit/domain fidelity; concurrency is **aggregate-level**.

## Runtime composition

| Mode | Use |
|------|-----|
| `disabled` | Default — fail-closed |
| `memory` | Tests / explicit non-Production harness only |
| `durable` | Requires injectable `db` or `repository` |

Production memory mode is rejected at config validation.

## Failure behavior

| Condition | Behavior |
|-----------|----------|
| No repository / disabled runtime | `CUSTOMER_RUNTIME_NOT_CONFIGURED` |
| Missing durable `db` | `CUSTOMER_RUNTIME_NOT_CONFIGURED` |
| Stale version | `CUSTOMER_VERSION_CONFLICT` |
| Unique constraint | `CUSTOMER_DUPLICATE` |
| Scope mismatch | `CUSTOMER_TENANT_SCOPE_MISMATCH` |
| Production + memory | Rejected |

## Service-role note

Authenticated JWT clients have **SELECT** only (when permission/super_admin allows).  
Aggregate writes are trusted **service_role** / server-path only in CUSTOMER-03.

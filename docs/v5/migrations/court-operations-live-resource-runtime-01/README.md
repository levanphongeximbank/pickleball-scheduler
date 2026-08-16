# Court Operations — Live Resource Runtime 01 (Batch 7)

**LOCAL AUTHORING ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

## Migration identity

```
LIVE_RESOURCE_RUNTIME_MIGRATION_VERSION=20260816200000
LIVE_RESOURCE_RUNTIME_MIGRATION_NAME=court_operations_live_resource_runtime_01
```

Machine-readable copy: `MIGRATION_IDENTITY.txt`.

This package is **additive**. It does not create, alter or drop any Phase 3A,
Phase 3B, D4, or Batch 1–6 certified object, and it does not edit any certified
SQL in those packages.

## Three-authority separation — the central rule

Live runtime answers only: **what is physically happening on the court NOW?**

| Authority | Owner store | Who writes it |
|---|---|---|
| **Capacity** (who holds a court in a time window) | `public.court_resource_reservations` | Phase 3B / capacity RPCs only |
| **Durable ops blocks** (maintenance / operational windows) | `public.court_operations_resource_blocks` | Batch 4 resource-block RPCs |
| **Live NOW** (occupancy + operational NOW + resource sessions) | this package's tables | this package's RPCs only |

Consequences that are enforced, not just documented:

- Live RPCs **never** `INSERT` / `UPDATE` / `DELETE` `court_resource_reservations`.
- Ending a live session **does not** release capacity.
- Setting operational state is **NOW only** — it does **not** create resource
  blocks or reservations.
- No score / match lifecycle / winner columns are authority here.
- Every success payload includes `reservationWriteCount: 0`.

## Identity authority

`physicalCourtId` (uuid) is the only court identity. Serialized live state and
resource session objects carry `identityAuthority: 'physicalCourtId'`.

- RPC court parameters are typed `uuid`.
- `tenant_id text NOT NULL` references `public.venues(id)` like other packages.

## Tables

### `public.court_operations_court_live_states`

Primary key `(tenant_id, physical_court_id)`. Holds occupancy (`free` /
`occupied`), operational NOW state (`AVAILABLE` / `UNAVAILABLE_NOW` /
`OUT_OF_SERVICE_NOW`), optional `active_resource_session_id`, optimistic
`version`, and audit fields.

### `public.court_operations_resource_sessions`

Physical-use session rows. Source vocabulary is opaque:
`booking` | `daily_play` | `competition` | `operations`.
`reservation_ref` is an opaque text reference only (no required FK to
reservations — avoids capacity coupling).

Partial unique index: one **active** session per `(tenant_id, physical_court_id)`.

### `public.court_operations_live_runtime_commands`

Idempotency ledger (Batch 4 style): unique `(tenant_id, request_id)`,
operation, fingerprint, status, `result jsonb`.

## RPCs

All return `jsonb`. All are `SECURITY DEFINER` with
`search_path = pg_catalog, public`, revoked from `PUBLIC` / `anon`, and
granted `EXECUTE` to `authenticated` only. Table access is RLS FORCE +
select-only policies; clients have **no** direct table grants.

| RPC | Capacity / block effect |
|---|---|
| `court_operations_live_begin_resource_session` | none (never writes reservations) |
| `court_operations_live_end_resource_session` | none (never releases reservations) |
| `court_operations_live_set_operational_state` | none (no blocks / reservations) |
| `court_operations_live_get_court_state` | none (read) |
| `court_operations_live_list_resource_sessions` | none (read) |

Auth is fail-closed via `is_super_admin()` / `user_venue_id()` (same pattern as
Batch 4).

## Cutover

This package does **not** enable any cutover.
`CANONICAL_COURT_LIVE_RUNTIME_DEFAULT=false`. Cutover is **OFF**.

## Package files

Run order, only after an explicit Owner GO (not this batch):
`01_PRECHECK.sql`, `02_APPLY.sql`, `03_VERIFY.sql`.
`04_ROLLBACK.sql` drops only this package's functions and tables (no CASCADE
that can delete capacity).

# Court Operations — Canonical resource blocks 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

## Migration identity

```
RESOURCE_BLOCKS_MIGRATION_VERSION=20260816180000
RESOURCE_BLOCKS_MIGRATION_NAME=court_resource_canonical_resource_blocks_01
```

Machine-readable copy: `MIGRATION_IDENTITY.txt`.

This package is **additive**. It does not create, alter or drop any Phase 3A,
Phase 3B, D4, Batch 1, Batch 2 or Batch 3 object, and it does not edit any
certified SQL in those packages.

## Ownership separation — the central rule

There are two distinct stores and they must never be confused.

| Concern | Owner table | Who writes it |
|---|---|---|
| **Capacity** (who holds a court in a time window) | `public.court_resource_reservations` | Phase 3B `court_resource_reserve_core` only |
| **Resource block business state** (type, reason, notes, lifecycle) | `public.court_operations_resource_blocks` | this package's RPCs |

Consequences that are enforced, not just documented:

- The resource block table has **no** exclusion constraint. `03_VERIFY.sql`
  fails if one is ever added.
- Every capacity acquisition goes through `public.court_resource_reserve_core`.
  There is no direct `INSERT` into `public.court_resource_reservations`.
- Capacity release is owner-safe: only reservations where
  `owner_type IN ('maintenance','operations')` (derived from `block_type`)
  **and** `owner_id = resource_block_id` are released.
- Owner mapping reuses Phase 3B vocabulary — **never** invent
  `court_resource_block`:
  - `MAINTENANCE` → `maintenance` + `owner_sub_type=resource_block`
  - `OPERATIONAL_BLOCK` → `operations` + `owner_sub_type=resource_block`
- Resource blocks must **not** create `bookingType=maintenance` bookings and
  must **not** use `court.status` as capacity.
- Rollback does **not** delete reservations (outbound RESTRICT FK, no CASCADE).

## Identity authority

`physicalCourtId` (uuid) is the only court identity. Every serialized block
carries `identityAuthority: 'physicalCourtId'`.

- RPC parameters are typed `uuid`, so a label / legacy court id fails at cast.
- `court_display_name` is a **projection snapshot only**.

## Lifecycle

Canonical values: `active`, `cancelled`.
(`released` as a synonym maps to `cancelled` — cancelled is the retained
history status after capacity release.)

## Tables

### `public.court_operations_resource_blocks`

Business aggregate. Optimistic concurrency via `version`. Idempotency anchor
via `UNIQUE (tenant_id, request_id)`.

### `public.court_operations_resource_block_commands`

Idempotency ledger, operations `create`, `reschedule`, `transfer`, `cancel`.
Separate from the Phase 3B reservation command ledger.

## RPCs

All return `jsonb` with `ok` and `code`. All are `SECURITY DEFINER` with
`search_path = pg_catalog, public`, revoked from `PUBLIC` and `anon`, and
granted `EXECUTE` to `authenticated` only.

| RPC | Capacity effect |
|---|---|
| `court_operations_resource_block_create` | reserves via `reserve_core` |
| `court_operations_resource_block_reschedule` | release own, then reserve; rolls back on failure |
| `court_operations_resource_block_transfer_court` | reserve target first, then release source |
| `court_operations_resource_block_cancel` | releases own reservations only |
| `court_operations_resource_block_get` | none (read) |
| `court_operations_resource_block_list` | none (read) |

### Reschedule atomicity

Same as Batch 3 booking: release first, then reserve; on failure the sub-block
raises so the release rolls back and `capacityPreserved: true` is returned.

### Transfer ordering

Acquire target **before** releasing source. Failed transfer leaves source held.

## Cutover

This package does **not** enable any cutover.
`CANONICAL_RESOURCE_BLOCKS_DEFAULT=false`. Cutover is **OFF**.

## Package files

Run order, only after an explicit Owner GO (not this batch):
`01_PRECHECK.sql`, `02_APPLY.sql`, `03_VERIFY.sql`.
`04_ROLLBACK.sql` drops only this package's functions and tables.

`migration-tooling/LEGACY_RESOURCE_BLOCK_MIGRATION.md` is **strategy only**.

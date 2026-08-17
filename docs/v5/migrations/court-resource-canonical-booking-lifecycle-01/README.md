# Court Operations — Canonical booking lifecycle 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

```
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

## Migration identity

```
BOOKING_LIFECYCLE_MIGRATION_VERSION=20260816160000
BOOKING_LIFECYCLE_MIGRATION_NAME=court_resource_canonical_booking_lifecycle_01
```

Machine-readable copy: `MIGRATION_IDENTITY.txt`.

This package is **additive**. It does not create, alter or drop any Phase 3A,
Phase 3B, D4, Batch 1 or Batch 2 object, and it does not edit any certified SQL
in those packages.

## Ownership separation — the central rule

There are two distinct stores and they must never be confused.

| Concern | Owner table | Who writes it |
|---|---|---|
| **Capacity** (who holds a court in a time window) | `public.court_resource_reservations` | Phase 3B `court_resource_reserve_core` only |
| **Booking business state** (customer, money, lifecycle, code, notes) | `public.court_operations_bookings` | this package's RPCs |

Consequences that are enforced, not just documented:

- The booking table has **no** exclusion constraint. `03_VERIFY.sql` fails if one
  is ever added. A booking row can never become an alternate capacity source.
- Every capacity acquisition in this package goes through
  `public.court_resource_reserve_core`. There is no direct `INSERT` into
  `public.court_resource_reservations` anywhere in `02_APPLY.sql`.
- Capacity release is owner-safe: the internal
  `court_operations_booking_release_own_capacity` helper only touches rows where
  `owner_type = 'booking'` **and** `owner_id = booking_id`. A booking can never
  release a competition, daily-play, maintenance or operations reservation.
- `court_operations_booking_update_lifecycle` does not touch capacity at all and
  returns `capacityMutated: false`. It cannot be used to bypass reservation
  history.
- Deleting the booking table in rollback does **not** delete reservations. The
  FK is outbound and `RESTRICT`, and no `CASCADE` appears in `04_ROLLBACK.sql`.

## Identity authority

`physicalCourtId` (uuid) is the only court identity. Every serialized booking
carries `identityAuthority: 'physicalCourtId'`.

- RPC parameters are typed `uuid`, so a label, court number or legacy court id
  fails at the parameter cast and can never reach the booking store.
- `court_display_name` is a **projection snapshot only**. It is written from the
  caller payload for display convenience and is never read for court resolution,
  matching or merging.
- `customer_ref` is a deferred-boundary reference string. It is not a foreign
  key and must not be treated as a canonical customer identity until the
  customer boundary lands.

## Reused Phase 3B helpers

This package calls, and does not redefine:

- `public.court_resource_reserve_core(...)`
- `public.court_resource_reservation_assert_access(text, text, uuid[])`
- `public.court_resource_reservation_normalize_court_ids(uuid[])` (via reserve core)
- `public.court_resource_digest_sha256(bytea)`
- `public.court_resource_map_gateway_owner_type(text)` (precheck vocabulary assertion)

`01_PRECHECK.sql` refuses to run if any of them is absent, and
`03_VERIFY.sql` re-asserts they are still present after apply.

## Tables

### `public.court_operations_bookings`

Booking business aggregate. Optimistic concurrency via `version`. Idempotency
anchor via `UNIQUE (tenant_id, request_id)` as a second guard behind the command
ledger. Indexes on `(tenant_id, club_id, starts_at)`,
`(tenant_id, physical_court_id, starts_at)` and `(tenant_id, lifecycle_status)`.

Lifecycle values: `pending`, `confirmed`, `checked_in`, `playing`, `completed`,
`cancelled`, `no_show`.

### `public.court_operations_booking_commands`

Idempotency ledger, `UNIQUE (tenant_id, request_id)`, operations `create`,
`reschedule`, `transfer`, `cancel`, `lifecycle`. Separate from the Phase 3B
reservation command ledger — this package never writes to that table.

## RPCs

All return `jsonb` with `ok` and `code`. All are `SECURITY DEFINER` with
`search_path = pg_catalog, public`, revoked from `PUBLIC` and `anon`, and
granted `EXECUTE` to `authenticated` only.

| RPC | Capacity effect |
|---|---|
| `court_operations_booking_create` | reserves via `reserve_core` |
| `court_operations_booking_reschedule` | release own, then reserve; rolls back on failure |
| `court_operations_booking_transfer_court` | reserve target first, then release source |
| `court_operations_booking_cancel` | releases own reservations only |
| `court_operations_booking_update_lifecycle` | **none** |
| `court_operations_booking_get` | none (read) |
| `court_operations_booking_list` | none (read) |

### Reschedule atomicity

Reschedule may be time-only (same court) or combined (time + court). Because a
time-only move on the same court would self-conflict against the Phase 3B
exclusion constraint, the current reservation is released **first**, then the
new window is reserved. If the reserve fails, the function raises inside a
sub-block so the release is rolled back and the original window is still held.
The failure result carries `capacityPreserved: true`.

### Transfer ordering

Distinct courts are non-overlapping resources, so transfer acquires the target
**before** releasing the source. If the target is unavailable
(`FOREIGN_RESERVATION_CONFLICT`) or out of scope (`OUT_OF_SCOPE`), the source
reservation is untouched and the booking is unchanged. Transferring to the court
already held is an idempotent no-op success. `booking_id` is always preserved.

### Idempotency and version ordering

Replay is resolved from the command ledger **before** the version check, so a
retried success returns the original result instead of a spurious
`VERSION_CONFLICT`. A reused `request_id` with a different payload fingerprint
returns `IDEMPOTENCY_CONFLICT`.

### Scope guard

`court_operations_booking_assert_scope(p_tenant_id, p_club_id)` requires
`auth.uid()`, a non-blank explicit `tenant_id`, `is_super_admin()` or
`tenant_id = user_venue_id()`, and a club that exists and belongs to that
tenant. **There is no venueId fallback and no default club.**

## Serialization contract

Bookings serialize as camelCase JSON for the JS layer:

`bookingId`, `tenantId`, `clubId`, `physicalCourtId`, `reservationId`,
`startsAt`, `endsAt`, `lifecycleStatus`, `bookingCode`, `bookingType`,
`customerName`, `customerPhone`, `customerType`, `customerRef`, `totalAmount`,
`depositAmount`, `paidAmount`, `paymentStatus`, `note`, `courtDisplayName`,
`version`, `createdAt`, `updatedAt`, `cancelledAt`,
`identityAuthority: 'physicalCourtId'`.

Timestamps are emitted as UTC ISO-8601 with a `Z` suffix.

## Security posture

- RLS `ENABLE` + `FORCE` on both tables.
- SELECT-only policy: `is_super_admin() OR tenant_id = user_venue_id()`.
  `03_VERIFY.sql` fails if any non-SELECT policy appears.
- `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated` on both tables. There are
  no client table grants of any kind; all access is via RPC.
- Internal helpers are owner-only — not executable by `anon` or `authenticated`.
- As with Phase 3B, the `SECURITY DEFINER` functions write through forced RLS by
  running as the migration/table owner. Apply this package with the same role
  used for Phase 3B so the ownership and bypass posture stays identical.

## Cutover

This package does **not** enable any cutover. It adds no flag and reads none.
The Phase 3B reservation cutover flag stays `false`, and no JS runtime is
switched onto these RPCs by applying this SQL. Cutover is **OFF**.

## Package files

Run order, only after an explicit Owner GO (not this batch):
`01_PRECHECK.sql`, `02_APPLY.sql`, `03_VERIFY.sql`.
`04_ROLLBACK.sql` drops only this package's functions and tables, in the order
functions → commands table → bookings table.

`migration-tooling/LEGACY_BOOKING_MIGRATION.md` is **strategy only**. It
contains no executable migration and must not be run.

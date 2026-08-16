# Legacy booking migration — STRATEGY ONLY

**DO NOT EXECUTE. THIS DOCUMENT CONTAINS NO RUNNABLE MIGRATION.**

```
STAGING_MIGRATE=NO
PRODUCTION_MIGRATE=NO
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

Companion to `court-resource-canonical-booking-lifecycle-01`. Backfilling legacy
bookings into `public.court_operations_bookings` is a **separate, later,
separately approved** package. Nothing here is authorized by applying that
package.

## Scope

Moving historical booking records from legacy club-scoped stores into the
canonical Court Operations booking aggregate, and deciding which of them are
allowed to project capacity into `public.court_resource_reservations`.

Out of scope: the customer boundary, payments reconciliation, recurring-series
reconstruction, and any change to Phase 3B capacity semantics.

## Non-negotiable rules

### 1. Deterministic source identity

Every legacy record must resolve to a stable source key formed from
`(tenant_id, club_id, legacy_store, legacy_booking_id)`. If a legacy record has
no stable id — for example it is only addressable by array position inside a
club JSON blob — it is **not migratable**. Synthesizing an id from mutable
content (name, phone, time, court label) is forbidden, because a later re-run
would produce a different key and duplicate the row.

### 2. Deterministic target bookingId

`booking_id` must be derived deterministically from the source key, so that
re-running the migration maps the same source record to the same target row.
Use a UUIDv5-style derivation over a fixed namespace plus the source key.
`gen_random_uuid()` is forbidden for migrated rows — it makes the migration
non-idempotent and makes reconciliation impossible.

Record the source key alongside the target row (migration-owned mapping table,
authored in the future package) so the mapping is auditable and re-checkable.

### 3. physicalCourtId mapping is required

A legacy booking may only migrate if its legacy court resolves to exactly one
canonical `physical_court_id` through the deterministic mapping in
`public.court_resource_legacy_court_identity_mappings`
(`classification = 'deterministic'`).

- No mapping row → **do not migrate**.
- More than one candidate → ambiguous → **do not migrate**.
- Mapping exists but the court belongs to another tenant → **do not migrate**.

`court_display_name` on the target row is a snapshot for display only. It is
never an input to court resolution.

### 4. No label merge

Two legacy courts that merely share a display label, number, code or normalized
name are **not** the same court. Label similarity must never be used to merge,
deduplicate or infer identity. Only the deterministic mapping table decides
identity. Any label-based heuristic invalidates the migration.

### 5. Fail closed on anything unresolved

The migration reports and skips; it never guesses. Fail-closed cases:

- unresolved or ambiguous court mapping
- missing or blank tenant, missing club, or club not owned by the tenant
- missing / invalid time window (`ends_at <= starts_at`)
- lifecycle value outside the canonical vocabulary and not safely mappable
- source key not stable

A run that cannot resolve every record still succeeds for the resolvable subset,
but must emit an explicit unresolved report. Unresolved records stay legacy-only
and are re-attempted after the mapping data is fixed.

### 6. Idempotent

Re-running must be a no-op for already-migrated records. Combination of the
deterministic `booking_id` (rule 2) and the source-key mapping gives this.
Behaviour on re-run:

- target row absent → insert
- target row present and content-equal → skip
- target row present and content-differs → report drift, do not silently
  overwrite

Never delete-then-reinsert. Never bump `version` on a no-op.

### 7. Never fabricate capacity without validation

This is the highest-risk rule. Inserting a booking row is a business-store write
and does **not** create capacity. Writing capacity means calling the Phase 3B
authority, which enforces the exclusion constraint.

Therefore:

- Historical / completed / cancelled legacy bookings migrate as business rows
  with `reservation_id = NULL`. They must **not** be given reservations. Back-
  dating capacity into `public.court_resource_reservations` rewrites reservation
  history and is forbidden.
- Only future, active bookings are candidates for capacity projection, and only
  through `court_resource_reserve_core` — never a direct `INSERT` into
  `public.court_resource_reservations`, and never with the exclusion constraint
  disabled, dropped or deferred.
- If `reserve_core` rejects a candidate with `FOREIGN_RESERVATION_CONFLICT`, the
  legacy record has collided with real canonical capacity. Report it as a
  conflict for human resolution. Do not release the incumbent reservation, do
  not force the row in, and do not migrate that booking with a fabricated
  `reservation_id`.
- A booking row must never point at a `reservation_id` it does not own
  (`owner_type = 'booking'`, `owner_id = booking_id`).

## Required phases

1. **Inventory (read-only).** Count legacy records per tenant/club/store.
   Classify by court-mapping resolvability and by time (past vs future).
2. **Dry run (read-only).** Produce the full plan: would-insert, would-skip,
   unresolved with reason, and the capacity-candidate subset. Zero writes.
3. **Review gate.** Owner reviews the unresolved and conflict lists. Unresolved
   court mappings are fixed in the mapping data, not in the migration.
4. **Business backfill.** Insert booking rows only, `reservation_id = NULL`.
   Reversible by deleting exactly the deterministic ids produced.
5. **Capacity projection.** Future active bookings only, one at a time through
   `court_resource_reserve_core`, conflicts reported not forced.
6. **Reconcile.** Assert every migrated booking with a non-null
   `reservation_id` owns that reservation, and that no reservation is owned by a
   booking that does not exist.

Each phase needs its own Owner GO. Phases must not be merged.

## Verification before any GO

- Every migrated booking's `physical_court_id` exists in
  `public.court_resource_physical_courts` and belongs to the booking's tenant.
- Every migrated booking's club belongs to the booking's tenant.
- No migrated booking has a `reservation_id` owned by another owner.
- Reservation row count changes only by the number of successfully projected
  future bookings — and by nothing else.
- Re-running the dry run after the backfill reports zero would-insert.

## Status

```
STATUS=STRATEGY_ONLY
EXECUTABLE_ARTIFACTS=0
STAGING_MIGRATE=NO
PRODUCTION_MIGRATE=NO
```

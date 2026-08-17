# Legacy resource block migration — STRATEGY ONLY

**DO NOT EXECUTE. THIS DOCUMENT CONTAINS NO RUNNABLE MIGRATION.**

```
STAGING_EXECUTION=NO
PRODUCTION_EXECUTION=NO
STAGING_MIGRATE=NO
PRODUCTION_MIGRATE=NO
STAGING_APPLY=NO
PRODUCTION_APPLY=NO
```

Companion to `court-resource-canonical-resource-blocks-01`. Backfilling legacy
maintenance / operational blocks into
`public.court_operations_resource_blocks` is a **separate, later, separately
approved** package. Nothing here is authorized by applying that package.

## Class A — potentially migratable

Time-bounded maintenance bookings (or other timed lock records) that:

1. Have a stable source key `(tenant_id, club_id, legacy_store, legacy_id)`.
2. Resolve to exactly one canonical `physical_court_id` via
   `public.court_resource_legacy_court_identity_mappings`
   (`classification = 'deterministic'`).
3. Have a valid time window (`ends_at > starts_at`).
4. Can map to `block_type = MAINTENANCE` (or `OPERATIONAL_BLOCK` when the
   source is clearly an operations timed block).

These may become business rows and, for **future active** windows only, may
project capacity through `court_resource_reserve_core` with
`owner_type=maintenance|operations`, `owner_id=resource_block_id`,
`owner_sub_type=resource_block`.

## Class B — NOT auto-migratable

Indefinite `court.status` toggles (`locked` / `maintenance` / similar live
operational flags without an interval):

- There is **no** inventable start/end window.
- Never fabricate windows.
- Never match by display label alone.
- These remain live operational state on the legacy board until a separate
  reconciliation strategy defines explicit windows (manual operator entry or a
  future product decision). They must **not** be auto-migrated into Resource
  Blocks.

Reconciliation strategy for Class B (future Owner GO):

1. Inventory courts currently flagged without an interval.
2. Operator confirms each needs a timed Resource Block or remains indefinite
   live status.
3. Timed cases enter Class A with an explicit operator-supplied window.
4. Indefinite cases stay on legacy `court.status` and are out of capacity SSOT.

## Non-negotiable rules

1. **Deterministic source identity** — no id synthesis from mutable content.
2. **Deterministic target resourceBlockId** — UUIDv5-style from source key;
   `gen_random_uuid()` forbidden for migrated rows.
3. **physicalCourtId mapping required** — unresolved / ambiguous → skip.
4. **No label merge** — display name similarity is never identity.
5. **Fail closed** — report and skip; never guess.
6. **Idempotent** — re-run is a no-op for already-migrated records.
7. **Never fabricate capacity** — business insert ≠ capacity. Capacity only via
   `court_resource_reserve_core`. Historical / cancelled rows migrate with
   `reservation_id = NULL`. Conflict → report, do not force.

## Status

```
STATUS=STRATEGY_ONLY
EXECUTABLE_ARTIFACTS=0
STAGING_EXECUTION=NO
PRODUCTION_EXECUTION=NO
CLASS_B_AUTO_MIGRATE=NO
```

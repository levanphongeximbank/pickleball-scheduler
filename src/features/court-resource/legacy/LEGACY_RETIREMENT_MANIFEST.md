# Court Operations — Legacy retirement manifest (Batch 8)

```
LEGACY_RETIREMENT_MANIFEST_COMPLETE=YES
SAFE_TO_DELETE_NOW=NO (all retained items)
```

| ITEM | CURRENT_LOCATION | CURRENT_ROLE | CANONICAL_REPLACEMENT | CANONICAL_AUTHORITY | MIGRATION_REQUIRED | SAFE_TO_DELETE_NOW | RETIREMENT_TRIGGER |
| ---- | ---------------- | ------------ | --------------------- | ------------------- | ------------------ | ------------------ | ------------------ |
| club_data_v3 courts | `domain/clubStorage.js`, venue-court inventory | EXPLICIT_LEGACY_RUNTIME | `court_resource_physical_courts` + operational access | NO | YES (identity map) | NO | Cutover ON + inventory certified |
| club_data_v3 bookings | `domain/clubStorage.js` / `bookingService.js` | LEGACY_COMPATIBILITY / MIGRATION_SOURCE | `court_operations_bookings` | NO | YES | NO | Booking lifecycle cutover ON |
| loadCourtsForClub | `domain/clubStorage.js` / `courtService.js` | EXPLICIT_LEGACY_RUNTIME | `listEligibleCourts` / inventory RPC | NO | NO | NO | No remaining OFF-path callers |
| loadBookingsForClub | `domain/clubStorage.js` | EXPLICIT_LEGACY_RUNTIME | Booking list RPC / owner reservation read | NO | NO | NO | Gateway legacy substrate retired |
| legacyCourtIdentityMapping | `contracts/` + `legacy/` | MIGRATION_ONLY / OFF-path | Native `physicalCourtId` | NO | YES (dry-run) | NO | All persisted ids native UUID |
| legacy courtId | blob / UI fields | COMPATIBILITY_PROJECTION | `physicalCourtId` | NO | YES | NO | Data migration complete |
| selectedCourtIds compatibility | schedules / settings | COMPATIBILITY_PROJECTION (UUID ok) | `physicalCourtIds` | NO | Optional rename | NO | New structures use physicalCourtIds |
| legacy maintenance booking | `bookingType=maintenance` | LEGACY_COMPATIBILITY / MIGRATION_SOURCE | Resource Blocks | NO | YES (interval required) | NO | Resource Blocks cutover ON |
| court.status | club blob / CourtStatusBoard | LEGACY_COMPATIBILITY_ONLY | Live Runtime operational state + Resource Blocks | NO | NO (not auto) | NO | Live Runtime + Blocks ON |
| currentMatchId | Court Engine / UI | UI_PROJECTION_ONLY | `sourceType` + `sourceId` | NO | NO | NO | Live Runtime ON + UI cutover |
| Court Engine blob occupancy | court-engine session | LEGACY_COMPATIBILITY | `court_operations_*_live_*` | NO | NO (no stale promote) | NO | Live Runtime ON |
| Daily Play D4 legacy path | Phase 3B/D4 SQL acquire | EXPLICIT_LEGACY_RUNTIME OFF-path | Adapter B → Head A | NO | NO | NO | Adapter B default ON + D4 retire GO |
| Daily Play lease projection | `dailyPlayLeaseProjection.js` | UI_PROJECTION / LEGACY_COMPATIBILITY | Capacity SSOT + Live Runtime | NO | NO | NO | Adapter B + Live Runtime ON |
| legacy tournament booking bridge | `tournamentBookingService` + legacy adapter | EXPLICIT_LEGACY_RUNTIME | Mode Adapter B + Head A | NO | Optional | NO | Competition adapters default ON |

## Data migration strategy (consolidate — do not execute)

1. Deterministic `physicalCourtId` mapping only — never by display label.
2. Unresolved records fail closed.
3. Idempotent dry-run before write.
4. No duplicate canonical reservations.
5. No fabricated historical capacity.
6. Ephemeral stale occupancy is **not** auto-migrated (`STALE_EPHEMERAL_STATE_AUTO_MIGRATED=NO`).
7. Unbounded `court.status` is **not** converted to Resource Blocks.

Tooling: `legacy/legacyMigrationDryRun.js`, `legacyBookingMigrationDryRun.js`, `physicalCourtMigrationDryRun.js`.

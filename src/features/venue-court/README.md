# Venue & Court

## Purpose

Facade cho Venue & Court master inventory và operating hours.

## Current SSOT

### Court inventory

```text
club_data_v3.data.courts[]
```

### Operating hours (Phase 1C)

```text
club_data_v3.data.courtManagement.openHour
club_data_v3.data.courtManagement.closeHour
```

Legacy key `pickleball-venue-hours-v1::{tenantId}` is **compatibility-only**:

* Read-once import **only** when all safe-eligibility rules pass (identical 7-day whole-hour schedule).
* **No dual-write.**
* Unsafe legacy → `legacyImport.status = "not_imported"` + reason; CM unchanged.

## Ownership

Venue & Court sở hữu Court master inventory và operating hours SSOT.

## Non-ownership

* Booking availability
* Court Engine runtime
* Competition assignment
* Match lifecycle
* AI court suggestions

## Allowed dependencies

```text
venue-court → domain courtService
venue-court → domain clubStorage.loadCourtsForClub
venue-court → domain courtManagementSettings
venue-court → data/club.loadClubs
```

API courts handler (Phase 1D) may depend on this facade only:

```text
courtsHandler → venue-court listCourts
```

## Forbidden dependencies

```text
venue-court → Competition Engine
venue-court → Court Engine runtime
venue-court → AI store
venue-court → localStorage (except documented legacy hours helper)
courtsHandler → loadAIData / AI store / clubStorage / localStorage
```

## Public API

* `listCourts` / `getCourtById`
* `getVenueOperatingHours({ clubId, venueId|tenantId })`
* `updateVenueOperatingHours({ openHour, closeHour }, { clubId, venueId|tenantId })`
* `shouldWarnLegacyImport(legacyImport)`
* `LEGACY_IMPORT_REASON`

## Phase status

```text
PHASE 1D — COURTS API SOURCE CORRECTION
```

`GET /api/v1/courts` reads Club V3 inventory via `listCourts` (not `loadAIData().courts`).

Multi-club callers must pass `query.clubId` (handler returns **400** `CLUB_REQUIRED` if omitted when more than one club is allowed).

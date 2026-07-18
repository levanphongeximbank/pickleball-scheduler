# Venue & Court

## Purpose

Facade cho Venue & Court master inventory, operating hours, availability contract, và Competition availability adapter.

## Current SSOT

### Court inventory

```text
club_data_v3.data.courts[]
```

### Bookings

```text
club_data_v3.data.bookings[]
```

### Operating hours (Phase 1C)

```text
club_data_v3.data.courtManagement.openHour
club_data_v3.data.courtManagement.closeHour
```

## Ownership

Venue & Court sở hữu Court master inventory, bookings substrate access for availability, và operating hours SSOT.

## Non-ownership

* Court Engine runtime
* Competition assignment / match lifecycle
* AI court suggestions

## Allowed dependencies

```text
venue-court → domain courtService
venue-court → domain clubStorage (courts/bookings read)
venue-court → domain courtManagementSettings
venue-court → domain courtBookingEngine (pure conflict helpers)
venue-court → data/club.loadClubs
```

## Forbidden dependencies

```text
venue-court → Competition Engine
venue-court → Court Engine runtime
venue-court → AI store
venue-court → localStorage (except documented legacy hours helper)
```

## Dependency direction (Competition)

```text
Competition consumer
  → getCompetitionCourtAvailability (adapter)
  → getCourtAvailability (Phase 1E)
  → inventory / bookings / operating hours
```

Venue & Court must not import Competition. Phase 1F adapter is **not** wired into Competition runtime.

## Public API

* `listCourts` / `getCourtById`
* `getVenueOperatingHours` / `updateVenueOperatingHours`
* `shouldWarnLegacyImport` / `legacyImportUserMessage` / `LEGACY_IMPORT_REASON`
* `getCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtId?, courtIds?, clusterId?, context?, includeUnavailable? })`
* `AVAILABILITY_REASON`
* `getCompetitionCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtIds?, clusterId?, context?, includeUnavailable? })`

## Phase status

```text
PHASE 1G — FINAL QA AND RELEASE READINESS
```

Phase 1 tip commit: `7ce80ff` (1F). See:

* `docs/venue-court/PHASE_1G_FINAL_QA_REPORT.md`
* `docs/venue-court/PHASE_1_RELEASE_READINESS.md`

`getCourtAvailability` is **read-only**. Overlap semantics delegate to `courtBookingEngine` (half-open intervals). Overnight/cross-day requests are rejected.

`includeUnavailable` (boolean, default `true`): when omitted/true, returns available and unavailable courts; when `false`, omits unavailable results from `courts` (may be `[]`). Filtering does not mutate source data and does not bypass scope/time validation or load failures.

`getCompetitionCourtAvailability` is a thin Competition-facing adapter over that contract. It returns `availableCourtIds` (deterministic inventory/`courtIds` order) plus optional `unavailableCourts` reasons. It does not assign, reserve, or persist courts.

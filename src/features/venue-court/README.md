# Venue & Court

## Purpose

Facade cho Venue & Court master inventory, operating hours, và availability contract.

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

## Public API

* `listCourts` / `getCourtById`
* `getVenueOperatingHours` / `updateVenueOperatingHours`
* `getCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtId?, courtIds?, clusterId?, context?, includeUnavailable? })`
* `AVAILABILITY_REASON`

## Phase status

```text
PHASE 1E — CANONICAL COURT AVAILABILITY CONTRACT
```

`getCourtAvailability` is **read-only**. Overlap semantics delegate to `courtBookingEngine` (half-open intervals). Overnight/cross-day requests are rejected.

`includeUnavailable` (boolean, default `true`): when omitted/true, returns available and unavailable courts; when `false`, omits unavailable results from `courts` (may be `[]`). Filtering does not mutate source data and does not bypass scope/time validation or load failures.

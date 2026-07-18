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

Venue & Court must not import Competition. Phase 2B wires Competition consumers → this adapter (read-only gate).

## Public API

* `listCourts` / `getCourtById`
* `getVenueOperatingHours` / `updateVenueOperatingHours`
* `shouldWarnLegacyImport` / `legacyImportUserMessage` / `LEGACY_IMPORT_REASON`
* `getCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtId?, courtIds?, clusterId?, context?, includeUnavailable? })`
* `AVAILABILITY_REASON`
* `getCompetitionCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtIds?, clusterId?, context?, includeUnavailable? })`

## Phase status

```text
PHASE 2C — TOURNAMENT BOOKING BRIDGE HARDENING
```

See `docs/venue-court/PHASE_2C_BOOKING_BRIDGE.md` for booking bridge ownership, sync lifecycle, idempotency, and fail-closed conflict rules.

`getCourtAvailability` is **read-only**. Overlap semantics delegate to `courtBookingEngine` (half-open intervals). Overnight/cross-day requests are rejected.

`includeUnavailable` (boolean, default `true`): when omitted/true, returns available and unavailable courts; when `false`, omits unavailable results from `courts` (may be `[]`). Filtering does not mutate source data and does not bypass scope/time validation or load failures.

`getCompetitionCourtAvailability` is a thin Competition-facing adapter over that contract. It returns `availableCourtIds` (deterministic inventory/`courtIds` order) plus optional `unavailableCourts` reasons. It does not assign, reserve, or persist courts.

Phase 2B consumers (Tournament Engine `generateSchedule` / `assignCourts`, Director `assignTournamentMatchToAvailableCourt`) call the adapter as a **pre-assign gate** when `clubId` + civil window are present. Algorithms are unchanged.

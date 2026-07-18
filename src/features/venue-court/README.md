# Venue & Court

## Purpose

Facade cho Venue & Court master inventory.

Phase 1B cung cấp API đọc Court Inventory ổn định để module khác không phụ thuộc trực tiếp vào cấu trúc Club V3 blob.

## Current SSOT

```text
club_data_v3.data.courts[]
```

thông qua existing domain service (`courtService` / `clubStorage.loadCourtsForClub`).

## Ownership

Venue & Court sở hữu Court master inventory.

## Non-ownership

Module này không sở hữu:

* Booking availability.
* Court Engine runtime.
* Competition assignment.
* Match lifecycle.
* AI court suggestions.

## Allowed dependencies

```text
venue-court → domain courtService
venue-court → domain clubStorage.loadCourtsForClub (club inventory path only)
venue-court → data/club.loadClubs (tenant/venue gate parity with courtService)
```

## Forbidden dependencies

```text
venue-court → Competition Engine
venue-court → Court Engine runtime
venue-court → AI store
venue-court → localStorage key trực tiếp
```

## Public API (Phase 1B)

* `listCourts({ clubId, venueId, tenantId, clusterId, includeInactive })`
* `getCourtById(courtId, options)`

## Phase status

```text
PHASE 1B — MINIMAL FACADE ONLY
```

Chưa có:

* Availability contract
* Operating hours consolidation
* Competition / Court Engine wiring
* API `/courts` correction

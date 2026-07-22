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

## Dependency direction (Court Engine)

```text
Court Engine consumer
  → courtEngineAvailabilityGuard (adapter)
  → getCourtAvailability (Phase 1E)
  → inventory / bookings / operating hours
```

Venue & Court must not import Court Engine. Phase 2D wires CE confirm/transfer/preview as a **read-only guard**.

## Public API

* `listCourts` / `getCourtById`
* `getVenueOperatingHours` / `updateVenueOperatingHours`
* `shouldWarnLegacyImport` / `legacyImportUserMessage` / `LEGACY_IMPORT_REASON`
* `getCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtId?, courtIds?, clusterId?, context?, includeUnavailable? })`
* `AVAILABILITY_REASON`
* `getCompetitionCourtAvailability({ clubId, venueId?, date, startTime, endTime, courtIds?, clusterId?, context?, includeUnavailable? })`
* `listCanonicalCourtDescriptors({ tenantId, clubId, venueId, courtIds?, clusterId?, includeInactive?, includeLocked? })` (Phase 3B)
* `DESCRIPTOR_AUTHORITY` / `SOURCE_CONTRACT_VERSION` / `DESCRIPTOR_DIAGNOSTIC_REASON` / `DESCRIPTOR_ERROR`
* Civil time helpers (Phase 2E): `getLocalCivilDate`, `normalizeCivilWindow`, `isoToCivilHhmmOnDate`, `CIVIL_TIME_ERROR`, …

## Phase status

```text
PHASE 3C — AUTHORITATIVE COURT PRIORITY PERSISTENCE
```

See `docs/venue-court/PHASE_3C_AUTHORITATIVE_COURT_PRIORITY_PERSISTENCE.md`.

Optional Venue-owned `court.priority` is preserved only when it is an explicit
finite number. No default, no inference, no backfill, no UI, no HTTP/SQL change
in this phase. Phase 3B descriptors continue to omit courts without authoritative
priority (`PRIORITY_NOT_AUTHORITATIVE`).

Prior phase:

```text
PHASE 3B — CANONICAL COURT DESCRIPTOR PUBLIC CONTRACT
```

See `docs/venue-court/PHASE_3B_CANONICAL_COURT_DESCRIPTOR_CONTRACT.md`.

`listCanonicalCourtDescriptors` is a separate Competition-facing inventory descriptor contract. It does **not** change `getCompetitionCourtAvailability` (eligibility-only). Courts without an explicit finite numeric Venue inventory `priority` are omitted with diagnostic `PRIORITY_NOT_AUTHORITATIVE`. Snapshot fields are always `null` in Phase 3B.

Prior phase docs remain authoritative for their scopes:

* Phase 2F: `docs/venue-court/PHASE_2F_MULTI_VENUE_RUNTIME.md`

**Scope rule (Phase 2F):** engines require explicit `clubId`. No silent first-club fallback when multiple clubs exist. Court Engine sessions load **club inventory only** (never venue-union into a club-keyed session). `clusterId` is a filter only. Venue switcher is a UI pointer — not automatic engine ownership. Phase 2E IANA timezone rules remain authoritative per venue.

Phase 2E time model docs remain in `docs/venue-court/PHASE_2E_TIME_MODEL.md`.

Phase 2D Court Engine guard docs remain in `docs/venue-court/PHASE_2D_COURT_ENGINE_GUARD.md`.

Phase 2C booking bridge docs remain in `docs/venue-court/PHASE_2C_BOOKING_BRIDGE.md`.

`getCourtAvailability` is **read-only**. Overlap semantics delegate to `courtBookingEngine` (half-open intervals). Overnight/cross-day requests are rejected.

`includeUnavailable` (boolean, default `true`): when omitted/true, returns available and unavailable courts; when `false`, omits unavailable results from `courts` (may be `[]`). Filtering does not mutate source data and does not bypass scope/time validation or load failures.

`getCompetitionCourtAvailability` is a thin Competition-facing adapter over that contract. It returns `availableCourtIds` (deterministic inventory/`courtIds` order) plus optional `unavailableCourts` reasons. It does not assign, reserve, or persist courts.

Phase 2B consumers (Tournament Engine `generateSchedule` / `assignCourts`, Director `assignTournamentMatchToAvailableCourt`) call the adapter as a **pre-assign gate** when `clubId` + civil window are present. Algorithms are unchanged.

Phase 2D Court Engine paths (`confirmAssignments`, `transferAssignment`, preview filter) call `getCourtAvailability` through `courtEngineAvailabilityGuard` with explicit `clubId` + civil window. Confirmation always re-checks. No booking writes from Court Engine.

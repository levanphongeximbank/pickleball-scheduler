# Shared Court Resource Foundation

**Status:** Code foundation on existing booking/inventory substrate  
**Module owner:** Venue & Court (`src/features/venue-court/`)  
**Not:** Team Tournament-specific. **Not:** Court Engine live occupancy. **Not:** a new SQL authority.

This document extends — it does not replace — `docs/venue-court/` Phase 1–3 contracts.

---

## Domain model

```text
Venue  ≠  Court Cluster  ≠  Physical Court
```

| Concept | Identity | Role |
| ------- | -------- | ---- |
| Venue / tenant | `tenantId` / `venueId` | Organization |
| Club | `clubId` | Club blob / inventory owner |
| Court Cluster | `clusterId` | Location / facility **filter/scope** |
| Physical court | `courtId` | Canonical resource authority |
| Display name | `courtLabel` | Projection only — never reservation identity |

Selecting cluster `NAM_LONG` does **not** reserve `NL_C01`…`NL_C06`. Only `selectedCourtIds` may be reserved.

---

## Capacity reservation vs match assignment

```text
CAPACITY RESERVATION     one selected physical court × one time window
                         T01 owns C01 08:00–18:00

MATCH ASSIGNMENT         planned use inside that window
                         M12 uses C01 10:00–10:30
```

Match assignment is **validation**. It must not create a customer booking merely to express use of an already-reserved court. It must not create one reservation per match.

---

## Ownership of concerns

| Owner | Owns |
| ----- | ---- |
| Venue & Court | inventory, hours, capabilities, inactive/maintenance master state |
| Court Resource Authority (this foundation) | availability, reserve, release, conflict, reservation ownership, resource lease |
| Competition / Tournament | participants, draw, stage, schedule, match, **planned** court assignment, scoring |
| Court Engine | actual physical court, actual start/end, playing/paused, transfer, live occupancy, referee dispatch |

Do not move Venue/Court authority into Tournament. Do not add Competition-owned physical locks in this batch.

---

## Shared contract (`CourtResourceGateway`)

```javascript
getCourtAvailability(options)      // owner-aware; delegates to canonical availability
reserveCourts(options)             // selected courtId × window; not whole cluster
releaseCourts(options)             // only reservations owned by options.owner
validateCourtAssignment(options)   // planned match window; no writes
getReservationOwner(options)       // normalized owner, no blob internals
```

Owner context (generic, multi-workload):

```javascript
owner: { type, id }
// tournament example: { type: "tournament", id: tournamentId }
```

Same owner may reuse its covering capacity reservation (`OWN_RESERVATION`).  
Foreign tournament / customer / maintenance overlapping the window → conflict.  
Do **not** implement `bookingType=tournament → ignore all tournament bookings`.

---

## Canonical inventory

- Cloud authority: `public.club_data_v3` **by `club_id`**.
- Storage-shape parsing (`data.courts` and `data.data.courts`) lives in Venue & Court.
- Canonical club row with `venue_id = NULL` is accepted; do not require blob `venue_id = tenantId`.
- After read, fail-closed filter by `clubId`, `tenantId`/`venueId`, `clusterId` when supplied, active state.
- No localStorage fallback when cloud authority is requested.
- No first-club / first-venue fallback.
- Team Tournament `canonicalClubCourtInventory.js` is a **compatibility re-export** only.

Synchronous `listCourts` remains the local compatibility API. This foundation does not force a repo-wide async rewrite.

---

## Dependency direction

```text
Customer Booking / Daily Play / Internal / Official / Team Tournament / Maintenance
    ↓
CourtResourceGateway
    ↓
canonical availability + cluster membership + owner normalization
    ↓
club_data_v3 courts[] / bookings[]  +  bookingService / tournamentBookingService
```

**Forbidden reverse dependency:** Venue & Court must not import Competition, Tournament Engine, Court Engine, or AI.

Existing `getCompetitionCourtAvailability` is preserved and now depends on the gateway. It does not duplicate availability algorithms.

---

## Substrate reuse (no new tables)

This foundation composes:

- `courtInventoryService` / `canonicalCloudCourtInventory`
- `courtAvailabilityService`
- `competitionCourtAvailabilityAdapter`
- `bookingService` / `courtBookingEngine`
- `tournamentBookingService` (capacity rows: `bookingType=tournament` + `tournamentId`)
- court cluster membership (filter, not lock)

No new booking table, court table, tournament reservation table, or lock table.

---

## Legacy adapters retained

| Adapter | Status |
| ------- | ------ |
| `listCourts` / `getCourtById` (sync local) | retained |
| Team Tournament `listCanonicalClubCourtsForFormatVenue` | compatibility re-export |
| `tournamentBookingService` | capacity substrate for tournament owners |
| Legacy tournament Court Engine (`src/tournament/engines/courtEngine.js`) | untouched; migrate later |

---

## Consumer migration plan

1. **This PR:** shared contract + owner-aware availability + tests. Existing consumers keep current call sites.
2. **Next:** Internal / Official / Team Tournament match assignment calls `validateCourtAssignment` with `owner`.
3. **Later:** Daily Play / customer booking / maintenance call `reserveCourts` / `releaseCourts` instead of ad-hoc booking writes.
4. **Later:** Court Engine live occupancy consumes — does not replace — this resource lease.

---

## Security / fail closed

- Foreign tenant / club / cluster court → deny
- Foreign owner reservation → not reusable
- Unknown court → deny
- No first-club / first-venue fallback
- No localStorage authority when cloud is requested
- No `courtLabel` identity fallback

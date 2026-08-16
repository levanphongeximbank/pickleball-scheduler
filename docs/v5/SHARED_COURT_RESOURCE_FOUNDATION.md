# Shared Court Resource Foundation

**Status:** Code foundation on existing booking/inventory substrate  
**Module owner:** Court Resource (`src/features/court-resource/`)
**Compatibility substrate:** Venue & Court (`src/features/venue-court/`)
**Not:** Team Tournament-specific. **Not:** Court Engine live occupancy. **Not:** silent Production reservation cutover.

Phase 3B authors the canonical reservation table and RPCs under
`docs/v5/migrations/court-resource-phase3b-canonical-reservation-01/`.
`CANONICAL_RESERVATION_CUTOVER` defaults to **false**. Court Engine remains a
projection/read consumer and does not insert canonical reservation rows.

This document extends — it does not replace — `docs/venue-court/` Phase 1–3 contracts.

---

## Domain model

```text
Venue  ≠  Court Cluster  ≠  Physical Court
```

| Concept | Identity | Role |
| ------- | -------- | ---- |
| Venue / tenant | `tenantId` / `venueId` | Organization |
| Club | `clubId` | Operational context/access; not physical identity owner |
| Court Cluster | `clusterId` | Location / facility **filter/scope** |
| Physical court | immutable `physicalCourtId` | Canonical physical identity |
| Legacy court reference | `clubId + courtId` | Transitional compatibility identity |
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

**Frozen:** `COURT_RESOURCE_OWNER=2.2_COURT_OPERATIONS`. See `src/features/court-resource/OWNERSHIP.md`.

| Owner | Owns |
| ----- | ---- |
| 2.1 Venue Management | venue identity / lifecycle |
| Platform organization | tenant / organization identity |
| 2.3 Club Management | club identity / lifecycle / membership — **not** court access |
| 2.2 Court Operations (`src/features/court-resource/`) | `CourtResourceGateway`, Physical Court identity (`physicalCourtId`), cluster topology (`clusterId` filter only), court inventory, club→physicalCourt operational access, eligibility, availability, reserve, release, conflict, reservation ownership |
| Venue & Court (`src/features/venue-court/`) | **transitional compatibility** hours/capabilities and legacy `club_data_v3` court projection — **not** target inventory/capacity SSOT |
| Competition / Tournament | participants, draw, stage, schedule, match, **planned** court assignment, scoring |
| Court Engine | actual physical court, actual start/end, playing/paused, transfer, live occupancy, referee dispatch |

Do not move Court Operations authority into Venue Management, Club Management, or Tournament. Do not add Competition-owned physical locks in this batch.

---

## Shared contract (`CourtResourceGateway`)

```javascript
listEligibleCourts(options)        // canonical inventory: tenantId + clubId + optional clusterId
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

## Transitional operational inventory

- Current legacy cloud source: `public.club_data_v3` **by `club_id`**.
- `club_data_v3.data.courts[]` is a transitional Club operational inventory /
  legacy projection. It is **not** the system-wide Physical Court master.
- Final physical authority is durable `court_clusters.id` → immutable canonical
  Physical Court UUID → explicit Club operational access.
- Storage-shape parsing (`data.courts` and `data.data.courts`) lives in Venue & Court.
- Canonical club row with `venue_id = NULL` is accepted; do not require blob `venue_id = tenantId`.
- After read, fail-closed filter by `clubId`, `tenantId`/`venueId`, `clusterId` when supplied, active state.
- No localStorage fallback when cloud authority is requested.
- No first-club / first-venue fallback.
- Team Tournament `canonicalClubCourtInventory.js` is a **compatibility re-export** only.

Synchronous `listCourts` remains the local compatibility API. This foundation does not force a repo-wide async rewrite.

---

## Transitional operational cluster binding

`bindClubCourtsToCluster` / `public.bind_club_courts_to_cluster` is a
**transitional operational cluster-binding compatibility writer**. It stamps:

- Club facility registration: `clubs.registered_cluster_id`
- selected transitional inventory courts: `club_data_v3.data.courts[].clusterId`

It is **not** the final Physical Court identity master and **not** Court
Resource reservation authority. It does not create `physicalCourtId` UUIDs.
Missing `clusterId` stays missing; cloud readers must not fabricate
`{venueId}-main`.

```text
CLUSTER BINDING
≠ PHYSICAL COURT ACCESS
≠ CAPACITY RESERVATION
≠ MATCH ASSIGNMENT
≠ LIVE OCCUPANCY
```

`clubs.registered_cluster_id` is Club facility/cluster registration.
`court_resource_club_operational_access` is Club → Physical Court UUID
authorization. A Club registered to Nam Long may have access to only a subset
of that facility's courts. Registration does not reserve courts.

Unstamped legacy courts classify as `unresolved_cluster` / review. Phase 3A
identity PRECHECK/dry-run does not require the #429 binder SQL to already be
applied.

---

## Dependency direction

```text
Customer Booking / Daily Play / Internal / Official / Team Tournament / Maintenance
    ↓
CourtResourceGateway (`src/features/court-resource/`)
    ↓
canonical availability + cluster membership + owner normalization
    ↓
LegacyReservationAdapter
    ↓
club_data_v3 courts[] / bookings[]  +  bookingService / storage primitives
```

**Forbidden reverse dependency:** Court Resource and its lower-level adapters
must not import `tournamentBookingService`, Competition, Tournament Engine,
Team Tournament, Court Engine, or AI Director.

Existing `getCompetitionCourtAvailability` is preserved and now depends on the gateway. It does not duplicate availability algorithms.

---

## Substrate reuse (no new tables)

This foundation composes:

- `courtInventoryService` / `canonicalCloudCourtInventory`
- `courtAvailabilityService`
- `competitionCourtAvailabilityAdapter`
- `bookingService` / `courtBookingEngine`
- neutral legacy reservation adapter (capacity rows: `bookingType=tournament` + `tournamentId`)
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

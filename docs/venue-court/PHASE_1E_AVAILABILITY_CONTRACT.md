# Phase 1E — Canonical Court Availability Contract

**Status:** Implemented (awaiting Owner review — not committed)  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`  
**Depends on:** Phase 1D `e39fbfcd495189455a772deedd7a41b96a3012b2`

---

## Public API

```javascript
import { getCourtAvailability, AVAILABILITY_REASON } from "../src/features/venue-court/index.js";

getCourtAvailability({
  clubId,                 // required
  venueId,                // optional; must match club.venueId
  clusterId,              // optional
  courtId,                // optional single id
  courtIds,               // optional id list
  date,                   // YYYY-MM-DD (venue-local)
  startTime,              // HH:mm
  endTime,                // HH:mm, strictly after startTime same day
  context: {
    type: "booking" | "court-engine" | "competition",
    excludeBookingId: null,
  },
  includeUnavailable: true, // default true
})
```

### Output

```javascript
{
  clubId,
  venueId,
  checkedRange: { date, startTime, endTime },
  courts: [
    {
      available,
      courtId,
      court,          // { id, name, number, active, status, clusterId? } or null
      conflicts: [{ code, referenceId?, message }],
      reasons: [string],
      source: { inventory, booking, settings }
    }
  ],
  source: { inventory: "club_data_v3", booking: "club_data_v3", settings: "courtManagementSettings" }
}
```

---

## Scope rules

* `clubId` **required** — no first-club auto-pick.
* `venueId` optional; mismatch → throw `VENUE_MISMATCH`.
* Inventory loaded via `listCourts({ clubId, tenantId: venueId, includeInactive: true })`.
* Bookings via `loadBookingsForClub(clubId)` only.
* Unknown `courtId` → `COURT_NOT_FOUND` (no cross-scope leak).

---

## `includeUnavailable`

| Property | Value |
| -------- | ----- |
| Type | `boolean` |
| Default | `true` (when omitted) |

Behavior:

1. **Omitted or `true`:** result `courts` includes both available and unavailable court evaluations.
2. **`false`:** unavailable court results are filtered out of the returned `courts` array.
3. Filtering affects **only** the returned list — it does not modify court, booking, maintenance, or operating-hours source data.
4. A valid scoped request with no available courts and `includeUnavailable: false` returns a **successful** result with `courts: []`.
5. `includeUnavailable` does **not** bypass:
   - scope validation (`clubId` required, `venueId` match)
   - time validation (format, `endTime > startTime`, no overnight)
   - operating-hours evaluation (still yields `OUTSIDE_VENUE_HOURS` before filter)
   - load-failure behavior (`DATA_UNAVAILABLE` is thrown, never converted to empty availability)
6. Reason-code evaluation runs **before** filtering; unavailable courts are not reclassified as available.

---

## Court-state rules

| State | Reason |
| ----- | ------ |
| Missing in scope | `COURT_NOT_FOUND` |
| `active === false` | `COURT_INACTIVE` |
| `status === "maintenance"` | `COURT_MAINTENANCE` |
| `status === "locked"` / not bookable | `COURT_LOCKED` |
| Wrong `clusterId` | `CLUSTER_MISMATCH` |

---

## Booking statuses that block

From `isActiveBookingStatus` / `isBookingBlocking`:

```text
pending, confirmed, checked_in, playing
```

Non-blocking: `completed`, `cancelled`, `no_show`.

Conflict code by `bookingType`:

| Type | Code |
| ---- | ---- |
| `maintenance` | `MAINTENANCE_BOOKING` |
| `tournament` | `TOURNAMENT_BOOKING_CONFLICT` |
| other | `BOOKING_CONFLICT` |

Overlap: `doTimesOverlap` / `checkBookingConflict` — adjacent end==start **allowed**.

---

## Operating hours

SSOT: `courtManagement.openHour` / `closeHour` (Phase 1C).

Request must satisfy `openHour*60 <= start < end <= closeHour*60`.

Outside → `OUTSIDE_VENUE_HOURS`.

Checked **after** booking conflicts (Phase 1A precedence).

---

## Time zone / overnight

* Venue-local `date` + `HH:mm` — **no** ISO/timezone conversion.
* Overnight / cross-day (`endTime <= startTime`) → validation error `INVALID_TIME_RANGE`.

---

## Reason codes

```text
AVAILABLE
COURT_NOT_FOUND
COURT_INACTIVE
COURT_LOCKED
COURT_MAINTENANCE
OUTSIDE_VENUE_HOURS
BOOKING_CONFLICT
TOURNAMENT_BOOKING_CONFLICT
MAINTENANCE_BOOKING
INVALID_TIME_RANGE
VENUE_MISMATCH
CLUSTER_MISMATCH
CLUB_SCOPE_MISSING
DATA_UNAVAILABLE
```

---

## Read-only guarantee

No writes to bookings, courts, settings, markers, or browser storage.

---

## Known limitations

* No Court Engine runtime occupancy (`RUNTIME_OCCUPIED`) in 1E.
* No ISO `startAt`/`endAt` inputs (would invent timezone).
* Competition schedule conflicts without tournament bookings remain Competition-owned (Phase 1F).

---

## Phase 1F entry criteria

* Owner approves 1E.
* Competition may consume `getCourtAvailability` via adapter only.
* No assignment algorithm rewrite in the first adapter wiring.

---

## Files

* `src/features/venue-court/services/courtAvailabilityService.js`
* `src/features/venue-court/index.js`
* `src/features/venue-court/README.md`
* `tests/venue-court/court-availability-service.test.js`
* `docs/venue-court/PHASE_1E_AVAILABILITY_CONTRACT.md`

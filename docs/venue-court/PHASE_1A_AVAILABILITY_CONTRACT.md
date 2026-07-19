# Phase 1A — Availability Contract Design

**Status:** Contract design only — **no implementation in Phase 1A**  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`  
**Implementation target:** Phase 1E

---

## Purpose

Provide a single read-only contract so Booking, Court Engine, Competition, and API consumers ask the same question:

```text
Is this Court allowed to be used in this time range?
```

Venue & Court owns the answer. Engines consume it. Engines do not own inventory.

---

## Proposed API

```javascript
getCourtAvailability({
  venueId,
  clubId,
  clusterId,
  courtId,
  date,
  startTime,
  endTime,
  context
})
```

### Context

```javascript
{
  type: "booking" | "court-engine" | "competition",
  competitionId: null,
  matchId: null,
  sessionId: null,
  excludeBookingId: null // optional: edit-in-place
}
```

### Success (available)

```javascript
{
  available: true,
  courtId: "court-01",
  checkedRange: {
    date: "YYYY-MM-DD",
    startTime: "08:00",
    endTime: "09:00"
  },
  conflicts: [],
  reasons: [],
  source: {
    inventory: "club_data_v3",
    booking: "club_data_v3",
    settings: "courtManagementSettings"
  }
}
```

### Failure (unavailable)

```javascript
{
  available: false,
  courtId: "court-01",
  checkedRange: {
    date: "YYYY-MM-DD",
    startTime: "08:00",
    endTime: "09:00"
  },
  conflicts: [
    {
      code: "BOOKING_CONFLICT",
      referenceId: "booking-id",
      message: "Court already has an overlapping booking"
    }
  ],
  reasons: [
    "Court already has an overlapping booking"
  ],
  source: {
    inventory: "club_data_v3",
    booking: "club_data_v3",
    settings: "courtManagementSettings"
  }
}
```

---

## Conflict codes (minimum)

| Code | Meaning |
| ---- | ------- |
| `COURT_NOT_FOUND` | No court with `courtId` in scoped inventory |
| `COURT_INACTIVE` | `active === false` |
| `COURT_LOCKED` | Master `status === "locked"` |
| `COURT_MAINTENANCE` | Master `status === "maintenance"` |
| `OUTSIDE_VENUE_HOURS` | Range outside operational hours |
| `BOOKING_CONFLICT` | Overlaps active non-tournament booking |
| `TOURNAMENT_BOOKING_CONFLICT` | Overlaps active `bookingType: "tournament"` |
| `INVALID_TIME_RANGE` | Missing/invalid date/time or end ≤ start (same calendar day model) |
| `VENUE_MISMATCH` | Court / club not under requested `venueId` |
| `CLUSTER_MISMATCH` | Court `clusterId` ≠ requested `clusterId` when clusters enforced |
| `DATA_UNAVAILABLE` | Required inventory/bookings/settings could not be loaded (fail-closed) |
| `MAINTENANCE_BOOKING` | Overlaps active maintenance booking block |

Optional future (not required for 1E MVP): `RUNTIME_OCCUPIED` when context requests Court Engine occupancy check.

---

## Input validation

| Field | Rule |
| ----- | ---- |
| `courtId` | Required, non-empty string/id |
| `clubId` | Required for Phase 1 (inventory is club-scoped in Club V3) |
| `date` | Required, `YYYY-MM-DD` |
| `startTime` / `endTime` | Required, `HH:mm` (24h, minutes 00–59) |
| `endTime` | Must be strictly after `startTime` on the same `date` (Phase 1 day model) |
| `venueId` | Optional but if present must match club’s venue |
| `clusterId` | Optional; if clusters enabled and provided, court must match |
| `context.type` | Required; one of allowed enum values |

Invalid input → `available: false`, code `INVALID_TIME_RANGE` or structured validation error (fail-closed).

---

## Timezone

| Decision | Value |
| -------- | ----- |
| Default timezone | `Asia/Ho_Chi_Minh` (`DEFAULT_TIMEZONE` in `ai/config.js`, also on venue/club models) |
| Phase 1 evaluation model | **Civil time on `date`** using `HH:mm` strings — same as `courtBookingEngine.timeToMinutes` |
| Instant conversion | Not required for 1E if callers already pass venue-local wall times |
| Wall-clock “now” checks | Use venue timezone when comparing to current time (auto-start/complete stay in bookingService) |

Contract must document that `date` + `startTime`/`endTime` are **venue-local**, not UTC ISO instants.

---

## Date / time format

| Field | Format | Example |
| ----- | ------ | ------- |
| `date` | `YYYY-MM-DD` | `2026-07-18` |
| `startTime` / `endTime` | `HH:mm` | `08:00`, `21:30` |
| Overnight single booking spanning midnight | **Out of scope for Phase 1 day model** — reject as `INVALID_TIME_RANGE` if `endTime <= startTime` |

This matches existing `checkBookingConflict` behavior.

---

## Overnight operating hours

| Case | Phase 1 rule |
| ---- | ------------ |
| `openHour` / `closeHour` as integers (CM settings) | Same calendar day window: `[openHour, closeHour)` in hours |
| `closeHour === 24` | Means end of day (existing CM convention) |
| Venue hours page per-day strings that cross midnight | Not supported until hours consolidation (1C); do not invent overnight logic in 1E |
| Booking that starts before open or ends after close | `OUTSIDE_VENUE_HOURS` |

**Operational hours SSOT for contract (Phase 1):** `courtManagementSettings` (`openHour`/`closeHour`), not orphan `pickleball-venue-hours-v1`.

---

## Boundary when bookings touch (end == next start)

Existing engine:

```javascript
doTimesOverlap → aStart < bEnd && bStart < aEnd
```

| Case | Result |
| ---- | ------ |
| Booking A `08:00–09:00`, Booking B `09:00–10:00` | **No overlap** — allowed (touching boundary OK) |
| Booking A `08:00–09:00`, Booking B `08:30–09:30` | **Overlap** — conflict |

Availability contract **must preserve** this half-open / exclusive-end semantics for compatibility with Court Management.

---

## Recurring booking

| Rule | Detail |
| ---- | ------ |
| Storage | Expanded instances live in `bookings[]` (plus series metadata) |
| Conflict check | Against concrete booking rows on `date`, not against series definition alone |
| Active only | Only statuses in active set block (`pending`, `confirmed`, `checked_in`, `playing`) |
| Cancelled / completed / no_show | Do not block |

---

## Maintenance booking

| Layer | Code |
| ----- | ---- |
| Master status `maintenance` | `COURT_MAINTENANCE` — block all new use |
| Active `bookingType: "maintenance"` overlapping range | `MAINTENANCE_BOOKING` |
| Both present | Return both conflicts; still `available: false` |

---

## Tournament booking

| Rule | Detail |
| ---- | ------ |
| Active `bookingType: "tournament"` overlap | `TOURNAMENT_BOOKING_CONFLICT` |
| Context `type: "competition"` with same `competitionId` / match edit | May pass `excludeBookingId` or future `allowOwnTournamentId` — **not** auto-open for other competitions |
| Default | Fail closed against any other tournament booking |

Competition intra-schedule conflicts (two matches same court same time **without** going through bookings) remain Competition-owned; availability contract still answers booking-layer occupancy.

---

## Court master status

| Master | Availability |
| ------ | ------------ |
| missing | `COURT_NOT_FOUND` |
| `active: false` | `COURT_INACTIVE` |
| `status: locked` | `COURT_LOCKED` |
| `status: maintenance` | `COURT_MAINTENANCE` |
| `status: active` and `active !== false` | Continue other checks |

Align with `isCourtBookable` / `validateCourtForBooking`.

---

## Plan limits (`maxCourts`)

| Decision | Detail |
| -------- | ------ |
| Participate in **availability** time-window check? | **No** |
| Where enforced? | Inventory create/add path (`subscriptionGuard` / courts.logic) |
| Why | `maxCourts` limits how many courts exist, not whether an existing court is free at 08:00 |

Availability contract assumes `courtId` already exists in inventory.

---

## Runtime occupancy (Court Engine)

| Phase 1E MVP | Optional later |
| ------------ | -------------- |
| Do **not** require Court Engine store read for booking/competition default path | Context `type: "court-engine"` may add `RUNTIME_OCCUPIED` via status adapter |

Precedence with runtime is documented in `PHASE_1A_STATUS_MAPPING.md`. Writing runtime back to master status remains forbidden.

---

## Fail-open vs fail-closed

```text
Khi không xác định được dữ liệu cần thiết:
FAIL CLOSED
```

| Situation | Behavior |
| --------- | -------- |
| Club blob missing / unloadable | `available: false`, `DATA_UNAVAILABLE` |
| Courts array unreadable | fail closed |
| Bookings array unreadable | fail closed — **never** report free |
| Settings missing | Use CM defaults **only if** blob loaded; if blob load failed → fail closed |
| Partial parse errors on court row | Treat as not found / unavailable |

**Never** report `available: true` when booking or court status could not be verified.

---

## Side effects

```text
NONE
```

`getCourtAvailability` is **read-only**. No writes to Club V3, venues, clusters, matches, or Court Engine stores.

---

## Delegation (implementation guidance for 1E)

Prefer wrapping existing pure helpers:

- `courtBookingEngine.checkBookingConflict`
- `courtBookingEngine.doTimesOverlap`
- `courtBookingEngine.validateCourtForBooking`
- `clubStorage.loadCourtsForClub` / `loadBookingsForClub`
- `courtManagementSettings.loadCourtManagementSettings`

Do **not** duplicate conflict algorithms.

---

## Consumers (allowed)

- Booking UI / `bookingService` (progressive adoption)
- Competition court adapter (Phase 1F)
- Court Engine assignment guard (progressive)
- External API (optional later)

## Non-consumers (must not bypass)

- Direct `club_data_v3` JSON parsing inside Competition
- AI store as availability source

---

## Related documents

- `PHASE_1A_STATUS_MAPPING.md`
- `PHASE_1A_FACADE_DESIGN.md`
- `PHASE_1A_QA_MATRIX.md`
- `PHASE_1_IMPLEMENTATION_TASKS.md` (Phase 1E)

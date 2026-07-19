# Phase 2C — Tournament Booking Bridge Hardening

**Status:** Implemented on `feature/venue-court-phase-2c-booking-bridge`  
**Date:** 2026-07-18  
**Depends on:** Phase 1 (availability SSOT), Phase 2B (Competition availability wiring)

---

## 1. Ownership

| Concern | Owner |
| ------- | ----- |
| Tournament `courtSchedule` metadata | Competition / Tournament (`tournamentService`) |
| Canonical booking writes | Venue & Court substrate via `bookingService` |
| Bridge orchestration | `domain/tournamentBookingService.js` |

Competition/Tournament **must not** write `club_data_v3.bookings[]` directly.
The bridge cancels/upserts only through `bookingService` (`createBooking` / `saveBooking` / `updateBookingStatus`).

---

## 2. Identity model

A tournament-owned calendar row is identified by:

```text
bookingType === "tournament"
AND tournamentId === <tournament.id>
AND id === tournament-booking-{tournamentId}-{courtId}-{date}
```

Do not rely on display names (`customerName` / `note`).

Time-window changes keep the same id (in-place update). Date changes mint a new id; obsolete owned rows are cancelled by ownership scan.

---

## 3. Synchronization lifecycle

```text
UI / API
  → setTournamentCourtSchedule(clubId, tournamentId, scheduleInput)
  → normalizeCourtSchedule
  → syncTournamentCourtBookings (validate-first)
  → on success only: persist tournament.courtSchedule
```

Clear path:

```text
clearTournamentCourtSchedule
  → cancelTournamentCourtBookings (owned only)
  → courtSchedule = null
```

Also cancelled on `cancelTournament` / `purgeOpenTournaments`.

---

## 4. Idempotency rule

Repeated identical sync:

- upserts the same deterministic ids
- creates **0** new rows
- updates existing owned rows
- does not duplicate

Adding a court → create only missing ids.  
Removing a court → cancel only obsolete owned ids.  
Changing time → update owned rows in place.

---

## 5. Cancellation rule

`cancelTournamentCourtBookings` / clear path remove **only**:

- `bookingType: "tournament"`
- matching `tournamentId`
- active (non-cancelled / non-completed) statuses

Preserved: user/single bookings, maintenance, other tournaments’ bookings.

---

## 6. Failure behavior

| Case | Behavior |
| ---- | -------- |
| Missing schedule | `SCHEDULE_MISSING` — no writes |
| Conflict with foreign booking | `BOOKING_CONFLICT` — **fail-closed**, no writes, `courtSchedule` not persisted |
| Unexpected upsert/cancel mid-flight | `PARTIAL_FAILURE` + `recovery` hints |
| Data load failure | `DATA_UNAVAILABLE` |

Validate the full desired set against non-owned bookings **before** any destructive change.

After successful sync, reload club blob before saving tournament metadata so booking writes are not clobbered by a stale `saveClubData`.

---

## 7. Availability consistency

After successful sync, `getCourtAvailability` / `getCompetitionCourtAvailability` see tournament bookings as blockers (`TOURNAMENT_BOOKING_CONFLICT`).

After cancel/clear, availability restores unless another blocking booking remains.

Civil time only: `YYYY-MM-DD` + `HH:mm` (Phase 2E owns UTC/local cleanup).

---

## 8. Phase 2C exclusions

- Court Engine (2D)
- Full UTC/local time model cleanup (2E)
- Multi-venue runtime (2F)
- SQL / schema / shared occupancy bus
- Competition schedule algorithm rewrites

# Phase 2D — Court Engine Availability Guard

**Status:** Implemented on `feature/venue-court-phase-2d-court-engine-guard`  
**Date:** 2026-07-18  
**Depends on:** Phase 1E (availability SSOT), Phase 2B (Competition guard pattern)

---

## 1. Ownership boundary

| Concern | Owner |
| ------- | ----- |
| Court inventory, operating hours, bookings, maintenance, master status, canonical availability | Venue & Court |
| Social-play queue, assignment generation, session `courtStates`, timers, transfers, session lifecycle | Court Engine |

Integration is an **adapter/guard only**. No shared occupancy bus. No merge of CE session state with Venue & Court booking state.

---

## 2. Availability guard call flow

```text
UI (useCourtEngine)
  → resolve local civil window (YYYY-MM-DD + HH:mm)
  → previewAutoAssign / confirmAutoAssign / performTransfer
       → generateCourtAssignments / confirmAssignments / transferAssignment
            → validateCourtsForCourtEngine (courtEngineAvailabilityGuard)
                 → getCourtAvailability (venue-court public API)
```

Court Engine **must not** import:

- `bookingService` / `loadBookingsForClub`
- `courtManagementSettings`
- Venue & Court internal repositories

---

## 3. Required runtime context

Every production check requires explicit:

- `clubId`
- `date` (`YYYY-MM-DD`)
- `startTime` / `endTime` (`HH:mm`, same-day, end > start)
- candidate `courtIds` where applicable

No first-club fallback. No silent “guess now” when a window was omitted or invalid (REQUIRED mode).

UI derives the civil window via `buildLocalCivilWindow(defaultMatchMinutes)` using **local** `Date` getters (not UTC `toISOString` slice).

---

## 4. Fail-closed policy

Default mode: **REQUIRED**.

| Condition | Behavior |
| --------- | -------- |
| Missing `clubId` | `CLUB_REQUIRED` — reject |
| Missing/invalid civil window | `INVALID_TIME_WINDOW` — reject |
| Venue & Court load failure | `DATA_UNAVAILABLE` — reject |
| Court unavailable | mapped reason — reject (confirm/transfer) or filter (preview) |
| `legacyAvailability: true` | skip Venue & Court — **tests / non-production only** |

No silent fallback to Court Engine–only availability on wired production paths.

---

## 5. Preview vs confirmation

- **Preview** may filter out canonically unavailable courts and still propose assignments on remaining courts.
- **Confirmation always re-checks** Venue & Court for the full intended court set before mutating session state.
- Do not trust a cached preview result across operations (new checker/cache per validate call; confirm creates a fresh call).

Protects against bookings/maintenance/locks appearing after preview.

---

## 6. Transfer behavior

1. Validate destination court through Venue & Court **before** mutating source.
2. Then apply Court Engine session rules (busy / locked / maintenance / active assignment).
3. On failure: return `{ ok: false, code, error, session }` with **source assignment unchanged**.

---

## 7. Batch behavior

For multi-court confirmation:

1. Enforce Court Engine session rules for every court.
2. Validate the **full** courtId set through Venue & Court (including duplicate rejection).
3. Mutate only if the entire set passes.
4. One unavailable court → whole confirmation fails (no partial CE state write).

---

## 8. Cache-key design

Per-operation cache key includes:

- `clubId`, `venueId`, `date`, `startTime`, `endTime`
- candidate `courtIds`
- `clusterId`
- `excludeBookingId` (when present)

Do not reuse availability across independent confirmation operations.

---

## 9. Reason-code mapping

Venue & Court reasons map to Court Engine–facing codes (not a merged status enum):

| Venue & Court | Court Engine |
| ------------- | ------------ |
| `BOOKING_CONFLICT` | `BOOKING_CONFLICT` |
| `TOURNAMENT_BOOKING_CONFLICT` | `TOURNAMENT_BOOKING_CONFLICT` |
| `MAINTENANCE_BOOKING` / `COURT_MAINTENANCE` | `MAINTENANCE` |
| `OUTSIDE_VENUE_HOURS` | `OUTSIDE_OPERATING_HOURS` |
| `COURT_LOCKED` | `COURT_LOCKED` |
| `COURT_INACTIVE` | `COURT_INACTIVE` |
| `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` |
| `CLUB_SCOPE_MISSING` | `CLUB_REQUIRED` |
| `INVALID_TIME_RANGE` | `INVALID_TIME_WINDOW` |

Session-only codes (CE rules): `SESSION_COURT_BUSY`, plus CE lock/maintenance checks before the Venue & Court gate.

---

## 10. Exclusions from Phase 2D

- No booking writes from Court Engine
- No tournament `courtSchedule` writes
- No UTC/local cleanup (Phase 2E)
- No multi-venue expansion (Phase 2F)
- No rewrite of assignment algorithms beyond input filtering / pre-mutation guards
- No shared occupancy bus / state-model merge

---

## 11. Key files

| File | Role |
| ---- | ---- |
| `src/features/court-engine/services/courtEngineAvailabilityGuard.js` | Thin CE ↔ Venue & Court adapter |
| `src/features/court-engine/engines/autoCourtAssignmentEngine.js` | Preview filter + confirm re-check |
| `src/features/court-engine/services/courtTransferService.js` | Destination validate-before-mutate |
| `src/features/court-engine/services/courtEngineService.js` | Pass availability options |
| `src/features/court-engine/hooks/useCourtEngine.js` | Wire clubId + civil window |
| `tests/venue-court-phase-2d-court-engine-guard.test.js` | Focused Phase 2D suite |

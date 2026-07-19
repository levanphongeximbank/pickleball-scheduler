# Phase 2E — Runtime Time Model Cleanup

**Status:** Remediation in progress on `feature/venue-court-phase-2e-time-model-cleanup`  
**Date:** 2026-07-19  
**Depends on:** Phase 1E, 2B, 2C, 2D

---

## 1. Canonical time model

| Kind | Shape | Meaning |
| ---- | ----- | ------- |
| Venue-local civil date | `YYYY-MM-DD` | Calendar date in the **venue IANA timezone** |
| Venue-local civil time | `HH:mm` | Clock time on that civil date (00:00–23:59) |
| Venue-local window | `{ date, startTime, endTime }` | Same-day interval, `endTime > startTime` |
| Absolute timestamp | ISO-8601 with offset or `Z` | Instant |

**Rules**

1. Civil-input helpers never use `Date` timezone getters for venue decisions.
2. Absolute→civil helpers **require** an explicit IANA timezone; missing → `TIMEZONE_REQUIRED`.
3. Never use browser/server local timezone as a venue timezone fallback.
4. Never use `toISOString().slice(0, 10)` for venue-local “today”.
5. `getBrowserDisplayCivilDate` is **display-only**, not for booking/automation.

Shared implementation: `src/domain/civilTime.js` (re-exported from venue-court).

---

## 2. Timezone source

| Priority | Source |
| -------- | ------ |
| 1 | Explicit `options.timezone` / context timezone |
| 2 | `venue.timezone` via `club.venueId` (`resolveVenueTimezoneForClub`) |
| — | Browser/server local — **forbidden** for venue decisions |

If the club has no linked venue, or the venue has no IANA timezone: **fail closed** with `TIMEZONE_REQUIRED`.

**Note:** `normalizeVenue` / `normalizeClub` may still persist a historical product default (`Asia/Ho_Chi_Minh` from `DEFAULT_TIMEZONE`) onto new records. Runtime conversion does **not** invent that default when the venue link/timezone is missing — it fails.

---

## 3. Overnight / DST

- **Overnight:** reject (`endTime <= startTime` or duration past midnight).
- **DST:** conversion uses `Intl` IANA; gaps/non-convergent local times → `AMBIGUOUS_LOCAL_TIME` from `civilDateTimeToUtcMs`.

---

## 4. Error codes

`INVALID_DATE` | `INVALID_TIME` | `INVALID_TIME_WINDOW` | `TIMEZONE_REQUIRED` | `AMBIGUOUS_LOCAL_TIME` | `DATA_UNAVAILABLE`

---

## 5. Scope

In scope: civil helpers, booking automation, court booking “now” queries, CE civil window, Tournament ISO↔civil boundary, docs/tests.

Out of scope: Production deploy, SQL, multi-venue runtime, assignment algorithm redesign, Phase 2F.

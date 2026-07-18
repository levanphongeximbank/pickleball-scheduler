# Phase 1C — Operating Hours Consolidation

**Status:** Committed — `733e814`
**Date:** 2026-07-18
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Goal

```text
VenueHoursPage
    ↓
venueOperatingHoursService
    ↓
courtManagement.openHour / closeHour
```

---

## Legacy data findings (from pre-1C `VenueHoursPage`)

Inspected source at Phase 1A commit / pre-edit page.

| # | Finding | Evidence |
| - | ------- | -------- |
| 1 | Weekday rows are **variable** (0–N). User adds rows via “Thêm khung”; not required to fill all 7 days. Duplicate days possible. | `handleAdd` appends rows; no uniqueness check |
| 2 | Weekday ids: string `"0"`–`"6"` | `DAY_LABELS = ["CN","T2",…,"T7"]`; `<option value={String(index)}>` |
| 3 | **Different days may have different hours** | Each row has own `openTime` / `closeTime` |
| 4 | Minutes other than `00` **supported in UI** (free text, no validation) | TextField without format/minute constraint |
| 5 | Closed day: **omit** that `dayOfWeek` (no explicit closed flag) | No closed state in model |
| 6 | Malformed JSON → `[]` (silent) | `readHours` catch returns `[]` |
| 7 | Multiple venue keys: yes — `pickleball-venue-hours-v1::{tenantId}` per tenant | `STORAGE_KEY::${tenantId}` |
| 8 | `tenantId` = `useTenant().currentTenantId` (venue) | page only used TenantContext |
| 9 | Active club: **not used** by legacy page | No `useClub` |
| 10 | Phase 1C verifies club via `loadClubs()` → `club.venueId === venueId` | `resolveOperatingHoursScope` |

Row shape:

```javascript
{
  id: "hours-<timestamp>",
  dayOfWeek: "0" | "1" | ... | "6",
  openTime: "HH:mm",  // free text
  closeTime: "HH:mm",
  label: string
}
```

---

## SSOT

```text
club_data_v3.data.courtManagement.openHour   (integer 0–23)
club_data_v3.data.courtManagement.closeHour  (integer 1–24)
```

Defaults: `0` / `24`. Overnight not supported.

---

## Scope mapping

| Input | Source |
| ----- | ------ |
| venueId / tenantId | `TenantContext.currentTenantId` |
| clubId | `ClubContext.activeClubId` |
| Ownership check | `loadClubs()` → require `club.venueId === venueId` |

Failure reasons: `VENUE_SCOPE_MISSING`, `CLUB_SCOPE_MISSING`, `CLUB_VENUE_MISMATCH`.

---

## Safe legacy import eligibility (all required)

1. venueId present
2. active clubId present
3. club belongs to venue
4. CM hours exactly defaults `0` / `24`
5. no `legacyVenueHoursImportedAt`
6. legacy JSON exists and parses to an array
7. **all seven** days `"0"`–`"6"` present exactly once
8. every day same `openTime`
9. every day same `closeTime`
10. all times minute `00`
11. resulting integers satisfy `openHour < closeHour`

On success: write CM once, set marker, **no** legacy write/delete.

On any failure: **no** CM change, **no** marker, return `legacyImport: { status: "not_imported", reason }`.

---

## Reason codes

```text
LEGACY_DATA_INVALID
LEGACY_DAILY_HOURS_DIFFER
LEGACY_MINUTE_PRECISION_UNSUPPORTED
LEGACY_CLOSED_DAY_UNSUPPORTED
VENUE_SCOPE_MISSING
CLUB_SCOPE_MISSING
CLUB_VENUE_MISMATCH
LEGACY_ALREADY_IMPORTED
COURT_MANAGEMENT_ALREADY_CONFIGURED
NO_LEGACY_DATA
```

---

## UI

* Single “Mọi ngày” window (CM capability).
* Non-destructive warning when unsafe legacy cannot import.
* No “import successful” toast for auto-import.
* Explicit Save required to change CM hours.
* Failed import still shows current CM hours when scope is valid.

---

## Files

* `src/features/venue-court/services/venueOperatingHoursService.js`
* `src/features/venue-court/index.js`, `README.md`
* `src/domain/courtManagementSettings.js`
* `src/pages/admin/VenueHoursPage.jsx`
* `tests/venue-court/operating-hours-service.test.js`
* `docs/venue-court/PHASE_1C_OPERATING_HOURS.md`

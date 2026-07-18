# Phase 1A — Venue & Court Facade Design

**Status:** Planned module layout — **do not create `src/features/venue-court/` in Phase 1A**  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`  
**Implementation target:** Phase 1B+

---

## Planned directory

```text
src/features/venue-court/
├── index.js
├── services/
│   ├── courtInventoryService.js
│   ├── courtAvailabilityService.js
│   └── venueOperatingHoursService.js
├── adapters/
│   ├── competitionCourtAdapter.js
│   ├── courtEngineStatusAdapter.js
│   └── legacyClubCourtAdapter.js
├── contracts/
│   ├── courtAvailabilityContract.js
│   └── courtStatusContract.js
└── README.md
```

This is a **design sketch**. Phase 1A creates documentation only.

---

## Design principles

1. **Wrap / delegate** — do not duplicate `courtService`, `bookingService`, `courtBookingEngine`, `tournamentBookingService`.
2. **No new storage keys** for inventory or bookings.
3. **No behavior change** in Phase 1B (re-export / thin wrap only).
4. **Fail closed** for availability (Phase 1E).
5. **Adapters are read-only bridges** for other modules.

---

## `index.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Public barrel export for Venue & Court facade |
| Side effects | None |
| Allowed callers | App features that need inventory / availability / hours |
| Forbidden | Becoming a dumping ground for Competition match APIs |

---

## Services

### `courtInventoryService.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Stable read API for court master inventory |
| Input | `{ venueId?, clubId?, clusterId?, tenantId?, includeInactive? }` |
| Output | Normalized court list (`models/court.normalizeCourt`) |
| Data source | Club V3 `data.courts[]` via **delegate** to `clubStorage` / `courtService` |
| Side effects | **None** (Phase 1); writes stay in existing CM UI / bookingService |
| Allowed callers | Court Engine (list), Competition adapter, API handlers, CM progressive migration |
| Forbidden callers | Must not be used to invent a second cache SSOT |
| Legacy wrap | Re-export / thin wrap: `loadCourtsForClub`, `loadCourtsForVenue`, `loadCourtsForVenueScoped`, `loadCourtsForClubScoped` |

**Must not duplicate:** `courtService.js` logic — call it.

---

### `courtAvailabilityService.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Implement `getCourtAvailability` read-only contract |
| Input | See `PHASE_1A_AVAILABILITY_CONTRACT.md` |
| Output | `{ available, courtId, checkedRange, conflicts, reasons, source }` |
| Data source | Inventory + bookings + `courtManagementSettings`; optional runtime via adapter |
| Side effects | **None** |
| Allowed callers | Booking flows, Competition adapter, Court Engine guards, tests |
| Forbidden callers | Writers that expect mutation |
| Legacy wrap | Delegate conflict math to `courtBookingEngine.checkBookingConflict` / `doTimesOverlap` / `validateCourtForBooking`; load via `clubStorage` |

**Must not duplicate:** `bookingService` write paths or a second conflict engine.

---

### `venueOperatingHoursService.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Single read (and later write) API for operational hours |
| Input | `{ clubId }` and/or `{ venueId / tenantId }` depending on consolidation stage |
| Output | Normalized open/close window for a date or weekday |
| Data source (Phase 1 temporary) | **SSOT for ops:** `courtManagement.openHour/closeHour`; Phase 1C migrates `VenueHoursPage` onto this service |
| Side effects | Phase 1B: none; Phase 1C: may write CM settings and/or keep backward-compatible read of orphan key |
| Allowed callers | Availability service, booking UI, VenueHoursPage (after 1C) |
| Forbidden | Creating `pickleball-venue-hours-v2` or third store |
| Legacy wrap | `loadCourtManagementSettings` / `saveCourtManagementSettings`; optional adapter read of `pickleball-venue-hours-v1` for compatibility |

---

## Adapters

### `competitionCourtAdapter.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Let Competition ask inventory + availability without touching Club V3 shape |
| Input | Competition-scoped query (`clubId`, `courtId`, range, `competitionId`, `matchId`) |
| Output | Court list slice + availability result + status mapping hints |
| Data source | Facade services only |
| Side effects | **None** — must not set `match.courtId` |
| Allowed callers | Competition scheduling / assignment **after** Phase 1F wiring |
| Forbidden | Direct `loadClubData` / blob field access |
| Legacy wrap | May temporarily call inventory/availability services that delegate to clubStorage |

---

### `courtEngineStatusAdapter.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Combine master status + Court Engine runtime into `canAssignNew` without unifying enums |
| Input | `{ courtId, clubId, runtimeStatus?, masterCourt? }` |
| Output | `{ masterStatus, runtimeStatus, canAssignNew, reasons[] }` |
| Data source | Master via inventory service; runtime passed in or read via CE public API if already exposed |
| Side effects | **None** — no master writes |
| Allowed callers | Court Engine guards, availability optional runtime step |
| Forbidden | Writing `COURT_RUNTIME_STATUS` into `courts[].status` |

---

### `legacyClubCourtAdapter.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Isolate Club V3 blob access shape (`courts[]`, `bookings[]`, `courtManagement`) behind one adapter |
| Input | `clubId`, operation name |
| Output | Normalized domain objects |
| Data source | `clubStorage` |
| Side effects | Only if explicitly calling save helpers — prefer read-only in facade path |
| Allowed callers | Facade services only |
| Forbidden | Competition / AI / external features importing this adapter directly long-term |
| Legacy wrap | Thin pass-through to `loadCourtsForClub`, `loadBookingsForClub`, settings loaders |

---

## Contracts

### `courtAvailabilityContract.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Types/constants: conflict codes, context enums, result shape helpers |
| Side effects | None |
| Notes | May be JSDoc typedefs + exported constants in JS codebase |

### `courtStatusContract.js`

| Item | Detail |
| ---- | ------ |
| Responsibility | Document master vs runtime vocabularies; precedence helpers (pure) |
| Side effects | None |
| Notes | Implements mapping rules from `PHASE_1A_STATUS_MAPPING.md` without a mega-enum |

---

## `README.md` (planned)

Should state:

- Module ownership summary
- SSOT pointers
- “Do not add second inventory”
- Links to `docs/venue-court/*`
- Which legacy modules are wrapped

---

## Explicit non-goals for the facade

Do **not** re-implement or fork:

| Legacy module | Facade stance |
| ------------- | ------------- |
| `courtService` | Wrap / re-export |
| `bookingService` | Keep as write SSOT; availability may call its loaders/engine, not replace CRUD |
| `courtBookingEngine` | Pure engine — call it |
| `tournamentBookingService` | Keep as tournament↔booking bridge; facade may re-export for discoverability later |

---

## Suggested Phase rollout mapping

| Phase | Facade work |
| ----- | ----------- |
| 1B | Create folder; `index.js`; inventory service wrap; tests (behavior parity) |
| 1C | `venueOperatingHoursService` consolidation |
| 1D | API `courtsHandler` → inventory service |
| 1E | `courtAvailabilityService` + contract constants |
| 1F | `competitionCourtAdapter` wiring (Competition calls adapter only) |

---

## Related documents

- `PHASE_1A_MODULE_BOUNDARY.md`
- `PHASE_1A_SSOT_DECISION.md`
- `PHASE_1A_AVAILABILITY_CONTRACT.md`
- `PHASE_1_IMPLEMENTATION_TASKS.md`

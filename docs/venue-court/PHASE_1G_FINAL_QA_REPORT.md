# Phase 1G — Final QA Report

**Status:** Committed — Phase 1G documentation
**Date:** 2026-07-18
**Branch:** `feature/venue-court-phase-1-foundation`
**HEAD at QA:** `7ce80ff24f357ac3d01998378acdf5f58478f3c3`

---

## 1. Branch and commit range

| Item | Value |
| ---- | ----- |
| Branch | `feature/venue-court-phase-1-foundation` |
| Working tree at QA start | Clean |
| Range | `e3b691c^..7ce80ff` |

### Commit sequence (verified)

```text
e3b691c docs(venue-court): define phase 1 foundation architecture
73e3738 feat(venue-court): add phase 1b court inventory facade
733e814 feat(venue-court): consolidate operating hours source
e39fbfc fix(venue-court): source courts API from canonical inventory
23363b1 feat(venue-court): add canonical court availability contract
7ce80ff feat(venue-court): add competition availability adapter
```

### Changed-file range summary

28 files in range: Phase 1 docs, `src/features/venue-court/**`, `courtsHandler.js`, `VenueHoursPage.jsx`, `courtManagementSettings.js` (Phase 1C helpers), and `tests/venue-court/**`.

**Unrelated changes in range:** none found.

Expected Phase 1C/1D touchpoints (hours UI + settings + Courts API) are intentional and Owner-approved in earlier phases.

---

## 2. Architecture verification

### Dependency direction (verified)

```text
/api/v1/courts (courtsHandler)
    → listCourts (venue-court public facade)
    → courtInventoryService
    → legacy courtService / Club V3 SSOT

Competition-facing adapter (unwired)
    → getCompetitionCourtAvailability
    → getCourtAvailability
    → inventory + bookings + operating hours
```

### Forbidden reverse imports

Venue & Court JS modules do **not** import:

- `competition-core`
- `tournament-engine`
- `court-engine` (features)
- AI / `loadAIData`
- page components

### Circular dependency

None introduced. Facade → domain loaders only; Competition does not import Venue & Court at runtime yet.

---

## 3. SSOT verification

| Concern | Canonical source | Access path |
| ------- | ---------------- | ----------- |
| Court inventory | `club_data_v3.data.courts[]` | `courtInventoryService` → `courtService` / `clubStorage` |
| Bookings | `club_data_v3.data.bookings[]` | availability reads via `loadBookingsForClub` |
| Operating hours | `courtManagement.openHour` / `closeHour` | `venueOperatingHoursService` / settings |
| Maintenance | master `status: maintenance` + `bookingType: "maintenance"` | evaluated in `courtAvailabilityService` |

### Legacy hours key

`pickleball-venue-hours-v1::{tenantId}` is **not** used by inventory, availability, Competition adapter, or Courts API.

Phase 1C `venueOperatingHoursService` retains an **Owner-approved**, eligibility-gated one-time read for optional import into CM hours. Availability path does not read this key.

### Courts API vs AI

`courtsHandler` imports `listCourts` from venue-court. **No** `loadAIData` usage in the handler.

---

## 4. Public API verification

Exports from `src/features/venue-court/index.js`:

| Export | Role |
| ------ | ---- |
| `listCourts` | Inventory list |
| `getCourtById` | Inventory get |
| `getVenueOperatingHours` | Hours read (+ gated legacy import path) |
| `updateVenueOperatingHours` | Hours write to CM SSOT |
| `shouldWarnLegacyImport` | UI helper |
| `legacyImportUserMessage` | UI helper |
| `LEGACY_IMPORT_REASON` | Constants |
| `getCourtAvailability` | Canonical availability |
| `AVAILABILITY_REASON` | Reason codes |
| `getCompetitionCourtAvailability` | Competition adapter |

Consumers can use the public facade; internal service files are not required imports for approved callers.

---

## 5. Scope / security verification

| Rule | Verified behavior |
| ---- | ----------------- |
| Explicit `clubId` for availability | Required; missing → `CLUB_SCOPE_MISSING` |
| Courts API multi-club without `clubId` | **400** `CLUB_REQUIRED` (no first-club pick) |
| Unauthorized club | **403** |
| Single allowed club, missing `clubId` | Uses that one club |
| Zero allowed clubs | Secure empty list |
| Venue mismatch | `VENUE_MISMATCH` / fail closed |
| Unknown court IDs | `COURT_NOT_FOUND`; no foreign court payload leak |
| Empty valid inventory | Success with empty list / empty courts |
| Data load failure | Surfaced (`DATA_UNAVAILABLE` / server error) — not converted to “all free” |

---

## 6. Test commands and results

| Command | Result | Passed | Failed |
| ------- | ------ | ------ | ------ |
| `node --test tests/venue-court/court-inventory-service.test.js` | Pass | 12 | 0 |
| `node --test tests/venue-court/court-availability-service.test.js` | Pass | 35 | 0 |
| `node --test tests/venue-court/competition-court-availability-adapter.test.js` | Pass | 20 | 0 |
| `node --test tests/venue-court/courts-api-handler.test.js` | Pass | 11 | 0 |
| `node --test tests/venue-court/operating-hours-service.test.js` | Pass | 17 | 0 |
| `node --test tests/court-service.test.js` | Pass | 4 | 0 |
| `node --test tests/court-booking.test.js` | Pass | 40 | 0 |
| `node --test tests/court-cluster.test.js` | Pass | 25 | 0 |
| `node --test tests/tournament-booking.test.js` | Pass | 4 | 0 |
| `npm run test:unit` | Pass | **2729** | **0** |

---

## 7. Lint result

| Check | Result |
| ----- | ------ |
| ESLint on Phase 1 venue-court + related files | **0 errors** |
| `npm run lint:no-new` | **OK** (0 new violations vs baseline) |

---

## 8. Build result

| Check | Result | Classification |
| ----- | ------ | -------------- |
| `npm run build` | **PASS** (`EXIT_BUILD=0`) | Phase 1 compatible |

Chunk-size PWA warnings only; not treated as Phase 1 failures.

---

## 9. Static dependency verification

| Scan | Result |
| ---- | ------ |
| Forbidden runtime deps in `src/features/venue-court/**/*.js` | **None** (`competition-core` / `tournament-engine` / `court-engine` / `loadAIData` / `src/ai`) |
| Persistence in availability + Competition adapter | **None** |
| Direct storage in availability + adapter | **None** |
| Legacy hours localStorage | **Only** in `venueOperatingHoursService` (approved 1C path) |

---

## 10. Compatibility verification

Unchanged by Phase 1 design/intent:

- Court Engine runtime
- Tournament / Competition scheduling algorithms
- Match assignment / `match.courtId` writers
- Booking create/cancel paths (except Courts API inventory source + hours UI consolidation)
- Club V3 storage format
- SQL schema / Supabase RLS
- Production deployment

**Competition adapter remains unwired** — no Competition/Tournament runtime import of `getCompetitionCourtAvailability`.

---

## 11. Known limitations

1. Competition runtime does not yet call the availability adapter.
2. No Court Engine runtime occupancy (`RUNTIME_OCCUPIED`) in availability.
3. No ISO timestamp inputs on availability (venue-local `date` + `HH:mm` only).
4. Overnight / cross-day windows rejected.
5. Legacy hours key may still exist in browsers until separate cleanup authorization.
6. Phase 1A docs still name planned `competitionCourtAdapter.js`; implemented file is `competitionCourtAvailabilityAdapter.js` (documented in 1F).
7. Multi-venue batch availability not supported (single `clubId` per call).

---

## 12. Remaining risks

| Risk | Level | Mitigation |
| ---- | ----- | ---------- |
| Callers still using old inventory paths outside facade | Low | Courts API corrected; progressive migration |
| Future Competition wiring mistakes timezone/ISO conversion | Medium | Documented; require Owner-reviewed call sites |
| Dual hours key confusion for operators | Low | 1C eligibility gate + UI warning |
| Unwired adapter unused until integration | Low | Intentional Phase 1 boundary |

---

## 13. Final QA verdict

**PASS** — Phase 1 architecture, SSOT, APIs, tests, lint, and build are release-ready for Owner push/PR decision.

Competition adapter is validated but **not** runtime-wired (by design).

---

## Documentation note (Phase 1G)

Status headers on Phase 1B–1F docs were corrected from “awaiting commit” to committed SHAs. No runtime source or test files were modified in Phase 1G.

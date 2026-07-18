# Phase 1 — Implementation Task Breakdown

**Status:** Planned after Phase 1A Owner review  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`  
**Note:** Phase 1A is documentation only. Tasks below are **not** started.

---

## Phase 1B — Facade Foundation

### Mục tiêu

Create `src/features/venue-court/` as a thin wrap/re-export layer over existing court inventory loaders. **No behavior change.**

### File dự kiến sửa / tạo

- `src/features/venue-court/index.js` (new)
- `src/features/venue-court/services/courtInventoryService.js` (new)
- `src/features/venue-court/adapters/legacyClubCourtAdapter.js` (new)
- `src/features/venue-court/README.md` (new)
- Unit tests under existing test layout (new)

### File cấm sửa

- `src/features/court-engine/**`
- `src/features/competition-core/**`
- `src/features/tournament-engine/**`
- `src/tournament/engines/**`
- `src/ai/**`
- `src/pages/courtManagement/**`
- `src/domain/bookingService.js` (no rewrite)
- `src/domain/clubStorage.js` (no schema change)

### Test bắt buộc

- Inventory service returns same courts as `courtService` / `loadCourtsForClub` for fixture clubs
- Inactive / tenant filter parity
- No write side effects

### Rủi ro

**LOW** — additive module

### Điều kiện hoàn tất

- Facade exports documented
- Parity tests green
- No new storage keys

### Điều kiện STOP

- Any need to change Club V3 shape
- Any Competition/CE code change required to “make facade work”

### Song song với Competition Engine?

**Yes** — additive only; no shared file edits expected

---

## Phase 1C — Operating Hours Consolidation

### Mục tiêu

Establish one operational hours service. Point `VenueHoursPage` at the same service Booking uses (`courtManagement` hours), with backward compatibility for `pickleball-venue-hours-v1`.

### File dự kiến sửa

- `src/features/venue-court/services/venueOperatingHoursService.js` (new)
- `src/pages/admin/VenueHoursPage.jsx`
- Possibly `src/domain/courtManagementSettings.js` (thin helpers only)

### File cấm sửa

- Court Engine / Competition / AI / Court Management calendar rewrite
- New localStorage inventory keys
- Third hours store

### Test bắt buộc

- Read CM hours for club
- VenueHoursPage save updates shared service path
- Legacy orphan key still readable (compat) or migrated once with documented rule
- Booking slot builder still uses same open/close integers

### Rủi ro

**MEDIUM** — admin hours may diverge historically from CM; migration must not wipe CM hours silently

### Điều kiện hoàn tất

- Single service is documented SSOT for ops hours
- No new blob/key for hours
- Booking calendar unchanged unless intentionally aligned

### Điều kiện STOP

- Requires Club V3 migration or SQL
- Breaks peak/slot settings

### Song song với Competition Engine?

**Yes** — hours UI is Venue & Court only

---

## Phase 1D — Courts API Source Correction

### Mục tiêu

`courtsHandler` reads courts via facade / Club V3 inventory — **not** `loadAIData().courts`.

### File dự kiến sửa

- `src/features/api/router/handlers/courtsHandler.js`
- Possibly facade inventory import only

### File cấm sửa

- `src/ai/storage.js` shape (do not shove courts into AI view as “fix”)
- Competition / CE / CM UI

### Test bắt buộc

- API returns courts present in Club V3 fixture
- Empty club → empty list (not AI pollution)
- Scope/clubId resolution unchanged
- Consumer smoke: anything calling GET `/courts`

### Rủi ro

**MEDIUM** — external API consumers may have adapted to empty lists; returning real courts changes observed data (correct but breaking for empty-assumption clients)

### Điều kiện hoàn tất

- Handler does not import `loadAIData` for inventory
- Documented consumer check completed

### Điều kiện STOP

- Unknown Production API consumers without changelog/Owner approval

### Song song với Competition Engine?

**Yes** — API surface only

---

## Phase 1E — Availability Contract Implementation

### Mục tiêu

Implement read-only `getCourtAvailability` per `PHASE_1A_AVAILABILITY_CONTRACT.md`.

### File dự kiến sửa / tạo

- `src/features/venue-court/services/courtAvailabilityService.js`
- `src/features/venue-court/contracts/courtAvailabilityContract.js`
- `src/features/venue-court/adapters/courtEngineStatusAdapter.js` (optional runtime step)
- Unit tests for conflict codes / fail-closed

### File cấm sửa

- Schedule engines
- Court assignment algorithms
- `match.courtId` writers
- Court Management UI redesign

### Test bắt buộc

- Master locked / maintenance
- Booking overlap vs touching boundary
- Tournament booking conflict
- Maintenance booking
- Outside hours
- DATA_UNAVAILABLE fail-closed
- Scenarios from `PHASE_1A_QA_MATRIX.md` (unit-level)

### Rủi ro

**MEDIUM** — incorrect conflict semantics could block bookings if wired early; keep **read-only** and opt-in callers first

### Điều kiện hoàn tất

- Contract codes match docs
- Fail-closed proven in tests
- No writes

### Điều kiện STOP

- Pressure to change `doTimesOverlap` semantics without Owner approval
- Requirement to read CE store for all contexts before adapter ready

### Song song với Competition Engine?

**Yes** — until Competition imports it (then coordinate 1F)

---

## Phase 1F — Competition Adapter

### Mục tiêu

Competition consumes availability/inventory **only** through `competitionCourtAdapter`. No direct Club V3 reads. **No** change to `match.courtId` semantics or assignment algorithm rewrite.

### File dự kiến sửa

- `src/features/venue-court/adapters/competitionCourtAdapter.js` (new)
- **Minimal** Competition call-site wiring only if Owner approves specific import points

### File cấm sửa

- `src/features/tournament-engine/engines/courtAssignmentEngine.js` algorithm
- `src/tournament/engines/courtEngine.js` rewrite
- `src/features/competition-core/scheduling/calculateCanonicalSchedule.js` rewrite
- Match lifecycle / publication

### Test bắt buộc

- Adapter returns availability without Competition touching blob
- Assignment algorithm golden outputs unchanged when fed same court list
- Two matches same court same time still detected by Competition’s own validator (unchanged)

### Rủi ro

**HIGH** if assignment files are edited; **MEDIUM** if adapter-only + shadow compare

### Điều kiện hoàn tất

- Documented call path: Competition → adapter → facade
- No `match.courtId` behavior change
- No schedule rewrite

### Điều kiện STOP

- Any rewrite of assignment/schedule required to “integrate”
- Need to copy courts into Competition store

### Song song với Competition Engine?

**No (coordinate)** — shared touch risk on Competition import sites. Adapter file itself can be built in parallel; wiring must be sequenced.

---

## Phase 1G — QA and Production Verification

### Mục tiêu

Prove Phase 1B–1F safe for Preview then Production smoke; document rollback.

### File dự kiến sửa

- Docs / checklists only preferred
- Test files as needed

### File cấm sửa

- Production schema
- Migrations
- Unrelated features

### Test bắt buộc

- Unit suite for facade + availability
- Integration: booking conflict + API courts
- Feature flag matrix: `VITE_COURT_CLUSTERS_ENABLED` on/off; Court Engine local vs Supabase
- Preview QA
- Production smoke (read-only paths first)
- Rollback instructions (revert facade wiring / feature flags)

### Rủi ro

**MEDIUM** overall; **HIGH** if 1F wired without shadow period

### Điều kiện hoàn tất

- QA matrix executed and signed
- Rollback doc present
- Owner Go/No-Go

### Điều kiện STOP

- Fail-open observed in Production smoke
- Inventory/API mismatch unresolved

### Song song với Competition Engine?

**Coordinate** — shared Preview/Production windows

---

## Parallel work summary

| Phase | Parallel with Competition Engine? | Conflict-prone files |
| ----- | --------------------------------: | -------------------- |
| 1B | Yes | None expected |
| 1C | Yes | `VenueHoursPage`, CM settings |
| 1D | Yes | `courtsHandler.js` |
| 1E | Yes (build); coordinate if CE also adopts | facade availability files |
| 1F | **No — sequence** | Competition import sites; **never** co-edit assignment engines |
| 1G | Coordinate | Release notes / flags |

### Absolutely do not edit concurrently

```text
src/features/tournament-engine/engines/**
src/tournament/engines/**
src/features/competition-core/scheduling/**
src/features/court-engine/engines/**
src/ai/**
```

---

## Out of scope (all Phase 1)

```text
public.courts migration
public.bookings migration
Club V3 data migration
Court Management UI redesign
Court Engine rewrite
Competition court assignment rewrite
Schedule Engine rewrite
AI pairing rewrite
Unified runtime state machine
Maintenance work-order
Production deployment (beyond smoke)
```

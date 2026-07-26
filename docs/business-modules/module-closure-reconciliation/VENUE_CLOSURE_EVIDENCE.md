# Venue Management — Closure Evidence

**Module:** Venue Management  
**Classification:** `FULLY_COMPLETED_CLOSED`  
**Gap type:** evidence gap closed by BM-FINAL-GAPS-02 (no active implementation gap)

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Canonical source | `src/features/venue-court/` |
| Public facade | `src/features/venue-court/index.js` |
| Ownership | Court inventory, operating hours, availability, canonical descriptors |
| Explicit non-ownership | Court Engine runtime/session/queue; Competition assignment; AI scheduling |
| Runtime composition | Services → club blob (`club_data_v3`) courts/bookings/hours |
| Persistence authority | Club blob courts[] / bookings[] / courtManagement hours (optional court.priority) |
| Authorization boundary | `venueCourtScopeService.js` — club/venue scope fail-closed |
| Platform Core | `src/features/venue-court/platform/` |
| External ports | Competition availability + descriptor adapters (read/consume) |

## Merge evidence (representative)

Phase lineage includes PRs #52, #55, #58, #60, #67, #73, #159 (descriptors + priority).

## Tests (targeted)

Locked in `scripts/ci/unit-test-files.json`:

- `tests/venue-court/court-inventory-service.test.js`
- `tests/venue-court/operating-hours-service.test.js`
- `tests/venue-court/court-availability-service.test.js`
- `tests/venue-court/courts-api-handler.test.js`
- `tests/venue-court/competition-court-availability-adapter.test.js`
- `tests/venue-court-phase-2b-competition-wiring.test.js`
- `tests/venue-court-phase-2d-court-engine-guard.test.js`

## localStorage / mock

Inventory SSOT is club blob, not a localStorage mock. Legacy hours helper may touch LS only as compatibility — not canonical inventory authority.

## Deferred Production gates (registered)

- Venue Production schema/SQL rollout (if/when separated from club blob) — `VENUE_PRODUCTION_SCHEMA_ROLLOUT`
- Covered also by cross-cutting `DEPLOYMENT_MIGRATION_APPLICATION` / `UI_PRODUCT_EXPANSION` where applicable

## Verdict

Owner-locked Venue inventory/hours/availability/descriptor scope is implemented on `main`.  
Missing item before this pack was consolidated BM-final closure evidence — closed here.  
No domain source change required.

# Phase 1B — Minimal Facade Foundation

**Status:** Implemented (source uncommitted — awaiting Owner review)  
**Date:** 2026-07-18  
**Depends on:** Phase 1A commit `docs(venue-court): define phase 1 foundation architecture`

## Delivered

* `src/features/venue-court/index.js`
* `src/features/venue-court/services/courtInventoryService.js`
* `src/features/venue-court/README.md`
* `tests/venue-court/court-inventory-service.test.js`

## Public API

* `listCourts({ clubId, venueId, tenantId, clusterId, includeInactive })`
* `getCourtById(courtId, options)`

## Out of scope (unchanged)

* Availability
* Operating hours consolidation
* Competition / Court Engine / AI wiring
* API `/courts` handler
* Existing domain services

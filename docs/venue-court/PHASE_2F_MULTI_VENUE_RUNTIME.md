# Phase 2F — Multi-venue Runtime Readiness

**Status:** Implemented on `feature/venue-court-phase-2f-multi-venue-runtime`  
**Date:** 2026-07-19  
**Base:** `main` @ `2713c59` (PR #67 Phase 2E)  
**Depends on:** Phase 1E–1G, 2A–2E

---

## 1. Objective

Make Venue & Court, Competition, and Court Engine runtime **safe under multi-venue / multi-club scope**.

Contracts:

1. No silent first-club fallback when more than one club is visible/available.
2. No wrong-club or foreign-court leakage into club-keyed engines.
3. Venue switcher (`venueSession`) is a **UI context pointer**, not automatic engine ownership.
4. Court Engine sessions remain scoped to `(tenantId, clubId)` and **club inventory only**.
5. `clusterId` is a **filter only**, never an ownership boundary.
6. Phase 2E IANA timezone + civil-time rules remain authoritative per venue via `resolveVenueTimezoneForClub`.

---

## 2. Scope ownership matrix

| Concern | Owner | Phase 2F rule |
| ------- | ----- | ------------- |
| Court inventory / bookings / hours / availability | Venue & Court | Require explicit `clubId`; optional `venueId\|tenantId` must match `club.venueId` |
| Club / tenant active selection (shell) | ClubContext / TenantContext | Auto-select only when **exactly one** club; otherwise clear / require explicit pick |
| Venue switcher UI | `venueSession` + VenueSwitcher | Must **not** alone drive CE/TE inventory; engines follow tenant+club |
| Court Engine session storage | Court Engine | Key `::{tenantId}::{clubId}`; courts loaded = **club inventory only** |
| Court Engine lock / maintenance / referee | Court Engine | Court must belong to session `clubId` inventory (fail-closed) |
| Competition / Tournament availability | Competition + VC adapter | Explicit `clubId` + civil window; no first-club guess |
| Cluster facility filter | Court Cluster / tenantGuard | Optional filter; empty `clusterId` = pass-all; never grants ownership |
| Timezone | Venue record via club link | Phase 2E fail-closed `TIMEZONE_REQUIRED` |

---

## 3. Caller matrix (audit → Phase 2F action)

| Area | Finding | 2F action |
| ---- | ------- | --------- |
| `getCourtAvailability` / competition adapter | Already require `clubId`; venue mismatch fails | Keep; covered by tests |
| `useCourtEngine` courts | Venue-scoped roles used `loadCourtsForVenueScoped` → foreign courts in club session | **Fix:** always `loadCourtsForClubScoped(activeClubId)` |
| CE lock / maintenance / referee | Mutated any courtId present in UI list | **Fix:** `assertCourtOwnedByClub` before mutate |
| `resolveActiveClubSelection` | Stale preferred → `visibleClubs[0]` | **Fix:** only unique single club; else clear |
| ClubContext tenant sync | Active not in tenant → `tenantClubs[0]` | **Fix:** single-club only; else clear |
| ClubContext legacy validation | Falls back to `visibleClubs[0]` | **Fix:** prefer `user.clubId` if visible; else single club; else clear |
| `getPrimaryClubIdForTenant` | Always `clubs[0]` | **Fix:** return id only when `clubs.length === 1` |
| `tournamentEngine.wrapEngineRun` | `options.clubId \|\| getActiveClubId()` | **Fix:** `options.clubId \|\| context.clubId` only (no active fallback) |
| `venueSession` vs TenantContext | Desynced UI pointer | **Document / defer unify** (excluded from minimum code cut) |
| `filterByTenant` allows unstamped | Soft leak when combined with venue union | Mitigated by removing CE venue-union load |
| Shared occupancy bus / SQL / algorithm rewrite | Out of Phase 2 | Excluded |

---

## 4. Fail-closed rules

| Condition | Behavior | Code |
| --------- | -------- | ---- |
| Missing `clubId` on availability / CE guard | Reject | `CLUB_SCOPE_MISSING` / `CLUB_REQUIRED` |
| `venueId` provided but `club.venueId` mismatch | Reject | `VENUE_MISMATCH` |
| Court id not in club inventory | Reject mutate / unavailable | `COURT_OUT_OF_SCOPE` / `COURT_NOT_FOUND` |
| Multi-club tenant, no preferred/active in set | Do **not** pick first; clear / null | — |
| Exactly one visible club | Deterministic select that club | OK (not first-of-many) |
| Missing venue timezone for venue “now” | Reject | `TIMEZONE_REQUIRED` (Phase 2E) |
| `clusterId` filter alone | Never elevates ownership | Filter only |

---

## 5. Explicitly excluded

- Production deploy
- SQL / schema / `public.courts` / `public.bookings` migration
- Shared occupancy bus / CE↔booking state merge
- Assignment algorithm rewrite
- Status enum unification / AI lock unification
- Overnight booking windows
- Full `venueSession` ↔ `TenantContext` unification (documented debt)
- Unrelated Competition Engine Phase 3 work

---

## 6. Implementation plan (minimum)

1. Add `venueCourtScopeService` — shared assert helpers + exports.
2. Harden club primary / active selection (single-club only).
3. Harden CE court list + court mutation ownership.
4. Harden tournament orchestrator log clubId resolution.
5. Docs + README phase status.
6. Deterministic Phase 2F tests.

---

## 7. Test plan / completion gates

Focused suite: `tests/venue-court/phase-2f-multi-venue-runtime.test.js`

Must cover:

- venue/club mismatch fails closed
- missing scope does not select first club
- foreign courts cannot leak across clubs/venues
- cluster filter does not grant ownership
- CE session cannot load courts from wrong scope
- venue-specific timezone remains correct

Gates: Phase 2F suite + existing venue-court / CE / tournament booking-availability + `npm run test:unit` + foundation/architecture locks + `lint:no-new` + `npm run build`.

---

## 8. Key files

| File | Role |
| ---- | ---- |
| `src/features/venue-court/services/venueCourtScopeService.js` | Scope asserts |
| `src/features/venue-court/index.js` | Public exports |
| `src/features/court-engine/hooks/useCourtEngine.js` | Club-only court list |
| `src/features/court-engine/services/courtEngineService.js` | Ownership before lock/maintenance/referee |
| `src/features/club/context/clubCanonicalReadModel.js` | No first-of-many selection |
| `src/context/ClubContext.jsx` | Fail-closed multi-club sync |
| `src/features/tenant/services/tenantService.js` | Primary club = unique only |
| `src/features/tournament-engine/orchestrator/tournamentEngine.js` | No `getActiveClubId` fallback |
| `docs/venue-court/PHASE_2F_MULTI_VENUE_RUNTIME.md` | This design lock |
| `tests/venue-court/phase-2f-multi-venue-runtime.test.js` | Focused suite |

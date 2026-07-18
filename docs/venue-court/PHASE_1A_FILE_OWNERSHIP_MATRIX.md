# Phase 1A — File Ownership Matrix

**Status:** Phase 1A ownership & touch policy  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

## Risk legend

| Label | Meaning |
| ----- | ------- |
| `SAFE` | Documentation or new facade files with no Production behavior change expected |
| `CONTROLLED` | May change in a later Phase 1 task with tests and Owner gate |
| `RESTRICTED` | Shared substrate; change only with explicit task + regression suite |
| `DO_NOT_TOUCH` | Forbidden in Phase 1A; later phases need separate approval |

Phase 1A itself: **docs only** — no `src/` edits.

---

## Matrix

| File hoặc thư mục | Owner module | Phase 1 được sửa? | Module khác được gọi? | Rủi ro Production |
| ----------------- | ------------ | ----------------: | --------------------: | ----------------- |
| `docs/venue-court/**` | Venue & Court | Yes (1A) | Read by all teams | `SAFE` |
| `src/features/venue-court/**` (planned) | Venue & Court | 1B+ create only | Competition/CE via adapters | `SAFE` → `CONTROLLED` |
| `src/models/court.js` | Venue & Court | Prefer no; only if contract needs export | Many | `RESTRICTED` |
| `src/models/booking.js` | Venue & Court | Prefer no | Booking/CM | `RESTRICTED` |
| `src/models/venue.js` | Venue & Court | Prefer no | Tenant/venue | `RESTRICTED` |
| `src/models/courtCluster.js` | Venue & Court / Cluster | Prefer no | Cluster feature | `RESTRICTED` |
| `src/domain/clubStorage.js` | Shared substrate | Avoid in Phase 1 | Wide | `RESTRICTED` |
| `src/domain/courtService.js` | Venue & Court | Wrap in 1B; edit only if needed | CE, governance | `CONTROLLED` |
| `src/domain/bookingService.js` | Venue & Court | Avoid rewrite; may call availability later | CM UI, bridges | `RESTRICTED` |
| `src/domain/courtBookingEngine.js` | Venue & Court | Prefer no; reuse as pure engine | CM, booking | `RESTRICTED` |
| `src/domain/courtManagementSettings.js` | Venue & Court | Possible 1C hours | CM UI | `CONTROLLED` |
| `src/domain/venueService.js` | Venue & Court | Prefer no | Onboarding, guards | `RESTRICTED` |
| `src/domain/tournamentBookingService.js` | Bridge (VC ↔ Competition) | Prefer no behavior change | `tournamentService` | `RESTRICTED` |
| `src/data/venue.js` | Venue & Court | Prefer no | venueService | `RESTRICTED` |
| `src/data/courtCluster.js` | Court Cluster | Prefer no | cluster services | `RESTRICTED` |
| `src/data/venueSession.js` | Venue & Court | Prefer no | switcher UI | `SAFE` |
| `src/pages/admin/VenueHoursPage.jsx` | Venue & Court admin | Yes in **1C** only | Router | `CONTROLLED` |
| `src/features/api/router/handlers/courtsHandler.js` | API / Venue & Court | Yes in **1D** | apiRouter | `CONTROLLED` |
| `src/features/court-cluster/**` | Court Cluster | Prefer no in Phase 1 | Venue shell | `RESTRICTED` |
| `src/features/court-engine/**` | Court Engine | **No** (default) | — | `DO_NOT_TOUCH` |
| `src/features/competition-core/**` | Competition | **No** (default); 1F adapter call sites only with Owner | — | `DO_NOT_TOUCH` |
| `src/features/competition-core/scheduling/**` | Competition scheduling | **No** rewrite | — | `DO_NOT_TOUCH` |
| `src/features/tournament-engine/**` | Tournament engine | **No** | — | `DO_NOT_TOUCH` |
| `src/features/tournament-engine/engines/**` | Tournament engines | **No** | — | `DO_NOT_TOUCH` |
| `src/tournament/engines/**` | Legacy tournament | **No** | — | `DO_NOT_TOUCH` |
| `src/tournament/engines/courtEngine.js` | Director runtime | **No** | — | `DO_NOT_TOUCH` |
| `src/ai/**` | AI | **No** | — | `DO_NOT_TOUCH` |
| `src/pages/courtManagement/**` | Court Management UI | **No** rewrite | — | `DO_NOT_TOUCH` |
| `src/pages/Courts.jsx` / `courts.logic.js` | Court inventory UI | Prefer no; plan limits stay | Subscription | `RESTRICTED` |
| `src/auth/subscriptionGuard.js` | Subscription | Prefer no (`maxCourts`) | Courts create | `RESTRICTED` |

---

## Default DO_NOT_TOUCH (Phase 1A)

```text
src/features/tournament-engine/**
src/tournament/engines/**
src/features/competition-core/**
src/features/court-engine/**
src/ai/**
src/pages/courtManagement/**
```

### Proposed later-phase exceptions (not approved for 1A)

| Exception | Earliest phase | Condition |
| --------- | -------------- | --------- |
| Competition imports `competitionCourtAdapter` | 1F | Adapter only; no assignment algorithm change |
| Court Engine uses availability/status adapter | After 1E | Guard-only; no CE rewrite |
| CM UI calls availability service | After 1E | Progressive; keep bookingService writes |

---

## Audit existence checklist (Phase 1A)

| Path | Exists | Role summary |
| ---- | :----: | ------------ |
| `src/models/court.js` | Yes | Court master normalize / bookable |
| `src/models/venue.js` | Yes | Venue tenant normalize |
| `src/models/booking.js` | Yes | Booking normalize / types |
| `src/models/courtCluster.js` | Yes | Cluster normalize |
| `src/domain/clubStorage.js` | Yes | Club V3 blob SSOT R/W |
| `src/domain/courtService.js` | Yes | Venue/club court reads |
| `src/domain/bookingService.js` | Yes | Booking CRUD + court ops status |
| `src/domain/courtBookingEngine.js` | Yes | Pure conflict/pricing/slots |
| `src/domain/courtManagementSettings.js` | Yes | Ops hours/slots settings |
| `src/domain/venueService.js` | Yes | Venue lifecycle |
| `src/domain/tournamentBookingService.js` | Yes | Tournament → bookings bridge |
| `src/data/venue.js` | Yes | Venue LS persistence |
| `src/data/courtCluster.js` | Yes | Cluster LS persistence |
| `src/data/venueSession.js` | Yes | Active venue pointer |
| `src/pages/admin/VenueHoursPage.jsx` | Yes | Orphan venue hours UI |
| `src/features/api/.../courtsHandler.js` | Yes | API GET /courts (AI store bug) |
| `src/features/court-engine/**` | Yes | Runtime CE |
| `src/features/court-cluster/**` | Yes | Physical clusters |
| `src/features/competition-core/scheduling/**` | Yes | Canonical scheduling (shadow) |
| `src/features/tournament-engine/engines/**` | Yes | TE engines incl. court assignment |
| `src/tournament/engines/courtEngine.js` | Yes | Director court runtime |

---

## Related documents

- `PHASE_1A_MODULE_BOUNDARY.md`
- `PHASE_1_IMPLEMENTATION_TASKS.md`

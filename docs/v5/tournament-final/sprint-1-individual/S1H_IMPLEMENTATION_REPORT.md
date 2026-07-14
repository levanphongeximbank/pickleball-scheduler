# S1-H — Player Portal + UX Polish + Final QA

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-H  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-091, 092, 093, 094** and deliver player portal, notifications, UX polish, and Sprint 1 final QA evidence.

---

## Deliverables

| Area | Fix |
|------|-----|
| **Player portal** | `/tournament/my` (+ `/:tournamentId`) — dashboard, upcoming, standing, bracket, schedule, awards, history |
| **Notifications** | Derived feed: match assigned, schedule changed, walkover, result published, tournament completed |
| **Public page** | `/tournament/:tournamentId/public` read-only standings/podium |
| **UX states** | `TournamentUiState` empty / loading / error + a11y roles |
| **Standings labels** | "VĐV / Cặp" (S1-GAP-094) |
| **Polling** | 20s refresh on portal (soft realtime fallback) |
| **Optimistic version** | `settings.portalVersion` conflict guard on notification writes |

---

## Routes

| Path | Page |
|------|------|
| `/tournament/my` | Player portal home |
| `/tournament/my/:tournamentId` | Player portal for one event |
| `/tournament/:tournamentId/public` | Public spectator |

Menu: in-page **Cổng VĐV (Individual)** under roster hub.

---

## Files (primary)

| File | Change |
|------|--------|
| `engines/playerPortalEngine.js` | **NEW** |
| `engines/playerNotificationEngine.js` | **NEW** |
| `IndividualPlayerPortalPage.jsx` | **NEW** |
| `IndividualTournamentPublicPage.jsx` | **NEW** |
| `IndividualPlayerPortalPanel.jsx` | **NEW** |
| `TournamentUiState.jsx` | **NEW** |
| `BracketGroupStandingsPanel.jsx` | VĐV labels |
| `tournamentRoutes.js` / `router.jsx` / nav | Wire routes |
| `tests/individual-tournament-player-portal.test.js` | **NEW** T-S1-H01–H05 |

## Untouched

- S1-A…S1-G engine sources (S1-H only imports)
- Team tournament / Rating V5
- Deploy / merge

---

## Automated tests

```bash
# S1-A…H + engine + regression + v5-menu-audit
# 86/86 PASS
```

---

## Owner review gate

**Verdict requested:** Approve S1-H → Sprint 1 Individual complete (staging pilot), or request changes.

**Next:** Staging smoke M1–M26 from test plan · NO production deploy.

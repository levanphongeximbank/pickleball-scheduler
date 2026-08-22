# Legacy referee retirement — follow-up (not this phase)

Still present, not deleted in Phase 2C:

- `/referee/:token` → `RefereeScoreboard`
- `src/pages/referee/RefereeV5TeamMatchPage.jsx` (unrouted)
- `src/pages/referee/RefereeSessionScoreboard.jsx`
- `listRefereeAssignments` fuzzy identity in `refereeSessionService.js`
- Referee V5 workspace / prototype fixtures (not used by canonical routes)

Do not remove until a dedicated retirement PR with regression coverage.

Canonical `/referee` and `/referee/match/:matchId` must not silently fall back to those surfaces.

# E2E-03 — Legacy Organizer Reuse Map

| Component | Path | Classification | Notes |
|-----------|------|----------------|-------|
| TournamentDirectorMode | `src/features/tournament/director/` | REUSE_WITH_ADAPTER | Real ops UI; not yet CM/Core wired |
| RegistrationOpsPanel | `src/components/tournament/RegistrationOpsPanel.jsx` | REUSE_WITH_ADAPTER | Registration window/lock UX |
| DrawPublishControls | `src/components/tournament/DrawPublishControls.jsx` | REUSE_AS_IS (UI) | Parent owns mutations |
| ScheduleBuilderPanel | `src/components/tournament/ScheduleBuilderPanel.jsx` | REUSE_WITH_ADAPTER | Legacy publishScheduleEngine |
| TournamentCourtSchedulePanel | `src/components/tournament/TournamentCourtSchedulePanel.jsx` | HARDEN | Venue booking dual-write risk |
| MatchListPanel | `src/components/tournament/MatchListPanel.jsx` | REUSE_AS_IS | Presentational |
| CheckInDashboardPage | `src/pages/mobile/CheckInDashboardPage.jsx` | HARDEN | Mobile QR; player path → E2E-04 |
| TournamentPublishSchedulePage | `src/pages/tournament/TournamentPublishSchedulePage.jsx` | REUSE_WITH_ADAPTER | Legacy schedule publish |
| TournamentHome / Hubs | `src/pages/tournament/**` | REUSE_WITH_ADAPTER | Shell/nav; no global router change in E2E-03 |
| tournamentDirectorEngine | `src/tournament/engines/tournamentDirectorEngine.js` | REUSE_WITH_ADAPTER | Not Core match SoT |
| checkInService (mobile) | `src/features/mobile/services/checkInService.js` | HARDEN | No open/close competition window |
| checkInService (court-engine) | `src/features/court-engine/services/checkInService.js` | OUT_OF_SCOPE / DUPLICATE | Daily court domain |
| publishScheduleEngine | `src/tournament/engines/publishScheduleEngine.js` | REUSE_WITH_ADAPTER | Interim SoT until CM-06 cutover |
| tournamentClosingEngine | `src/features/individual-tournament/engines/tournamentClosingEngine.js` | REUSE_WITH_ADAPTER | Not CM-08 archive |
| tournamentService | `src/domain/tournamentService.js` | HARDEN | Club-blob SoT |

## E2E-03 choice

- **Owned:** `competition-engine/operations` facade + projection + Organizer check-in window.
- **Presentation:** view-model only (`presentation/organizerOperationsViewModel.js`); no global router/shell/provider edits.
- Legacy UI remains available for future adapter wiring; E2E-03 does not treat legacy engines as competition SoT.

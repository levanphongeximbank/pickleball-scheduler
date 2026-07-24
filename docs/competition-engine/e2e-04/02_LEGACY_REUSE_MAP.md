# E2E-04 — Legacy Player / Referee Reuse Map

| Asset | Path | Classification | E2E-04 use |
|-------|------|----------------|------------|
| IndividualPlayerPortalPage | `src/pages/tournament/IndividualPlayerPortalPage.jsx` | REUSE_WITH_ADAPTER | Future wire to `buildPlayerPortalSections`; not redesigned |
| IndividualPlayerPortalPanel | `src/components/tournament/IndividualPlayerPortalPanel.jsx` | REUSE_WITH_ADAPTER | Section host |
| PlayerSchedulePanel | `src/components/tournament/PlayerSchedulePanel.jsx` | REUSE_WITH_ADAPTER | Bind schedule projection |
| PlayerLiveResultsPanel | (legacy tournament components) | HARDEN | Prefer validated-only results |
| PlayerFinalResultsPanel | (legacy tournament components) | REUSE_WITH_ADAPTER | Final publication projection |
| playerPortalEngine | `src/features/individual-tournament/engines/playerPortalEngine.js` | LEGACY_MOCK / HARDEN | Do not own; facade is SoT for ops |
| RefereeHub / referee session routes | identity + pages/referee | REUSE_WITH_ADAPTER | Queue from referee facade |
| RefereeScoreboard / referee-v5 | `src/features/referee-v5/**` | REUSE_WITH_ADAPTER | Scoring UI may call CORE-16 via facade |
| TournamentRefereeAssignPage | tournament pages | OUT_OF_SCOPE (organizer) | Assignment created upstream; E2E-04 consumes |
| refereeSessionService | `src/features/identity/services/refereeSessionService.js` | REUSE_AS_IS | Auth session helper |
| checkInService | `src/features/court-engine/services/checkInService.js` | OUT_OF_SCOPE / DUPLICATE | Player check-in uses E2E-03 window + E2E-04 mark |
| matchLiveSync | mobile/live sync | OUT_OF_SCOPE | Not Public Experience; no E2E-05 |
| resultCorrectionEngine | legacy | REUSE_WITH_ADAPTER | Correction flow via CORE-17 handoff |
| CORE-13 Referee Assignment | `competition-core/referee-assignment` | REUSE_AS_IS | Plan handoff into ops store |
| CORE-15 Matches | `competition-core/matches` | REUSE_AS_IS | Lifecycle transitions |
| CORE-16 Scoring | `competition-core/scoring` | REUSE_AS_IS | Session + projection |
| CORE-17 Result Validation | `competition-core/result-validation` | REUSE_AS_IS | Validate / accept |

## Public export map

| Export | Module |
|--------|--------|
| `createPlayerCompetitionOperationsFacade` | `operations/player` |
| `createRefereeCompetitionOperationsFacade` | `operations/referee` |
| `buildPlayerOperationsProjection` | `operations/player` |
| `buildRefereeOperationsProjection` | `operations/referee` |
| `buildPlayerPortalSections` | `presentation/player` |
| `buildRefereePortalSections` | `presentation/referee` |

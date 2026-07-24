# E2E-04 — Player / Referee Contracts

## Player facade

`createPlayerCompetitionOperationsFacade(deps?)`

| Method | Action | Notes |
|--------|--------|-------|
| `getPlayerCompetitionState` | `player.operations.read` | Full projection |
| `getPlayerSchedule` | `player.schedule.read` | Own rows only |
| `getPlayerCheckInState` | `player.operations.read` | Window + mark |
| `checkInPlayer` | `player.checkin.self` | Idempotent mark on organizer store |
| `getPlayerMatchState` | `player.match.read` | Own matches |
| `getPlayerStandingsState` | `player.standings.read` | Certified handoff only |
| `getPlayerQualificationState` | `player.qualification.read` | Certified handoff only |
| `getPlayerKnockoutState` | `player.knockout.read` | Certified handoff only |
| `getPlayerFinalResultState` | `player.final_result.read` | Publication-aware |

### Rules

- Explicit `actor` + `tenantId` + `competitionId`
- Canonical player mapping required; reject mismatched `playerId`
- Never trust client `grantedPermissions`
- Does not mutate caller input
- Does not compute schedule/standings/winners

## Referee facade

`createRefereeCompetitionOperationsFacade(deps?)`

| Method | Action |
|--------|--------|
| `getRefereeAssignmentQueue` | `referee.assignment.read` |
| `getAssignedMatch` | `referee.assignment.read` |
| `acknowledgeAssignment` | `referee.assignment.acknowledge` |
| `openAssignedMatch` | `referee.match.open` |
| `suspendAssignedMatch` | `referee.match.suspend` |
| `resumeAssignedMatch` | `referee.match.resume` |
| `createScoreEntrySession` | `referee.score.session` |
| `submitScoreProjection` | `referee.score.submit` |
| `submitMatchResultForValidation` | `referee.result.submit` |
| `getCorrectionRequiredState` | `referee.result.read` |
| `resubmitCorrectedResult` | `referee.result.correct` |
| `getValidatedResultState` | `referee.result.read` |

### Rules

- Assignment scope required for match control
- Score entry requires `IN_PROGRESS`
- Result validation only after complete CORE-16 projection
- Standings eligibility only when acceptance status is accepted
- Facade never infers winners for UI/standings

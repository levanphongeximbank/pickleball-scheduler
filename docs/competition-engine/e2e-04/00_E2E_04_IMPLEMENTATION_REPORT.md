# E2E-04 — Implementation Report

## Goal

Player & Referee Operations MVP for Individual Pool + Knockout, reusing E2E-01/02/03 and Core engines without parallel scoring/lifecycle/assignment/standings.

## Delivered

### Player Operations (`operations/player/`)

- `createPlayerCompetitionOperationsFacade`
- Reads: competition state, schedule, check-in, match, standings, qualification, knockout, final result
- Command: `checkInPlayer` (idempotent; E2E-03 window compatible)
- Ownership via E2E-01 participant lookup + entry ownership
- Fail-closed typed `PlayerOperationsError`
- Deterministic `projectionFingerprint`

### Referee Operations (`operations/referee/`)

- `createRefereeCompetitionOperationsFacade`
- Assignment queue / acknowledge / open / suspend / resume
- Score entry session + score projection (CORE-16)
- Result validation handoff + optional accept (CORE-17)
- Correction-required gate + validated result visibility
- Assignment scope enforcement (CORE-13 handoff records)
- Lifecycle via CORE-15 `applyMatchTransition`

### Presentation

- `buildPlayerPortalSections` — 7 MVP sections
- `buildRefereePortalSections` — 6 MVP sections
- No global router/shell redesign

## Canonical reuse

| Capability | Source |
|------------|--------|
| Identity / authorize | E2E-01 `createCompetitionRuntimePorts` |
| Player mapping | E2E-01 `participantLookupPort` |
| Check-in window | E2E-03 organizer store `CHECKIN_STATE` |
| Referee assignment | CORE-13 plan handoff into ops store |
| Match lifecycle | CORE-15 |
| Scoring | CORE-16 |
| Result validation | CORE-17 |
| Standings | Projection handoff only (accepted results) |

## Non-goals kept

- No parallel engines
- No direct Supabase in application boundary
- No E2E-05 Public Experience edits
- No package/lockfile changes

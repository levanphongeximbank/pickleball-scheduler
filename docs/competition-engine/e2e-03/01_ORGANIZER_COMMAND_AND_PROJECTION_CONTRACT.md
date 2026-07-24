# E2E-03 — Organizer Command and Projection Contract

## Application facade

`createOrganizerOperationsFacade(deps?)` — `src/features/competition-engine/operations/`

| Command | Action ID | Capability (logical) | Canonical reuse |
|---------|-----------|----------------------|-----------------|
| `getOrganizerCompetitionOperationsState` | `organizer.operations.read` | `competition.operations.read` | projection only |
| `getOrganizerReadiness` | same | same | projection only |
| `prepareCompetitionOperations` | `organizer.operations.prepare` | ops read/prepare | ops store |
| `lockParticipantField` | `organizer.participants.lock` | `competition.participants.lock` | entry status aggregate (no new registration engine) |
| `preparePoolStage` | `organizer.draw.prepare` | `competition.draw.prepare` | E2E-02 `createPoolKnockoutRuntimeComposition` |
| `prepareOperationalSchedule` | `organizer.schedule.prepare` | `competition.schedule.prepare` | CORE-11 `calculateCanonicalSchedule` or certified handoff |
| `confirmCourtAssignments` | `organizer.courts.confirm` | `competition.courts.confirm` | CORE-12 `assignCourtsDeterministic` or confirmed handoff |
| `publishOperationalPlan` | `organizer.publish` | `competition.publish` | CM-06 readiness optional + ops publication state |
| `openCheckIn` / `closeCheckIn` | `organizer.checkin.manage` | `competition.checkin.manage` | Organizer check-in window boundary |
| `openMatchOperations` | `organizer.matches.control` | `competition.matches.control` | ops control only (no scoring) |
| `suspendMatchOperations` / `resumeMatchOperations` | same | same | CORE-15-compatible control states |
| `activateKnockoutStage` | `organizer.knockout.activate` | `competition.knockout.activate` | E2E-02 composition with qualification inputs |
| `completeCompetitionOperations` | `organizer.complete` | `competition.complete` | active/incomplete match gates |
| `publishFinalCompetitionResult` | `organizer.publish` | `competition.publish` | requires completion |
| `requestArchiveReadiness` | `organizer.archive.prepare` | `competition.archive.prepare` | CM-08 eligibility optional; **no** direct `archiveCompetition` |

### Command rules

- Explicit `actor` + `tenantId` + `competitionId` (+ `venueId` when required).
- Authorize via E2E-01 `authorize` / `authorizeCompetitionAction` with Identity permission strings.
- Fail-closed typed `OrganizerOperationsError`.
- Does not mutate caller input.
- Deterministic command `fingerprint` for equal inputs/results.
- No UI dependency; no direct Supabase.

## Operational projection

`buildOrganizerOperationsProjection({ record, grantedPermissions })`

Aggregates readiness only — does **not** compute standings, schedule, eligibility, or brackets.

Includes:

- competition / tenant / venue identity
- template / format versions
- lifecycle + publication state
- participant field + eligibility summary
- pool / schedule / court / referee / check-in / live ops readiness
- standings / qualification / knockout / completion / archive readiness
- blocking issues
- allowed / denied organizer actions + reason codes
- `projectionFingerprint`

## Portal view-model

`buildOrganizerPortalSections(projection)` — 10 Organizer Portal MVP sections (presentation only).

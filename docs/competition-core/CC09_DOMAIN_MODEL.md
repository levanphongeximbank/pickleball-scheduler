# CC-09 — Scheduling Domain Model

Source: `src/features/competition-core/scheduling/schedulingTypes.js`, `schedulingContracts.js`

## Core contracts

| Type | Purpose |
|---|---|
| `SchedulingRequest` | Normalized input: tournamentId, strategy, participants, matches, courts, slots, configuration, manualOverrides, legacyExtensions |
| `SchedulingConfiguration` | strategy, timezone, match/buffer/rest minutes, start/end |
| `SchedulingParticipant` | participantId, teamId, name, seed, withdrawn |
| `SchedulingMatch` | matchId, roundNumber, entryAId, entryBId, isBye, pendingDependency |
| `SchedulingRound` | roundId, roundNumber, groupId, matchIds |
| `SchedulingSlot` | slotId, startTime, endTime, timezone |
| `SchedulingCourt` | courtId, venueId, available, locked |
| `SchedulingVenue` | venueId, timezone |
| `SchedulingAssignment` | matchId, roundId, courtId, venueId, startTime, endTime, slotId, refereeId, status, warnings, manualOverride, source |
| `SchedulingResult` | ok, rounds, matches, assignments, unassignedMatches, byes, conflicts, decisionTrace |
| `SchedulingConflict` | type, severity, matchIds, participantIds, courtIds, slotIds, message, reasonCode |
| `SchedulingOverride` | overrideId, matchId, field, beforeValue, afterValue, reason, actor, timestamp, locked |
| `SchedulingDecisionTrace` | traceId, engineVersion, strategy, assignmentSteps, conflicts, parityStatus |
| `SchedulingSnapshot` | request + result envelope for audit |
| `SchedulingAudit` | engineVersion, consumer, executionPath |

## Factory helpers

All objects created via `createScheduling*` in `schedulingContracts.js` — defaults applied, optional fields omitted when unsupported by schedule type.

Engine version: `cc09-v1` (`SCHEDULING_ENGINE_VERSION`).

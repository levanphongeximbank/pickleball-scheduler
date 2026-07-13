# CC-09 — Conflict Model

Source: `schedulingConstants.js` (`CONFLICT_TYPE`, `CONFLICT_SEVERITY`), `validateSchedulingConflicts.js`

## Conflict record shape

```javascript
{
  type,           // CONFLICT_TYPE.*
  severity,       // HARD | SOFT | INFO
  matchIds,
  participantIds,
  courtIds,
  slotIds,
  message,
  reasonCode,
  suggestedResolution,
  metadata
}
```

## Hard conflicts (reject assignment)

- `DUPLICATE_MATCH_ASSIGNMENT`
- `UNKNOWN_PARTICIPANT`
- `INVALID_BYE_ASSIGNMENT`
- `PLAYER_TIME_CONFLICT`
- `COURT_TIME_CONFLICT`

## Soft conflicts (warnings / score only)

- `UNASSIGNED_MATCH` — no court/slot/time or status UNASSIGNED
- `REFEREE_TIME_CONFLICT`
- `MANUAL_OVERRIDE_CONFLICT`
- `INSUFFICIENT_REST`, `VENUE_*`, `INVALID_ROUND_ORDER` (modeled, partial detection)

## Helpers

- `isByeParticipant(id)` — `__BYE__`
- `isPendingDependencyParticipant(id)` — `__PENDING_WINNER__`, `__PENDING_LOSER__`, `TBD*`
- `partitionResolvedConflicts(conflicts)` — splits hard vs resolved soft

# CC-09 — BYE and Dependency Policy

## BYE

- Participant id: `__BYE__` (`BYE_PARTICIPANT_ID`)
- BYE matches must **not** consume court or slot (`INVALID_BYE_ASSIGNMENT` if violated)
- Assignment status: `ASSIGNMENT_STATUS.BYE`
- Automatic advancement / unassigned opponent: preserved in match metadata, not rewritten

## Pending dependencies

Prefixes: `__PENDING_WINNER__`, `__PENDING_LOSER__`, `TBD`, `PENDING`

- Mapped with `pendingDependency: true`
- **Not** treated as `UNKNOWN_PARTICIPANT`
- Warning: `"Match {id} has pending bracket dependency"`

## Withdrawn / forfeit / cancelled

| Case | Handling |
|---|---|
| withdrawn participant | `SchedulingParticipant.withdrawn` preserved |
| forfeit advancement | match status preserved in legacy output |
| cancelled/void match | excluded from UNASSIGNED when status CANCELLED |

## Policy

CC-09 normalizes and validates; does not alter legacy advancement logic.

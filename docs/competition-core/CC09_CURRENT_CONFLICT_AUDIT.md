# CC-09 — Current Conflict Audit

## Legacy conflict detection (pre-CC-09)

| Location | Conflict types detected | Hard/soft | Notes |
|---|---|---|---|
| TE `generateSchedule` | participant double-book at slot | soft (skip slot) | greedy retry loop |
| TE `validateScheduleInput` | no matches, locked courts, missing startTime | hard | blocks schedule |
| Tournament fixtures | odd team count → bye rotation | implicit | not named conflict |
| Director court engine | court already occupied | hard | runtime only |
| Team tournament publish | lineup lock / roster | hard | separate from fixture gen |
| Manual UI | overlapping edits | user-visible | not centralized |

## Canonical conflict model (CC-09)

Implemented in `validateSchedulingConflicts.js`:

| Type | Severity | Legacy equivalent |
|---|---|---|
| PLAYER_TIME_CONFLICT | HARD | TE participantBusyAt |
| TEAM_TIME_CONFLICT | HARD | TT scheduledAt overlap (future) |
| COURT_TIME_CONFLICT | HARD | TE court slot collision |
| VENUE_TIME_CONFLICT | SOFT | not fully wired |
| REFEREE_TIME_CONFLICT | SOFT | optional refereeId |
| INSUFFICIENT_REST | SOFT | contract only (not enforced in CC-09) |
| COURT_UNAVAILABLE | HARD | locked/unavailable court mapping |
| VENUE_UNAVAILABLE | SOFT | contract only |
| INVALID_ROUND_ORDER | SOFT | contract only |
| DUPLICATE_MATCH_ASSIGNMENT | HARD | duplicate assignment rows |
| UNASSIGNED_MATCH | SOFT | no court/slot/time assignment |
| INVALID_BYE_ASSIGNMENT | HARD | BYE with court/slot |
| MANUAL_OVERRIDE_CONFLICT | SOFT | locked override not reflected |
| DEPENDENCY_NOT_COMPLETED | INFO | pending bracket placeholders |
| UNKNOWN_PARTICIPANT | HARD | unmapped participant id |
| UNKNOWN_COURT / UNKNOWN_SLOT | HARD | contract ready |

## Gap analysis

- CC-09 does **not** replace legacy validators; it adds canonical envelope + shadow comparison.
- Rest-time and venue-level conflicts are modeled but not fully computed until CC-10.
- Session/Daily Play scheduling uses different semantics — **OUT_OF_SCOPE**.

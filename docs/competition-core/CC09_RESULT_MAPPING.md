# CC-09 — Result Mapping

Source: `legacySchedulingMapping.js` → `mapLegacySchedulingResultToCanonical`, `mapCanonicalScheduleToLegacyAssignments`

## Legacy → Canonical

| Legacy shape | Maps to |
|---|---|
| `matches[]` | SchedulingMatch[] + assignments (court/time/slot) |
| `data.matches[]` (TE 4.0) | same as matches |
| `matchups[]` (TT) | matches + assignments (courtLabel → courtId) |
| `assignments[]` explicit | SchedulingAssignment[] passthrough |
| `groups[].matches` | rounds + supplemental matches |
| `rounds[]` | SchedulingRound[] |
| BYE entries (`__BYE__`) | byes[] + ASSIGNMENT_STATUS.BYE |
| pending TBD / __PENDING_* | pendingDependency flag, warning not error |

## Assignment stubs

Matches without court/time get `legacy_match_stub` assignment with UNASSIGNED status — enables membership parity without inventing court/time.

## Canonical → Legacy (round-trip)

`mapCanonicalScheduleToLegacyAssignments` — used for trace/export; shadow mode returns original legacy object.

## Parity keys

Stable match IDs compared via `extractLegacySchedulingRows` vs canonical match rows in adapter shadow step.

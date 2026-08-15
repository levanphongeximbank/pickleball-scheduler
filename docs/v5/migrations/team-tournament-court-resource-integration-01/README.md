# Team Tournament court-resource integration 01

Local SQL package only. It was authored without running or applying SQL against
Staging or Production. Apply only after separate Owner GO.

## Scope

This package adds nullable dedicated columns to
`public.team_tournament_matchups`:

- `court_id text`
- `cluster_id text`
- `scheduled_end timestamptz`

`court_label` remains display/legacy compatibility data. `schedule_meta`
remains compatibility metadata. Neither is promoted to canonical `court_id`.

Canonical occupancy uses:

```text
same court_id AND [scheduled_at, scheduled_end) overlaps
```

Adjacent intervals are allowed. A canonical assignment is rejected unless
`courtId`, `scheduledAt`, and `scheduledEnd` form a complete tuple with
`scheduledEnd > scheduledAt`. Writers take transaction advisory locks in
sorted `courtId` order before checking same-Tournament schedule occupancy.

## Preserved contracts

The package copies the deployed definitions under package-private names before
replacing the public definitions in-place. Public function OIDs stay stable for
existing dependencies, and rollback does not reconstruct older, incomplete
versions.

- `team_tournament_replace_matchups` keeps Scenario-B `nextMatchupId`,
  `nextSlot`, `competitionStage`, `bracketRoundLabel`, destructive-change,
  team, and discipline behavior.
- `team_tournament_update_setup_config` delegates all existing qualification,
  stage tie-break, and stage scoring behavior to the deployed superset.
- `team_tournament_update_matchup_schedule` and
  `team_tournament_apply_schedule_batch` retain the canonical mutation
  prepare/version/snapshot/finalize pipeline and persist all three dedicated
  fields.
- normalized setup, `get_setup`, and Dashboard matchup projections expose
  `courtId`, `clusterId`, and `scheduledEnd`.
- setup persistence accepts `clusterId`, `selectedCourtIds`, and
  `courtCapacityWindow` without inventing defaults.

`courtCapacityWindow` must be exactly an object containing:

```json
{
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM"
}
```

The date and times must parse exactly and `endTime` must be later than
`startTime`. `clusterId` may be `null` during lifecycle clearing or a non-empty
string when selected. `selectedCourtIds` must be an array of unique, non-empty
strings.

Anonymous execution remains denied; authenticated grants on public Team
Tournament RPCs remain unchanged. Package helpers and preserved bodies are not
API-executable.

## Apply order

1. Run `01_PRECHECK.sql` (read-only).
2. Review its pass notice and obtain Owner GO.
3. Run `02_APPLY.sql`.
4. Run `03_VERIFY.sql` (read-only).

The precheck proves required columns/functions, current deployed supersets,
wrapper contracts, API grants, and the #426 rename/pairing/referee continuation.
The verify script inspects the new columns, constraint, function bodies,
projections, ACLs, canonical interval logic, and the same #426 continuation.

## Rollback danger

`04_ROLLBACK.sql` is intentionally fail-closed. It refuses to proceed unless
all three new columns contain zero non-null values across the entire table.
When safe, it restores the exact preserved prior function bodies, restores the
prechecked API grants, and only then drops the constraint and columns.

Do not clear live column values merely to bypass the guard. Once any canonical
court assignment has been persisted, rollback requires a separately reviewed
data migration, operational outage plan, and explicit Owner approval.

Settings JSON written through this package is additive and is not erased by
rollback; removing such settings would also require an explicit data migration.

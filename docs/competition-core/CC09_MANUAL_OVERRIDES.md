# CC-09 — Manual Overrides

## Override shape (`SchedulingOverride`)

`overrideId`, `matchId`, `field`, `beforeValue`, `afterValue`, `reason`, `actor`, `timestamp`, `locked`

## Adapter behavior

1. Overrides copied from request into `SchedulingResult.manualOverrides`
2. Included in `SchedulingDecisionTrace.manualOverrides`
3. Locked court override mismatch → `MANUAL_OVERRIDE_CONFLICT` (soft)
4. Legacy `manualScheduleLock` → `assignment.manualOverride: true`
5. **Never silently replace** locked manual assignments

## Out of scope

- No new override UI
- No new persistence layer
- No intercept of drag/drop write paths

Legacy output remains primary when flag ON (shadow mode).

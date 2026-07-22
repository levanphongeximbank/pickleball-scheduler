# CORE-13 — Error and Diagnostic Taxonomy

Canonical enum: `REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE`

## Severity

| Severity | Meaning |
|----------|---------|
| `FATAL` | Request aborts |
| `MATCH_RECOVERABLE` | Plan may continue; match yields unassigned requirement |
| `WARNING` | Accepted with note |

## Codes (required set + snapshot helpers)

| Code | Default severity |
|------|------------------|
| `INVALID_ASSIGNMENT_REQUEST` | FATAL |
| `TENANT_SCOPE_REQUIRED` | FATAL |
| `TOURNAMENT_SCOPE_REQUIRED` | FATAL |
| `MATCH_SCOPE_REQUIRED` | FATAL |
| `SCHEDULE_WINDOW_REQUIRED` | MATCH_RECOVERABLE (per-match); entire schedule missing uses `SNAPSHOT_MISSING` FATAL |
| `NO_REFEREE_CANDIDATES` | MATCH_RECOVERABLE |
| `NO_ELIGIBLE_REFEREE` | MATCH_RECOVERABLE |
| `REFEREE_NOT_FOUND` | MATCH_RECOVERABLE |
| `REFEREE_INACTIVE` | MATCH_RECOVERABLE |
| `REFEREE_NOT_QUALIFIED` | MATCH_RECOVERABLE |
| `REFEREE_UNAVAILABLE` | MATCH_RECOVERABLE |
| `REFEREE_ALREADY_ASSIGNED` | MATCH_RECOVERABLE |
| `REFEREE_CONFLICT_OF_INTEREST` | MATCH_RECOVERABLE |
| `REFEREE_ROLE_UNSUPPORTED` | MATCH_RECOVERABLE |
| `MANUAL_ASSIGNMENT_REJECTED` | FATAL |
| `REQUIRED_REFEREE_ROLE_UNFILLED` | MATCH_RECOVERABLE |
| `ASSIGNMENT_CAPACITY_EXHAUSTED` | MATCH_RECOVERABLE |
| `NON_DETERMINISTIC_INPUT` | FATAL |
| `INVALID_REPLACEMENT_REQUEST` | FATAL |
| `REPLACEMENT_REFEREE_REJECTED` | FATAL |
| `SNAPSHOT_MISSING` | FATAL |
| `SNAPSHOT_INVALID` | FATAL |

## Documented failure semantics

1. Missing required port/snapshot → **FATAL**.
2. Valid directory with zero candidates → **not** automatically malformed; planning may return match-recoverable unfilled requirements.
3. Missing entire schedule snapshot → **FATAL**.
4. Individual match missing `startAt`/`endAt` → **MATCH_RECOVERABLE** + unassigned requirement (planner Phase 1C+).
5. Manual rejection → envelope `MANUAL_ASSIGNMENT_REJECTED` with `causedBy` / `reasonCodes`.
6. Hard constraints never overridden by manual assignment.
7. Soft preferences overridden only when explicitly permitted.

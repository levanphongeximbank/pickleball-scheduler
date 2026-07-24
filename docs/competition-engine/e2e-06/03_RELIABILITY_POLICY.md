# E2E-06 — Reliability Policy

**Policy version:** `e2e-06-reliability-policy-v1`

## Health states (projection only)

`READY` | `DEGRADED` | `BLOCKED` | `RECOVERING` | `SUSPENDED` | `COMPLETED` | `ARCHIVE_READY` | `ARCHIVED`

Not a parallel lifecycle engine — derived from canonical lifecycle/workflow/publication/recovery evidence.

## Evaluated concerns

1. Required canonical ports available
2. Identity/tenant context
3. Workflow consistency (CORE-19)
4. Lifecycle consistency (CM-07)
5. Publication consistency (CM-06)
6. Participant lock consistency
7. Schedule/court certification
8. Scoring/result validation consistency
9. Standings/qualification consistency
10. Final publication consistency
11. Audit evidence presence (CORE-20)
12. Replay seed presence (CORE-21)
13. Recovery checkpoint presence (CORE-23)
14. Archive handoff readiness (CM-08)

## Issue model

- Typed codes (`RELIABILITY_ISSUE_CODE`)
- Severity: `INFO` | `WARNING` | `BLOCKING` | `CRITICAL`
- Source owner (`ISSUE_SOURCE_OWNER`)
- Deterministic severity→code→message ordering
- Missing evidence is never silently ignored

## Degraded continuation

| Continuation | Meaning |
|--------------|---------|
| `CONTINUE_SAFE` | Optional dependency missing; ops may continue |
| `READ_ONLY_FALLBACK` | Writes blocked; reads may continue |
| `RETRY_REQUIRED` | Transient dependency; retry |
| `MANUAL_INTERVENTION_REQUIRED` | Operator action required |
| `HARD_BLOCK` | Fail-closed; no silent success |

`silentSuccessForbidden: true` is always set on degraded projections.

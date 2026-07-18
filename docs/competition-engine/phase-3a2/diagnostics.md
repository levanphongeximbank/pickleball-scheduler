# Diagnostics & Audit Events — Phase 3A.2

## Diagnostics

Factory: `createShadowDiagnostics` / builder `buildShadowDiagnostics`

Pure data:

```text
correlationId
competitionId
capability
operation
eligibility
plan
comparisonSummary
reasonCodes
timings
metadata
```

Invariants:

- No `console.log` in domain modules
- No database writes
- No analytics publish
- Metadata marks `persistence: false`, `analytics: false`, `console: false`

## Audit-event contracts

Types (`SHADOW_AUDIT_EVENT_TYPE`):

```text
SHADOW_ELIGIBILITY_EVALUATED
SHADOW_PLAN_CREATED
SHADOW_EXECUTION_SKIPPED
SHADOW_COMPARISON_COMPLETED
SHADOW_DIVERGENCE_DETECTED
```

Factories return plain objects only.

```text
No persist.
No publish.
No API call.
```

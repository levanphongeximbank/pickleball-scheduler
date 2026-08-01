# Phase 5D-A — TT5D preexisting-state reconciliation readiness

**DRAFT readiness only. Staging migration NOT EXECUTED in this workstream.**

## Purpose

Prepare a deterministic, fail-closed reconciliation package for TT5D objects that
already exist on Staging (`qyewbxjsiiyufanzcjcq`) without controlled
migration provenance.

## Decision

`READY_FOR_OWNER_STAGING_GO`

This is **not** Staging mutation authorization. A separate Owner GO is required
before Phase 5D-B.

## Guard contracts

- Policy USING (`tt5d_correction_referee_select`): `WS_COLLAPSE_V1`
- Function `proconfig`: `PROCONFIG_TEXT_ARRAY_V1` (exact `text[]` element-wise;
  never compare `proconfig::text`)

## Prior Phase 5D-B attempts (no committed Staging mutation)

1. Policy whitespace representation mismatch — `sql/10` not executed.
2. `sql/00` PASS; `sql/10` aborted in `$guard$` on `proconfig::text` representation
   before mutation; transaction rolled back; committed mutations=0.

## Retained blockers

- `BLOCKED_PHASE5C_TT5D_CERTIFICATION`
- `BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE`
- `BLOCKED_PHASE5B_EXECUTION_PACKAGE`
- `BLOCKED_PHASE5_READINESS`

M9 remains `executableApplyCount=20` / `nonExecutableCandidateCount=4`.
`executionRunbookAccepted=false` · `productionExecutionGo=false` ·
`PHASE_05_COMPLETE=NOT_ISSUED`.

## Mutation allowlist (author only)

1. `ALTER FUNCTION referee_v5_assignment_effective_status ... STABLE`
2. ACL reconcile: revoke `PUBLIC`+`anon` (+ extra roles) and grant package allowlist
3. Table ACL: correction_requests authenticated `SELECT` only
4. Insert controlled migration provenance row after success

## Rollback

`sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql` restores captured pre-mutation
volatility, ACLs, table grants, and removes the Phase 5D provenance row.

## Safety counters

- StagingDatabaseMutations=0
- ProductionAccess=0
- ProductionDatabaseMutations=0
- RestoreExecutions=0

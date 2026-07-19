# Phase 2C — Cancel membership request audit patch

**Branch:** `fix/club-phase-2c-cancel-request-audit`  
**Base:** `origin/main`  
**Severity:** MEDIUM (mutation without server audit)  
**Production apply:** **NOT** from this branch  
**Deployment:** Staging first; Production only after Owner GO.  

## Defect

`club_cancel_membership_request` performed `pending → cancelled` + version bump + idempotency **without** `phase42_write_audit('club.membership_request.cancel', ...)`.

The action was also absent from `audit_logs_action_check`.

## Fix (single SQL file)

`docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql`

1. Additive whitelist UNION (includes historical `audit_logs.action` rows + known set **including** `club.membership_request.cancel`).
2. `CREATE OR REPLACE` cancel RPC with audit in the **same transaction** as the UPDATE (before idempotency put).

## Audit metadata contract

| Field | Source |
|-------|--------|
| action | `club.membership_request.cancel` |
| resource_type | `club_membership_request` |
| resource_id | membership request UUID |
| venue_id / tenant | `v_row.tenant_id` |
| club_id | `v_row.club_id` |
| actor_id | `auth.uid()` (via `phase42_write_audit`) |
| metadata.request_id | idempotency `p_request_id` |
| metadata.membership_request_id | row id |
| metadata.user_id | request owner |
| metadata.from_status / to_status | `pending` / `cancelled` |
| metadata.from_version / to_version | OCC before / after |

## Atomicity / idempotency

- Audit runs after UPDATE in the same function transaction → audit failure rolls back cancel.
- Idempotency cache hit returns early → **no second audit**.
- Failed authz / NOT_FOUND / INVALID_STATUS / VERSION_CONFLICT return before UPDATE → **no audit**.

## Staging

```bash
node scripts/apply-phase2c-cancel-audit-staging.mjs
node scripts/verify-phase2c-cancel-audit-staging.mjs
```

Requires Staging Management API / DB credentials (`SUPABASE_ACCESS_TOKEN`, staging project ref `qyewbxjsiiyufanzcjcq`). Refuses Production ref.

## Staging evidence (applied)

| Check | Result |
|-------|--------|
| Apply | `docs/v5/qa-evidence/phase2c-cancel-audit-staging/APPLY_REPORT.json` → APPLIED |
| Schema verify | `VERIFY_REPORT.json` → PASS (whitelist + RPC body) |
| Live fixture | `FIXTURE_REPORT.json` → PASS (cancel, 1 audit, idempotent replay, FORBIDDEN, VERSION_CONFLICT) |

**Production:** not applied.


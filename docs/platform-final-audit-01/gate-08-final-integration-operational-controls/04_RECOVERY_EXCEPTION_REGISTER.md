# Gate 8 — Recovery Exception Register

**Decision ID:** `RECOVERY_READINESS_DECISION_01`  
**Locked classification (Owner):** `CLOSED_WITH_ACCEPTED_EXCEPTIONS`  
**Readiness:** `RECOVERY_READINESS=CERTIFIED_WITH_GAPS`  
**Owner risk acceptance:** `YES`

## Verified facts (Owner-supplied + Gate 8 non-mutating confirmation of record)

| Item | Value |
|------|-------|
| Supabase organization | Pro |
| Production project | `pickleball-scheduler-production` |
| Production ref | `expuvcohlcjzvrrauvud` |
| Scheduled backups | Active |
| Retention window | 7 days |
| Restore drill project | `pickvn-recovery-drill-01` |
| Restore project ref | `shxzwppmgttwtwswdhouh` |
| Restore to new project | Completed |
| Historical `public.clubs` restored | Yes |
| Auth aggregate restored | Yes |
| RLS enabled on drill | Yes |
| Drill `select_policy_count` | 1 |
| Drill `writer_policy_count` | 0 |
| Production unchanged by drill | Yes |

## Accepted exceptions (NOT resolved)

| ID | Exception | Status | Must remain visible |
|----|-----------|--------|---------------------|
| EX-PITR-01 | PITR not enabled — Owner cost decision | `OWNER_DECLINED_COST` | YES |
| EX-DRILL-01 | Restore drill used an older snapshot | ACCEPTED | YES |
| EX-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | `LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED` | YES |
| EX-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified on drill | ACCEPTED | YES |
| EX-STORAGE-01 | Storage objects not included in database backups | `STORAGE_OBJECT_RECOVERY=NOT_COVERED` | YES |
| EX-RPO-01 | Approximate RPO may be up to daily backup interval | ACCEPTED | YES |
| EX-DRILL02-01 | Restore drill 02 deferred | `RESTORE_DRILL_02=DEFERRED` | YES |

## Gate 8 treatment

- Gate 8 **does not** claim these exceptions are closed.
- Gate 8 **does not** enable PITR, delete drill projects, or re-run restores.
- These exceptions feed Gate 9 release decision as **accepted residual risk**, not silent PASS.

## Locked markers

```text
RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS
RECOVERY_READINESS=CERTIFIED_WITH_GAPS
RESTORE_DRILL_02=DEFERRED
PITR=OWNER_DECLINED_COST
OWNER_RISK_ACCEPTANCE=YES
PITR=NOT_ENABLED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
```

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_8_RECOVERY_EXCEPTIONS_PRESERVED`

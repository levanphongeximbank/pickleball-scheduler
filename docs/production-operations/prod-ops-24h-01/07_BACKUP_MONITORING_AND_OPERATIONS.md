# PROD-OPS-24H-01 — Backup, Monitoring, and Operations

## Latest successful Production deployment

| Field | Value |
|-------|-------|
| Deploy ID | `5625433697` |
| SHA | `edca457748be3ef3a160b68076a69535b2ab6e3f` |
| State | success / Ready |
| Alias | `https://pickvn.app` |

## Scheduled backup status (carry-forward evidence)

From Gate 8 recovery register (Owner-supplied; **not** re-mutated):

| Item | Value |
|------|-------|
| Org plan | Pro |
| Production project | `pickleball-scheduler-production` |
| Production ref | `expuvcohlcjzvrrauvud` |
| Scheduled backups | **Active** (recorded) |
| Retention | **7 days** (recorded) |
| PITR | **NOT_ENABLED** (Owner declined cost) |
| Storage object recovery | **NOT_COVERED** |

Live dashboard re-attestation of backup job health in this 24h window: **NOT_INDEPENDENTLY_REVERIFIED** beyond committed Gate 8/10 evidence. Status treated as **ACTIVE_PER_PRIOR_CERTIFICATION**.

## Restore drill 01

| Item | Value |
|------|-------|
| Drill project | `pickvn-recovery-drill-01` |
| Ref | `shxzwppmgttwtwswdhouh` |
| Result (historical) | Restore to new project completed; clubs/auth aggregates restored; RLS enabled on drill |
| Classification | Historical mechanics only (`EX-DRILL-01`) |

## Recovery exceptions (preserved exactly)

```text
RECOVERY_READINESS_DECISION_01=CLOSED_WITH_ACCEPTED_EXCEPTIONS
RECOVERY_READINESS=CERTIFIED_WITH_GAPS
PITR=NOT_ENABLED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
RESTORE_DRILL_02=DEFERRED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
OWNER_RISK_ACCEPTANCE=YES
```

Also preserved: latest Clubs RLS recoverability **not verified** on drill; approximate RPO up to daily backup interval.

## Error handling / monitoring / observability

| Item | Status |
|------|--------|
| App public routes 5xx | None observed in smoke |
| Monitoring operational effectiveness | **NOT_VERIFIED** (`RC-MONITOR-01`) |
| PGO-02 Production operational readiness | Documented; readiness historically `NOT_READY` for full Ops certification |
| Automated IR effectiveness | **NOT claimed** |

```text
MONITORING_EFFECTIVENESS=NOT_VERIFIED
```

## Incident response ownership

| Role | Authority |
|------|-----------|
| Owner | Production GO / escalation / rollback authorization |
| Ops | Public smoke / dashboard review |
| Security | Tenant-isolation incidents (CRITICAL until disproven) |
| IR roster in-repo | `RC-IR-ROSTER-01` OPEN / FOLLOW_UP (Owner offline OK if acknowledged) |

Taxonomy / rollback decision matrix: `docs/platform-governance-operations/pgo-02-incident-recovery-readiness/`.

## Rollback procedure (pointer only — agent does not execute)

1. Owner GO required for Production rollback.
2. Prefer Vercel prior Production deployment redeploy / git revert PR.
3. After rollback: re-smoke `/`, `/clubs`, `/courts`, manifest, SW; record SHA.
4. Do not force-push; do not claim PITR coverage.

## Production change ledger since Gate 10 closure

| When (UTC) | Change | Actor | Mutation by PROD-OPS-24H |
|------------|--------|-------|--------------------------|
| 2026-07-27T15:42:06Z | Merge PR #322 Gate 10 | Owner/GitHub | No |
| 2026-07-27T15:44:11Z | Production deploy `5625433697` = `edca4577…` | vercel[bot] | No |
| PROD-OPS-24H window | Read-only verification + docs PR | Agent | Docs/tests only |

## Marker

`PROD_OPS_24H_01_BACKUP_MONITORING_AND_OPERATIONS_RECORDED`

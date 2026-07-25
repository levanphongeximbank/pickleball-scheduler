# COMMS-ACT-06 — Reliability & Operations

## Backup / restore

| Item | Status |
|------|--------|
| Out-of-repo Production backup script | Prepared: `C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1` |
| Fresh Production backup executed | **NO** (ACT-07 Gate B only) |
| Staging backups | Present historically — **not** Production recovery media |
| Dashboard / PITR capability | **Owner must confirm** on Production project |

If Production has no usable backup capability → release **BLOCKED_BACKUP_RECOVERY**.

## Rollback

| Path | Plan |
|------|------|
| Deploy rollback | Redeploy previous Vercel Production deployment / unset Communication flags |
| SQL rollback | COMMS-05 + ACT-03 rollback packages (only if schema applied) |
| Kill switch | `VITE_COMMUNICATION_TRUSTED_BACKEND=false` and/or `VITE_COMMUNICATION_RUNTIME_MODE=UNAVAILABLE`; remove `COMMS_PRODUCTION_RUNTIME_ENABLE` |
| Partial failure | Prefer stop writes + fixture cleanup before schema rollback |

## Observability

| Item | Status | Class |
|------|--------|-------|
| Typed HTTP errors | Present | — |
| Safe diagnostics | Present | — |
| Metrics / alerting | Not productized | REQUIRED_BEFORE_SCALE |
| Incident owner | Owner + on-call (name TBD by Owner) | RELEASE_BLOCKER until named |
| Release window | Owner-scheduled | ACT-07 |
| Post-release verification | Smoke matrix + read-only final verify | ACT-07 |
| Emergency disable | Kill switch above | Present |

## Idempotent retry / timeouts

Trusted backend uses idempotency ledger. Client network errors must not invent local success.

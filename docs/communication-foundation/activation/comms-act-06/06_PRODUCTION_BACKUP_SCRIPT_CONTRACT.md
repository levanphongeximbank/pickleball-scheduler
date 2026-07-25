# COMMS-ACT-06 — Production backup script contract (repo vs Owner-local)

## Evidence flags (truth)

| Flag | Value |
|------|-------|
| `OWNER_LOCAL_BACKUP_SCRIPT_PREPARED` | `YES` (Owner machine) |
| `OWNER_LOCAL_BACKUP_SCRIPT_EXECUTED` | `NO` |
| `CI_EXTERNAL_FILE_EXISTENCE_REQUIRED` | `NO` |
| `REPOSITORY_BACKUP_CONTRACT_VERIFIED` | `YES` when template static checks PASS |
| `PRODUCTION_LOGICAL_BACKUP_VERIFIED` | `NO` |
| Native Dashboard backup | `NO` (Owner metadata) |
| PITR | `NO` (Owner metadata) |

## A. Repository-verifiable artifact (CI)

Canonical template/contract:

`scripts/communication/comms-act-07-production-logical-backup.template.ps1`

CI must verify this file (not the Owner-local path):

- Production allowlist `expuvcohlcjzvrrauvud`
- Staging blocklist `qyewbxjsiiyufanzcjcq`
- No hard-coded password/token/JWT/connection string
- roles / schema / data / migration-history dumps
- Manifest SHA256 + ZIP SHA256 intent
- No overwrite / already exists guard
- No mutation / dump-only / ACT-07 Owner execution only

## B. Owner-local executable (not CI prerequisite)

`C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1`

- Prepared outside git on purpose (avoid secret/backup coupling)
- Absence on Linux CI = `OWNER_LOCAL_ARTIFACT_NOT_AVAILABLE_IN_CI`
- Does **not** fail ACT-06 repository readiness
- Does **not** clear `PRODUCTION_BACKUP_CAPABILITY` RELEASE_BLOCKER until Gate B executes and verifies a fresh logical backup

## Rule

ACT-06 validates the **contract**.  
ACT-07 Gate B executes the **Owner-local** script after readiness PASS.

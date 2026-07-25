# COMMS-ACT-06 — Backup Plan (Production)

## Rule

ACT-06 **prepares and statically validates** the Production backup **contract**.
ACT-07 Gate B **executes** a fresh Production logical backup after readiness PASS.

Do **not** reuse Staging backups as Production recovery media.

## Evidence flags (truth)

| Flag | Value |
|------|-------|
| `OWNER_LOCAL_BACKUP_SCRIPT_PREPARED` | `YES` (Owner machine) |
| `OWNER_LOCAL_BACKUP_SCRIPT_EXECUTED` | `NO` |
| `CI_EXTERNAL_FILE_EXISTENCE_REQUIRED` | `NO` |
| `REPOSITORY_BACKUP_CONTRACT_VERIFIED` | checked via template in CI |
| `PRODUCTION_LOGICAL_BACKUP_VERIFIED` | `NO` |
| Native Dashboard backup | `NO` |
| PITR | `NO` |

See also: `06_PRODUCTION_BACKUP_SCRIPT_CONTRACT.md`.

## A. Repository-verifiable artifact (CI)

`scripts/communication/comms-act-07-production-logical-backup.template.ps1`

CI validates allowlist/blocklist, dump intents, SHA256/ZIP intent, no-overwrite, no secrets, no mutation.
This template is **not** executable against Production.

## B. Owner-local executable (not CI prerequisite)

`C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1`

### Guarantees (must match contract)

- Allowlist Production ref `expuvcohlcjzvrrauvud`
- Blocklist Staging ref `qyewbxjsiiyufanzcjcq`
- No secrets in script body
- Dumps: roles / schema / data / migration-history schema+data
- Manifest SHA256 + ZIP + ZIP SHA256
- Never overwrite an existing backup directory
- Never mutate Production (dump only)

### Output root

`C:\Users\Le Phong\PICK_VN-Backups\supabase-production\`

Naming:

`pickleball-scheduler-production-expuvcohlcjzvrrauvud-<timestamp>-COMMS-ACT-07`

## Owner run (ACT-07 only)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1"
```

Tell Agent only: `BACKUP_COMPLETE` + `BACKUP_DIRECTORY=` path (no password, no dump contents).

## Evidence env (ACT-07)

- `COMMS_ACT_07_PRODUCTION_BACKUP_EVIDENCE`
- optional `COMMS_ACT_07_PRODUCTION_BACKUP_EVIDENCE_PATH`

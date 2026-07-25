# COMMS-ACT-06 — Backup Plan (Production)

## Rule

ACT-06 **prepares and statically validates** the Production backup script.  
ACT-07 Gate B **executes** a fresh Production backup after readiness PASS.

Do **not** reuse Staging backups as Production recovery media.

## Script (outside repository)

`C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1`

### Guarantees

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

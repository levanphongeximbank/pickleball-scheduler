# COMMS-ACT-05 — Gate B backup Owner action

**Status:** `COMMS_ACT_05_BACKUP_SCRIPT_READY_FOR_OWNER`  
**Reason:** Fresh ACT-05 Staging logical backup must be created by Owner (interactive DB password). ACT-04 backup is not accepted as ACT-05 primary.

## Prepared outside repository

| Item | Value |
|------|-------|
| Script | `C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-05-staging-logical-backup.ps1` |
| Syntax | OK |
| Script SHA256 | `21a84344f063cf9c4c0deb8112ce8aa697d1cd14f47fd1444638558d08522c36` |
| Staging allowlist | `qyewbxjsiiyufanzcjcq` |
| Production block | `expuvcohlcjzvrrauvud` |
| Protected ACT-04 dir | `...\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260725-101205` |
| Scope | `TRUSTED_BACKEND_SMOKE_BACKUP_ONLY` |
| Remote mutation by Agent | `0` |
| Script executed by Agent | `NO` |

## Prerequisites for Owner

1. Start **Docker Desktop** and wait until engine is healthy.
2. Keep Node/npx on PATH.
3. Have Staging DB password ready (do **not** paste into chat).

## Exactly one Owner command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-05-staging-logical-backup.ps1"
```

When prompted, enter Staging DB password for `qyewbxjsiiyufanzcjcq` only.

## Expected success output (excerpt)

```
=== BACKUP COMPLETE ===
BACKUP_DIRECTORY=C:\Users\Le Phong\PICK_VN-Backups\supabase-staging\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-<timestamp>-COMMS-ACT-05
ARCHIVE_PATH=...zip
ARCHIVE_SHA256=<64 hex>
MANIFEST_STATUS=PASS
ACT04_PRIMARY_BACKUP_UNTOUCHED=YES
REMOTE_MUTATION_COUNT=0
PRODUCTION_UNTOUCHED=YES
```

## After success

Reply to Agent with only:

1. `BACKUP_COMPLETE`
2. The new `BACKUP_DIRECTORY=` path printed by the script

Do **not** paste password, connection string, SQL dump, or ZIP contents.

Staging smoke still requires a **separate** later Owner GO:

`OWNER GO COMMS-ACT-05 STAGING TRUSTED_BACKEND_SMOKE_ONLY`

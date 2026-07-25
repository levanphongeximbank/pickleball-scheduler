# COMMS-ACT-04 — Gate B backup Owner action

**Status:** `BACKUP_OWNER_ACTION_REQUIRED`  
**Reason:** Fresh ACT-04 Staging logical backup must be created by Owner (interactive DB password). ACT-02 backups are not accepted as ACT-04 primary.

## Prepared outside repository

| Item | Value |
|------|-------|
| Script | `C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-04-staging-logical-backup.ps1` |
| Syntax | OK |
| Script SHA256 | `2aadd29e9e96c4a4f90039e4b45cf6a8df317c7c26c3d59dc4f8be0d7b3e4b70` |
| Staging allowlist | `qyewbxjsiiyufanzcjcq` |
| Production block | `expuvcohlcjzvrrauvud` |
| Bound forward SQL SHA256 | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` |
| Bound forward SQL bytes | `13173` |
| Bound rollback SQL SHA256 | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` |
| Bound rollback SQL bytes | `8808` |
| Scope | `CLUB_SELECT_ONLY` |

## Prerequisites for Owner

1. Start **Docker Desktop** and wait until engine is healthy.
2. Keep Node/npx on PATH (already present on this machine).
3. Have Staging DB password ready (do **not** paste into chat).

## Exactly one Owner command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-04-staging-logical-backup.ps1"
```

When prompted, enter Staging DB password for `qyewbxjsiiyufanzcjcq` only.

## After success

Reply to Agent with only:

1. `BACKUP_COMPLETE`
2. The new `BACKUP_DIRECTORY=` path printed by the script

Do **not** paste password, connection string, SQL dump, or ZIP contents.

# COMMS-ACT-05 — Backup Plan

## Rule

Create a **new** Staging backup **after** ACT-04 and **before** ACT-05 smoke writes.

ACT-04 backup is historical only — not primary ACT-05 recovery media.

## Owner steps (out of repository)

1. Snapshot Staging project `qyewbxjsiiyufanzcjcq` (Dashboard backup or `pg_dump` to Owner-controlled storage).
2. Record evidence label containing `COMMS_ACT_05` / `ACT-05` and timestamp.
3. Store path/checksum **outside** git (never commit dumps / connection strings).
4. Set for live preflight:
   - `COMMS_ACT_05_STAGING_BACKUP_EVIDENCE`
   - optional path hint for local Owner notes

## Script readiness

Repository ships **read-only** helpers under `scripts/communication/`.  
Backup execution remains Owner-operated outside the repo so secrets/dumps never enter git.

## Verification before smoke

`evaluateCommsAct05BackupGate` requires ACT-05 marker and rejects ACT-04-only evidence when `requireBackupEvidence=true`.

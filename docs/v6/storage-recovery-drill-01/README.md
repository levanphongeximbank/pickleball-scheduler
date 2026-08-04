# Phase 6 Storage Backup And Recovery Drill 01

Status: **TOOLING PREPARED — EXECUTION NOT STARTED**

Production source: `expuvcohlcjzvrrauvud` (read-only)  
Allowed buckets: `user-avatars`, `tournament-broadcast-vods`  
Destination: a separate recovery project; must never equal Production.

## Purpose

Supabase database backups restore Storage metadata but do not restore object bytes. This package copies the two Production buckets to a separate recovery project through the Supabase S3 protocol and records object counts, bytes, elapsed time, and verification status.

The script uses `rclone copy`, never `sync`, and contains no delete operation. Production is always the read-only source. A copy requires both `-Execute` and the exact Owner token `OWNER_GO_STORAGE_RESTORE_DRILL`.

## Prerequisites

1. Install `rclone` and verify `rclone version`. This workstation has verified portable `rclone v1.74.4` at `%LOCALAPPDATA%\rclone\rclone.exe`.
2. In Production and the recovery project, open **Storage → S3 Configuration** and create temporary S3 access keys.
3. Confirm the destination project is disposable/recovery-only and both destination buckets already exist with matching configuration.
4. Copy `ENVIRONMENT.template` to repository root as `.env.phase6-storage.local`, fill the temporary credentials and Production region, and never commit that ignored file.

## Execution sequence

```powershell
# Read-only source/destination inventory
.\scripts\phase6-storage-recovery-drill.ps1 -Mode inventory

# Copy to the non-Production recovery project after explicit Owner GO
.\scripts\phase6-storage-recovery-drill.ps1 `
  -Mode copy `
  -Execute `
  -OwnerGoToken OWNER_GO_STORAGE_RESTORE_DRILL `
  -EvidencePath .\docs\v6\storage-recovery-drill-01\evidence\COPY_RESULT.local.json

# Independent read-only verification
.\scripts\phase6-storage-recovery-drill.ps1 `
  -Mode verify `
  -EvidencePath .\docs\v6\storage-recovery-drill-01\evidence\VERIFY_RESULT.local.json
```

Before committing evidence, redact operational identifiers if necessary and confirm no environment value or S3 credential appears. Revoke both temporary S3 access key pairs after verification.

## Certification gate

PASS requires:

- both bucket source counts/bytes recorded;
- destination counts/bytes equal source after copy;
- `rclone check --one-way --size-only` passes for both buckets;
- measured elapsed time recorded as the Storage restore drill RTO evidence;
- temporary access keys revoked;
- Owner accepts the measured RTO and the Storage backup cadence/retention.

This package does not authorize restoring into Production and does not grant Production GO.

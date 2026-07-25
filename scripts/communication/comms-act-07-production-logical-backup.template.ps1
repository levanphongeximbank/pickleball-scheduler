#Requires -Version 5.1
<#
.SYNOPSIS
  COMMS-ACT-07 Production logical backup — REPOSITORY CANONICAL CONTRACT / TEMPLATE.

.DESCRIPTION
  This file is the CI-verifiable static contract for Production Communication backups.
  It is NOT the Owner-executed artifact and MUST NOT be run against Production from CI.

  Owner-local executable (outside git; not a CI existence prerequisite):
    C:\Users\Le Phong\PICK_VN-Backups\create-comms-act-07-production-logical-backup.ps1

  Contract invariants (must remain true in Owner-local executable):
    - Production allowlist: expuvcohlcjzvrrauvud
    - Staging blocklist: qyewbxjsiiyufanzcjcq
    - Dumps: roles.sql, schema.sql, data.sql, migration-history-schema.sql, migration-history-data.sql
    - Manifest SHA256 + ZIP SHA256
    - Never overwrite an existing backup directory (already exists)
    - Never mutate Production (dump only; no SQL apply; no realtime; no client write open)
    - ACT-07 Owner execution only after readiness PASS + Gate B

.NOTES
  No hard-coded password, token, JWT, or connection string.
  CI_EXTERNAL_FILE_EXISTENCE_REQUIRED=NO
  REPOSITORY_BACKUP_CONTRACT_VERIFIED=YES (when this template passes static checks)
  PRODUCTION_LOGICAL_BACKUP_VERIFIED=NO until Owner Gate B completes
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- identity (refs only; no secrets) ---
$ProductionRef = 'expuvcohlcjzvrrauvud'
$StagingRef = 'qyewbxjsiiyufanzcjcq'
$Phase = 'COMMS-ACT-07'
$Scope = 'PRODUCTION_LOGICAL_BACKUP_ONLY'
$DirectorySuffix = 'COMMS-ACT-07'

# Documented Owner output root (executable lives outside repository).
$BackupRootParentDocumented = 'C:\Users\Le Phong\PICK_VN-Backups\supabase-production'

Write-Host '=== COMMS-ACT-07 Production logical backup CONTRACT TEMPLATE ==='
Write-Host "Phase: $Phase"
Write-Host "Production allowlist: $ProductionRef"
Write-Host "Staging blocklist: $StagingRef"
Write-Host "Scope: $Scope"
Write-Host 'Never targets Staging.'
Write-Host 'No SQL apply. No remote smoke. No realtime. No client write open.'
Write-Host 'This repository template is not the Owner executable.'
Write-Host 'Refuse to run dumps from CI / non-Owner context.'

function Assert-ContractOnly {
  throw 'CONTRACT_TEMPLATE_NOT_EXECUTABLE — use Owner-local create-comms-act-07-production-logical-backup.ps1 after Gate B.'
}

# Required dump artifact names (contract checklist for static scanners).
$RequiredDumpFiles = @(
  'roles.sql',
  'schema.sql',
  'data.sql',
  'migration-history-schema.sql',
  'migration-history-data.sql'
)

# Required verification artifacts.
$RequiredVerifyTokens = @(
  'backup-manifest.csv',
  'SHA256',
  'already exists',
  'no overwrite'
)

Assert-ContractOnly

# Unreachable markers retained so static safety tests can prove intent:
# Invoke dump labels: roles / schema / data / migration-history
# Archive: ZIP + ZIP SHA256
# Evidence: remoteMutationCount=0, remoteSqlApplied=NO, productionSmokeExecuted=NO, realtimeEnabled=NO

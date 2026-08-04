[CmdletBinding()]
param(
  [ValidateSet('inventory', 'copy', 'verify')]
  [string]$Mode = 'inventory',
  [switch]$Execute,
  [string]$OwnerGoToken = '',
  [string]$EvidencePath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceProjectRef = 'expuvcohlcjzvrrauvud'
$allowedBuckets = @('user-avatars', 'tournament-broadcast-vods')
$requiredNames = @(
  'PHASE6_STORAGE_SOURCE_ENDPOINT',
  'PHASE6_STORAGE_SOURCE_REGION',
  'PHASE6_STORAGE_SOURCE_ACCESS_KEY_ID',
  'PHASE6_STORAGE_SOURCE_SECRET_ACCESS_KEY',
  'PHASE6_STORAGE_DEST_PROJECT_REF',
  'PHASE6_STORAGE_DEST_ENDPOINT',
  'PHASE6_STORAGE_DEST_REGION',
  'PHASE6_STORAGE_DEST_ACCESS_KEY_ID',
  'PHASE6_STORAGE_DEST_SECRET_ACCESS_KEY'
)

foreach ($name in $requiredNames) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Missing required environment variable: $name"
  }
}

$destProjectRef = [Environment]::GetEnvironmentVariable('PHASE6_STORAGE_DEST_PROJECT_REF')
$sourceEndpoint = [Environment]::GetEnvironmentVariable('PHASE6_STORAGE_SOURCE_ENDPOINT')
$destEndpoint = [Environment]::GetEnvironmentVariable('PHASE6_STORAGE_DEST_ENDPOINT')

if ($destProjectRef -eq $sourceProjectRef) {
  throw 'Destination project must not be Production.'
}
if ($sourceEndpoint -notmatch [regex]::Escape($sourceProjectRef)) {
  throw 'Source endpoint does not match the approved Production project_ref.'
}
if ($destEndpoint -notmatch [regex]::Escape($destProjectRef)) {
  throw 'Destination endpoint does not match PHASE6_STORAGE_DEST_PROJECT_REF.'
}
if ($Mode -eq 'copy' -and (-not $Execute -or $OwnerGoToken -ne 'OWNER_GO_STORAGE_RESTORE_DRILL')) {
  throw 'Copy requires -Execute and OwnerGoToken=OWNER_GO_STORAGE_RESTORE_DRILL.'
}

$rclone = Get-Command rclone -ErrorAction SilentlyContinue
if (-not $rclone) {
  $portableRclone = Join-Path $env:LOCALAPPDATA 'rclone\rclone.exe'
  if (Test-Path -LiteralPath $portableRclone) {
    $rclone = Get-Item -LiteralPath $portableRclone
  } else {
    throw 'rclone is not installed or discoverable.'
  }
}
$startedAt = [DateTimeOffset]::Now
$tempConfig = Join-Path ([IO.Path]::GetTempPath()) ("phase6-rclone-{0}.conf" -f [guid]::NewGuid())

function Invoke-RcloneJson {
  param([string[]]$Arguments)
  $rclonePath = if ($rclone.PSObject.Properties.Name -contains 'Source') { $rclone.Source } else { $rclone.FullName }
  $output = & $rclonePath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join [Environment]::NewLine) }
  return ($output -join [Environment]::NewLine)
}

try {
  $config = @"
[phase6_source]
type = s3
provider = Other
access_key_id = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_SOURCE_ACCESS_KEY_ID'))
secret_access_key = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_SOURCE_SECRET_ACCESS_KEY'))
endpoint = $sourceEndpoint
region = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_SOURCE_REGION'))

[phase6_dest]
type = s3
provider = Other
access_key_id = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_DEST_ACCESS_KEY_ID'))
secret_access_key = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_DEST_SECRET_ACCESS_KEY'))
endpoint = $destEndpoint
region = $([Environment]::GetEnvironmentVariable('PHASE6_STORAGE_DEST_REGION'))
"@
  [IO.File]::WriteAllText($tempConfig, $config, [Text.UTF8Encoding]::new($false))

  $bucketEvidence = @()
  foreach ($bucket in $allowedBuckets) {
    $sourceSize = Invoke-RcloneJson @('size', "phase6_source:$bucket", '--json', '--config', $tempConfig)
    $source = $sourceSize | ConvertFrom-Json
    $destBeforeSize = Invoke-RcloneJson @('size', "phase6_dest:$bucket", '--json', '--config', $tempConfig)
    $destBefore = $destBeforeSize | ConvertFrom-Json

    if ($Mode -eq 'copy') {
      Invoke-RcloneJson @(
        'copy', "phase6_source:$bucket", "phase6_dest:$bucket",
        '--config', $tempConfig, '--transfers', '4', '--checkers', '8',
        '--metadata', '--no-traverse'
      ) | Out-Null
    }

    $destAfterSize = Invoke-RcloneJson @('size', "phase6_dest:$bucket", '--json', '--config', $tempConfig)
    $destAfter = $destAfterSize | ConvertFrom-Json
    $verified = $false
    if ($Mode -eq 'verify' -or $Mode -eq 'copy') {
      Invoke-RcloneJson @(
        'check', "phase6_source:$bucket", "phase6_dest:$bucket",
        '--config', $tempConfig, '--one-way', '--size-only'
      ) | Out-Null
      $verified = ($source.count -eq $destAfter.count -and $source.bytes -eq $destAfter.bytes)
    }

    $bucketEvidence += [ordered]@{
      bucket = $bucket
      sourceCount = [long]$source.count
      sourceBytes = [long]$source.bytes
      destinationCountBefore = [long]$destBefore.count
      destinationBytesBefore = [long]$destBefore.bytes
      destinationCountAfter = [long]$destAfter.count
      destinationBytesAfter = [long]$destAfter.bytes
      verified = $verified
    }
  }

  $endedAt = [DateTimeOffset]::Now
  $evidence = [ordered]@{
    schemaVersion = 1
    operation = "phase6_storage_$Mode"
    sourceProjectRef = $sourceProjectRef
    destinationProjectRef = $destProjectRef
    sourceMutation = 0
    productionMutation = 0
    destructiveOperation = $false
    startedAt = $startedAt.ToString('o')
    endedAt = $endedAt.ToString('o')
    elapsedSeconds = [math]::Round(($endedAt - $startedAt).TotalSeconds, 3)
    buckets = $bucketEvidence
    result = if (($Mode -eq 'inventory') -or ($bucketEvidence.verified -notcontains $false)) { 'PASS' } else { 'FAIL' }
  }

  $json = $evidence | ConvertTo-Json -Depth 6
  if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
    $resolvedParent = Split-Path -Parent $EvidencePath
    if ($resolvedParent -and -not (Test-Path -LiteralPath $resolvedParent)) {
      New-Item -ItemType Directory -Path $resolvedParent -Force | Out-Null
    }
    [IO.File]::WriteAllText($EvidencePath, $json, [Text.UTF8Encoding]::new($false))
  }
  $json
  if ($evidence.result -ne 'PASS') { exit 1 }
}
finally {
  if (Test-Path -LiteralPath $tempConfig) {
    Remove-Item -LiteralPath $tempConfig -Force
  }
}

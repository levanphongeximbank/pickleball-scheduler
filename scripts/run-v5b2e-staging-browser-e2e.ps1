#requires -Version 5.1
<#
.SYNOPSIS
  V5-B.2E - Reset staging test passwords and run Browser E2E on Vercel Preview.

.DESCRIPTION
  Staging only (qyewbxjsiiyufanzcjcq). Prompts for new passwords interactively.
  Does not persist passwords to disk.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/run-v5b2e-staging-browser-e2e.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$StagingRef = "qyewbxjsiiyufanzcjcq"
$ProductionRef = "expuvcohlcjzvrrauvud"
$PreviewUrl = if ($env:STAGING_PREVIEW_URL) { $env:STAGING_PREVIEW_URL } else { "https://pickleball-scheduler-git-feature-co-769297-pickleball-scheduler.vercel.app" }
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvLocalFile = Join-Path $RepoRoot ".env.staging-qa.local"
$GitIgnoreFile = Join-Path $RepoRoot ".gitignore"

$exitCode = 1
$script:Blocked = $false

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-WithBlocker([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  $script:exitCode = 2
  $script:Blocked = $true
}

function ConvertTo-PlainText([Security.SecureString]$Secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Read-ConfirmedPassword([string]$Prompt) {
  while ($true) {
    $secure1 = Read-Host -AsSecureString "$Prompt"
    $secure2 = Read-Host -AsSecureString "$Prompt (confirm)"
    $plain1 = ConvertTo-PlainText $secure1
    $plain2 = ConvertTo-PlainText $secure2
    if ($plain1 -ne $plain2) {
      Write-Host "Passwords do not match. Try again." -ForegroundColor Yellow
      continue
    }
    if ([string]::IsNullOrWhiteSpace($plain1)) {
      Write-Host "Password cannot be empty." -ForegroundColor Yellow
      continue
    }
    return $plain1
  }
}

function Clear-SensitiveEnv {
  $names = @(
    "STAGING_PLAYER_NEW_PASSWORD",
    "STAGING_NON_COHORT_NEW_PASSWORD",
    "STAGING_PLAYER_PASSWORD",
    "STAGING_NON_COHORT_PASSWORD"
  )
  foreach ($name in $names) {
    if (Test-Path "Env:$name") {
      Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}

function Test-EnvFileHasKey([string[]]$Lines, [string]$Key) {
  foreach ($line in $Lines) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
      return $true
    }
  }
  return $false
}

function Assert-Environment {
  Write-Step "A. Environment guard"

  Set-Location $RepoRoot

  $pkgPath = Join-Path $RepoRoot "package.json"
  if (-not (Test-Path $pkgPath)) {
    Stop-WithBlocker "Not in pickleball-scheduler repository (package.json missing)"
    return
  }
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if ($pkg.name -ne "pickleball-scheduler") {
    Stop-WithBlocker "Unexpected package name: $($pkg.name)"
    return
  }
  Write-Host "Repository: pickleball-scheduler"

  if (-not (Test-Path $EnvLocalFile)) {
    Stop-WithBlocker ".env.staging-qa.local not found"
    return
  }

  if (-not (Test-Path $GitIgnoreFile)) {
    Stop-WithBlocker ".gitignore not found"
    return
  }
  $gitIgnore = Get-Content $GitIgnoreFile -Raw
  if ($gitIgnore -notmatch '\.env\*' -and $gitIgnore -notmatch '\.env\.staging-qa\.local') {
    Stop-WithBlocker ".env.staging-qa.local is not covered by .gitignore"
    return
  }
  Write-Host ".env.staging-qa.local: gitignored (OK)"

  $envLines = Get-Content $EnvLocalFile
  $requiredKeys = @("STAGING_SUPABASE_SERVICE_ROLE_KEY", "STAGING_SUPABASE_ANON_KEY")
  foreach ($key in $requiredKeys) {
    if (-not (Test-EnvFileHasKey $envLines $key)) {
      Stop-WithBlocker ".env.staging-qa.local missing key: $key"
      return
    }
    Write-Host "$key : present (value hidden)"
  }

  $envRaw = Get-Content $EnvLocalFile -Raw
  if ($envRaw -match $ProductionRef) {
    Stop-WithBlocker "Production ref $ProductionRef found in .env.staging-qa.local"
    return
  }

  $stagingUrlLine = $envLines | Where-Object { $_ -match '^\s*STAGING_SUPABASE_URL\s*=' } | Select-Object -First 1
  if ($stagingUrlLine -and $stagingUrlLine -notmatch $StagingRef) {
    Stop-WithBlocker "STAGING_SUPABASE_URL does not reference staging ref $StagingRef"
    return
  }
  Write-Host "Staging ref: $StagingRef (OK)"
  Write-Host "Production ref blocked: $ProductionRef (OK)"
}

function Invoke-PasswordReset {
  Write-Step "C. Reset staging test accounts"
  $output = & node (Join-Path $RepoRoot "scripts/reset-staging-browser-e2e-passwords.mjs") 2>&1
  $text = ($output | Out-String)
  Write-Host $text

  $playerOk = $text -match '\[PASS\]\s+player@staging\.local\s+reset=PASS\s+signIn=PASS'
  $ownerOk = $text -match '\[PASS\]\s+owner-b@staging\.local\s+reset=PASS\s+signIn=PASS'

  if (-not $playerOk -or -not $ownerOk) {
    Stop-WithBlocker "Password reset did not pass for both accounts"
  }
}

function Import-OptionalLocalEnv {
  foreach ($line in Get-Content $EnvLocalFile) {
    $trim = $line.Trim()
    if ($trim -match '^STAGING_PREVIEW_URL\s*=\s*(.+)$' -and -not $env:STAGING_PREVIEW_URL) {
      $value = $matches[1].Trim().Trim('"').Trim("'")
      if ($value) {
        $script:PreviewUrl = $value
      }
    }
    if ($trim -match '^VERCEL_AUTOMATION_BYPASS_SECRET\s*=\s*(.+)$' -and -not $env:VERCEL_AUTOMATION_BYPASS_SECRET) {
      $value = $matches[1].Trim().Trim('"').Trim("'")
      if ($value) {
        $env:VERCEL_AUTOMATION_BYPASS_SECRET = $value
      }
    }
    if ($trim -match '^VERCEL_PROTECTION_BYPASS\s*=\s*(.+)$' -and -not $env:VERCEL_AUTOMATION_BYPASS_SECRET) {
      $value = $matches[1].Trim().Trim('"').Trim("'")
      if ($value) {
        $env:VERCEL_AUTOMATION_BYPASS_SECRET = $value
      }
    }
  }
}

function Set-E2EEnvironment {
  Write-Step "D. Prepare Browser E2E environment"

  Import-OptionalLocalEnv
  $env:STAGING_PLAYER_PASSWORD = $env:STAGING_PLAYER_NEW_PASSWORD
  $env:STAGING_NON_COHORT_PASSWORD = $env:STAGING_NON_COHORT_NEW_PASSWORD
  $env:STAGING_PLAYER_EMAIL = "player@staging.local"
  $env:STAGING_NON_COHORT_EMAIL = "owner-b@staging.local"
  $env:STAGING_SUPABASE_PROJECT_REF = $StagingRef
  $env:STAGING_PREVIEW_URL = $PreviewUrl
  $env:HEADLESS = if ($env:HEADLESS) { $env:HEADLESS } else { "true" }

  if ($env:VERCEL_AUTOMATION_BYPASS_SECRET) {
    Write-Host "VERCEL_AUTOMATION_BYPASS_SECRET: set (value hidden)"
  }
  elseif ($env:VERCEL_PROTECTION_BYPASS) {
    $env:VERCEL_AUTOMATION_BYPASS_SECRET = $env:VERCEL_PROTECTION_BYPASS
    Write-Host "VERCEL_PROTECTION_BYPASS: set (value hidden)"
  }
  else {
    Write-Host "VERCEL_AUTOMATION_BYPASS_SECRET: not set (OK if Preview has no Deployment Protection)"
  }

  Write-Host "STAGING_PREVIEW_URL: $PreviewUrl"
  Write-Host "STAGING_PLAYER_EMAIL: player@staging.local"
  Write-Host "STAGING_NON_COHORT_EMAIL: owner-b@staging.local"
}

function Invoke-PreviewPreflight {
  Write-Step "E. Preview pre-flight"
  & node (Join-Path $RepoRoot "scripts/probe-v5b2-preview-preflight.mjs")
  if ($LASTEXITCODE -ne 0) {
    Stop-WithBlocker "V5 PREVIEW OR FEATURE FLAG NOT READY"
  }
}

function Ensure-PlaywrightChromium {
  Write-Step "F1. Playwright Chromium"
  $playwrightPkg = Join-Path $RepoRoot "node_modules/playwright/package.json"
  if (-not (Test-Path $playwrightPkg)) {
    Write-Host "Installing playwright..."
    & npm install -D playwright
    if ($LASTEXITCODE -ne 0) {
      Stop-WithBlocker "npm install playwright failed"
    }
  }
  & npx playwright install chromium
  if ($LASTEXITCODE -ne 0) {
    Stop-WithBlocker "playwright install chromium failed"
  }
  Write-Host "Chromium: ready"
}

function Invoke-BrowserE2E {
  Write-Step "F2. Run Browser E2E (14 tests)"
  & npm run qa:v5b2:browser
  return $LASTEXITCODE
}

function Update-DocsIfPass {
  param([int]$E2EExitCode)
  if ($E2EExitCode -ne 0) {
    Write-Host "Skipping doc update - E2E did not pass"
    return
  }
  Write-Step "G. Update documentation"
  & node (Join-Path $RepoRoot "scripts/update-v5b2-browser-e2e-docs.mjs")
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Doc update reported incomplete pass" -ForegroundColor Yellow
  }
}

try {
  Assert-Environment
  if ($Blocked) { return }
  Import-OptionalLocalEnv

  Write-Step "B. Secure password input"
  Write-Host "Enter NEW passwords for staging Browser E2E (not saved to disk)."
  $playerPassword = Read-ConfirmedPassword "New password for player@staging.local"
  $ownerPassword = Read-ConfirmedPassword "New password for owner-b@staging.local"
  $env:STAGING_PLAYER_NEW_PASSWORD = $playerPassword
  $env:STAGING_NON_COHORT_NEW_PASSWORD = $ownerPassword

  Invoke-PasswordReset
  if ($Blocked) { return }
  Set-E2EEnvironment
  Invoke-PreviewPreflight
  if ($Blocked) { return }
  Ensure-PlaywrightChromium
  if ($Blocked) { return }
  $e2eCode = Invoke-BrowserE2E
  Update-DocsIfPass -E2EExitCode $e2eCode

  if ($e2eCode -eq 0) {
    $exitCode = 0
    Write-Host ""
    Write-Host "BROWSER E2E: 14/14 PASS" -ForegroundColor Green
    Write-Host "READY FOR SHADOW PILOT: YES"
  }
  elseif ($e2eCode -eq 2) {
    $exitCode = 2
    Write-Host ""
    Write-Host "BROWSER E2E: BLOCKED" -ForegroundColor Yellow
    Write-Host "READY FOR SHADOW PILOT: NO"
  }
  else {
    $exitCode = 1
    Write-Host ""
    Write-Host "BROWSER E2E: FAIL" -ForegroundColor Red
    Write-Host "READY FOR SHADOW PILOT: NO"
  }
}
catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $exitCode = 1
}
finally {
  Write-Step "H. Clear sensitive environment variables"
  Clear-SensitiveEnv
  Write-Host "Sensitive password env vars cleared."
}

exit $exitCode

# Deploy Pickleball Scheduler Pro len Vercel (Windows PowerShell)
# Chay trong thu muc goc du an:  .\scripts\deploy-vercel.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== Pickleball Scheduler Pro - Deploy Vercel ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Chua cai Node.js. Tai tai https://nodejs.org"
}

Write-Host "`n1) Kiem tra dang nhap Vercel..." -ForegroundColor Yellow
npx vercel whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "Chua dang nhap. Chay: npx vercel login" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".vercel\project.json")) {
  Write-Host "`n2) Lien ket project Vercel (lan dau)..." -ForegroundColor Yellow
  npx vercel link
}

Write-Host "`n3) Build production..." -ForegroundColor Yellow
if (Test-Path ".env.production.local") {
  Write-Host "   Dung bien moi truong tu .env.production.local"
}
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n4) Deploy len Vercel (production)..." -ForegroundColor Yellow
npx vercel deploy --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nXong! Mo Vercel Dashboard de dat bien VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY neu chua co." -ForegroundColor Green
Write-Host "Huong dan chi tiet: docs/DEPLOY.md" -ForegroundColor Green

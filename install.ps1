# install.ps1 — Prototype Playground installer for Windows (PowerShell)
# Right-click → "Run with PowerShell" to execute

Write-Host ""
Write-Host "Setting up Prototype Playground..." -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ──────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required. Opening nodejs.org..." -ForegroundColor Yellow
  Start-Process "https://nodejs.org"
  Write-Host ""
  Write-Host "Install Node.js, then right-click install.ps1 and run it again."
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "OK  Node.js $(node -v)" -ForegroundColor Green

# ── Check Git ──────────────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is required. Opening download page..." -ForegroundColor Yellow
  Start-Process "https://git-scm.com/download/win"
  Write-Host ""
  Write-Host "Install Git, then right-click install.ps1 and run it again."
  Read-Host "Press Enter to exit"
  exit 1
}

$gitVer = (git --version).Split(" ")[2]
Write-Host "OK  Git $gitVer" -ForegroundColor Green

# ── Clone or update ────────────────────────────────────────────────────────────
$dest = Join-Path $env:USERPROFILE "Documents\prototype-playground"

if (Test-Path $dest) {
  Write-Host ""
  Write-Host "Folder already exists — pulling latest changes..."
  git -C $dest pull
} else {
  Write-Host ""
  Write-Host "Downloading Prototype Playground..."
  git clone https://github.com/jose-huge/prototype-playground.git $dest
}

# ── Install dependencies ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies (this takes about 30-60 seconds)..."
Push-Location $dest
npm install
Pop-Location

# ── Check port 3000 ───────────────────────────────────────────────────────────
$portInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
  Write-Host ""
  Write-Host "Port 3000 is already in use, so the playground can't start." -ForegroundColor Yellow
  Write-Host "If it's another playground instance, open http://localhost:3000?reset=true"
  Write-Host "Otherwise, stop whatever is using port 3000 and run this script again."
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}

# ── Start dev server ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Starting Prototype Playground..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$dest`" && npm run dev > .dev.log 2>&1" -WindowStyle Hidden

# ── Open browser ─────────────────────────────────────────────────────────────
Write-Host "Waiting for server to start..."
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000?reset=true"

Write-Host ""
Write-Host "OK  Prototype Playground is running at localhost:3000" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"

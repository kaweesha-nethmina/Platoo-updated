# Platoo - local dev launcher for Windows (no Docker)
# Runs: Redis + backend services + Next.js frontend
# Usage: powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Stop:  press Ctrl-C
#
# NOTE: only processes started by THIS script are stopped on exit.
# It never kills unrelated node/npm processes on your machine.

$ErrorActionPreference = "Stop"

$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend\platoo-client"
$LOGS = Join-Path $ROOT "logs"
New-Item -ItemType Directory -Force -Path $LOGS | Out-Null

# All Node backend services (order matters only for readability)
$SERVICES = @(
  "user-service",
  "menu-service",
  "search-service",
  "delevery-service",
  "cart-service",
  "geo-location-service",
  "order-service",
  "ratings-service",
  "admin-service",
  "notification-service"
)

$PIDS = @()
$RedisPid = $null

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-PortInUse {
  param([int]$Port)
  try {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  } catch { return $false }
}

function Stop-Services {
  Write-Host ""
  Write-Host "=== Stopping all services started by this script ==="
  foreach ($pidToKill in @($PIDS)) {
    try {
      & taskkill.exe /PID $pidToKill /T /F 2>&1 | Out-Null
    } catch {}
  }
  if ($RedisPid) {
    try {
      & taskkill.exe /PID $RedisPid /T /F 2>&1 | Out-Null
      Write-Host "[redis] stopped"
    } catch {}
  }
  $PIDS = @()
}

try {
  # Prereqs
  if (-not (Test-CommandExists "node")) { Write-Host "ERROR: node not found" -ForegroundColor Red; exit 1 }
  if (-not (Test-CommandExists "npm")) { Write-Host "ERROR: npm not found" -ForegroundColor Red; exit 1 }

  # Redis
  if (Test-PortInUse 6379) {
    Write-Host "[redis] already running on 6379"
  }
  elseif (Test-CommandExists "redis-server") {
    Write-Host "[redis] starting on 6379..."
    $r = Start-Process -FilePath "redis-server" -ArgumentList "--port","6379" -WindowStyle Hidden -PassThru
    $RedisPid = $r.Id
    Start-Sleep -Seconds 1
  }
  elseif (Get-Service -Name "Memurai" -ErrorAction SilentlyContinue) {
    Write-Host "[redis] starting Memurai service..."
    Start-Service -Name "Memurai" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  else {
    Write-Host "[redis] WARNING: no Redis server found -> ratings-service may fail." -ForegroundColor Yellow
  }

  # Backend
  foreach ($svc in $SERVICES) {
    $dir = Join-Path $BACKEND $svc
    if (-not (Test-Path (Join-Path $dir "node_modules"))) {
      Write-Host "[$svc] installing dependencies..."
      Push-Location $dir
      try { npm install --no-audit --no-fund --silent } finally { Pop-Location }
    }
    Write-Host "[$svc] starting..."
    $log = Join-Path $LOGS "$svc.log"
    $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev >> `"$log`" 2>&1" -WorkingDirectory $dir -WindowStyle Hidden -PassThru
    $PIDS += $p.Id
  }

  # Frontend
  if (-not (Test-Path (Join-Path $FRONTEND "node_modules"))) {
    Write-Host "[frontend] installing dependencies..."
    Push-Location $FRONTEND
    try { npm install --no-audit --no-fund --legacy-peer-deps --silent } finally { Pop-Location }
  }
  Write-Host "[frontend] starting on http://localhost:3000 ..."
  $flog = Join-Path $LOGS "frontend.log"
  $fp = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev >> `"$flog`" 2>&1" -WorkingDirectory $FRONTEND -WindowStyle Hidden -PassThru
  $PIDS += $fp.Id

  Write-Host ""
  Write-Host "==========================================================================="
  Write-Host " Platoo is starting..."
  Write-Host " Frontend : http://localhost:3000"
  Write-Host " Backend  : user 4000 | menu 3001 | search 3002 | delivery 3003 | cart 3005"
  Write-Host "            geo-location 3007 | order 3008 | ratings 5000 | admin 4005"
  Write-Host "            notification 4006"
  Write-Host " Logs     : $LOGS  (Get-Content logs\<service>.log -Wait to tail)"
  Write-Host " Stop     : press Ctrl-C (stops only what this script started)"
  Write-Host "==========================================================================="
  Write-Host ""

  while ($true) { Start-Sleep -Seconds 1 }
}
finally {
  Stop-Services
}
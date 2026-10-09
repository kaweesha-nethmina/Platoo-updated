# Platoo - local dev launcher for Windows (no Docker)
# Runs: Redis + backend services + Next.js frontend
# Usage: powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Stop:  press Ctrl-C

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

function Stop-Services {
  Write-Host ""
  Write-Host "=== Stopping all services ==="
  foreach ($proc in Get-Process -Name "node" -ErrorAction SilentlyContinue) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}

function Test-PortInUse {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

try {
  # ---------------------------------------------------------------------------
  # 1. Redis (required by ratings-service) - supports redis-server OR Memurai
  # ---------------------------------------------------------------------------
  if (Test-PortInUse 6379) {
    Write-Host "[redis] already running on 6379"
  }
  elseif (Get-Command redis-server -ErrorAction SilentlyContinue) {
    Write-Host "[redis] starting on 6379..."
    Start-Process -FilePath "redis-server" -ArgumentList "--port","6379" -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 1
  }
  elseif (Get-Service -Name "Memurai" -ErrorAction SilentlyContinue) {
    Write-Host "[redis] starting Memurai service..."
    Start-Service -Name "Memurai" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  else {
    Write-Host "[redis] WARNING: no Redis server found (redis-server / Memurai) -> ratings-service will fail."
  }

  # ---------------------------------------------------------------------------
  # 2. Backend services
  # ---------------------------------------------------------------------------
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

  # ---------------------------------------------------------------------------
  # 3. Frontend (Next.js on port 3000)
  # ---------------------------------------------------------------------------
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
  Write-Host " Logs     : $LOGS"
  Write-Host " Stop     : press Ctrl-C"
  Write-Host "==========================================================================="

  while ($true) { Start-Sleep -Seconds 1 }
}
finally {
  Stop-Services
}
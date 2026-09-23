#!/usr/bin/env bash
###############################################################################
# Platoo - local dev launcher (no Docker)
# Runs: Redis + 11 backend services + Next.js frontend
# Usage: ./start-all.sh
# Stop:  press Ctrl-C
###############################################################################
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend/platoo-client"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"

# All Node backend services (order matters only for readability)
SERVICES=(user-service menu-service search-service delevery-service cart-service geo-location-service order-service ratings-service admin-service notification-service)

# Ports our stack listens on (plus frontend 3000 and payment 8081). Used to sweep
# stale processes from a previous run, because killing the npm/mvn wrapper does NOT
# kill the nodemon/ts-node-dev/next children it spawned.
APP_PORTS=(3000 3001 3002 3003 3005 3007 3008 5000 4000 4005 4006 8081)

PIDS=()

kill_leftovers() {
  local pids quiet
  quiet="${1:-}"
  for port in "${APP_PORTS[@]}"; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      [ -z "$quiet" ] && echo "  port $port busy -> killing: $(echo "$pids" | tr '\n' ' ')"
      kill $pids 2>/dev/null || true
    fi
  done
  # Stray watchers that haven't bound a port yet (scoped to this repo's backend tree)
  pkill -f "$BACKEND/" 2>/dev/null || true
  pkill -f "ts-node-dev" 2>/dev/null || true  # dev-machine assumption: only been this repo
  pkill -f "nodemon" 2>/dev/null || true
  [ -z "$quiet" ] && sleep 1 || sleep 0
}

cleanup() {
  echo ""
  echo "=== Stopping all services ==="
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  pkill -P $$ 2>/dev/null || true
  echo "=== Removing stale watcher children / freeing ports ==="
  kill_leftovers quiet
  echo "Done."
  exit 0
}
trap cleanup INT TERM

# ----------------------------------------------------------------------------
# 0. Kill leftover services from a previous run (Ctrl-C used to orphan them)
# ----------------------------------------------------------------------------
echo "=== Stopping leftover services from previous runs ==="
kill_leftovers

# ----------------------------------------------------------------------------
# 1. Redis (required by ratings-service)
# ----------------------------------------------------------------------------
if command -v redis-server >/dev/null 2>&1; then
  if ! pgrep -x redis-server >/dev/null; then
    echo "[redis] starting on 6379..."
    redis-server --daemonize yes --port 6379
    sleep 1
  else
    echo "[redis] already running"
  fi
else
  echo "[redis] WARNING: redis-server not found -> ratings-service will fail. Install with: brew install redis"
fi

# ----------------------------------------------------------------------------
# 2. Backend services
# ----------------------------------------------------------------------------
for svc in "${SERVICES[@]}"; do
  dir="$BACKEND/$svc"
  if [ ! -d "$dir/node_modules" ]; then
    echo "[$svc] installing dependencies..."
    (cd "$dir" && npm install --no-audit --no-fund --silent)
  fi
  echo "[$svc] starting..."
  (cd "$dir" && npm run dev) >> "$LOGS/$svc.log" 2>&1 &
  PIDS+=("$!")
done

# ----------------------------------------------------------------------------
# 3. Frontend (Next.js on port 3000)
# ----------------------------------------------------------------------------
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "[frontend] installing dependencies..."
  (cd "$FRONTEND" && npm install --no-audit --no-fund --legacy-peer-deps --silent)
fi
echo "[frontend] starting on http://localhost:3000 ..."
(cd "$FRONTEND" && npm run dev) >> "$LOGS/frontend.log" 2>&1 &
PIDS+=("$!")

# ----------------------------------------------------------------------------
# 4. payment-service (Spring Boot on port 8081)
#    Note: Spring Boot does NOT auto-load .env, so export it from payment-service/.env
# ----------------------------------------------------------------------------
PAYMENT="$BACKEND/payment-service"
echo "[payment-service] starting on 8081..."
(
  cd "$PAYMENT" || exit 1
  if [ -f .env ]; then
    set -a
    . ./.env
    set +a
  fi
  if command -v mvn >/dev/null 2>&1; then
    mvn -o spring-boot:run
  else
    echo "[payment-service] ERROR: mvn not found on PATH" >&2
    exit 1
  fi
) >> "$LOGS/payment-service.log" 2>&1 &
PIDS+=("$!")

echo ""
echo "==========================================================================="
echo " Platoo is starting..."
echo " Frontend : http://localhost:3000"
echo " Backend  : user 4000 | menu 3001 | search 3002 | delivery 3003 | cart 3005"
echo "            geo-location 3007 | order 3008 | payment 8081 | ratings 5000"
echo "            admin 4005 | notification 4006"
echo " Logs     : $LOGS  (tail -f logs/<service>.log)"
echo " Stop     : press Ctrl-C"
echo "==========================================================================="

wait
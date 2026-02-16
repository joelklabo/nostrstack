#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo "[dev] $*" >&2; }
err() { echo "[dev] ERROR: $*" >&2; }

API_PORT=3001
SOCIAL_PORT=4173
PG_URL="postgresql://nostrstack:nostrstack@localhost:5432/nostrstack"
BITCOIND_RPC="http://bitcoin:bitcoin@localhost:18443"
LNBITS_URL="http://localhost:15001"

get_or_create_wallet() {
  local super_key
  super_key=$(docker exec regtest-lnbits-1 cat /data/.super_user 2>/dev/null || echo "")
  if [[ -z "$super_key" ]]; then
    err "Could not get LNbits super_user key"
    exit 1
  fi
  
  local wallet_info
  wallet_info=$(curl -s "http://localhost:15001/api/v1/wallet" -H "X-Api-Key: $super_key" 2>/dev/null || echo "")
  
  if echo "$wallet_info" | grep -q '"adminkey"'; then
    echo "$wallet_info" | grep -o '"adminkey":"[^"]*"' | cut -d'"' -f4
    return
  fi
  
  log "Creating LNbits wallet..."
  wallet_info=$(curl -s -X POST "http://localhost:15001/api/v1/account" \
    -H "X-Api-Key: $super_key" \
    -H "Content-Type: application/json" \
    -d '{"username": "dev", "password": "dev"}' 2>/dev/null || echo "")
  
  if echo "$wallet_info" | grep -q '"adminkey"'; then
    echo "$wallet_info" | grep -o '"adminkey":"[^"]*"' | cut -d'"' -f4
  else
    err "Failed to create LNbits wallet: $wallet_info"
    exit 1
  fi
}

check_services() {
  log "Checking required services..."
  
  if ! docker info >/dev/null 2>&1; then
    err "Docker is not running"; exit 1
  fi
  
  for container in regtest-bitcoind-1 regtest-lnbits-1 nostrstack-postgres-1; do
    if ! docker ps --format '{{.Names}}' | grep -q "^$container$"; then
      err "Container $container is not running"; exit 1
    fi
  done
  
  if ! curl -s -u bitcoin:bitcoin -d '{"jsonrpc":"1.0","method":"getblockcount"}' -H 'Content-Type: application/json' http://localhost:18443 | grep -q result; then
    err "Bitcoin RPC not responding"; exit 1
  fi
  
  if ! docker exec nostrstack-postgres-1 pg_isready -U nostrstack >/dev/null 2>&1; then
    err "Postgres not ready"; exit 1
  fi
  
  log "All services running"
}

write_env_files() {
  local lnbits_key="$1"
  log "Writing .env.local files..."
  
  cat > "$ROOT/apps/api/.env.local" << EOF
NODE_ENV=development
PORT=$API_PORT
DATABASE_URL=$PG_URL
LIGHTNING_PROVIDER=lnbits
LN_BITS_URL=$LNBITS_URL
LN_BITS_API_KEY=$lnbits_key
BITCOIND_RPC_URL=$BITCOIND_RPC
TELEMETRY_PROVIDER=bitcoind
BITCOIN_NETWORK=regtest
PUBLIC_ORIGIN=http://localhost:$API_PORT
ENABLE_REGTEST_PAY=true
ENABLE_REGTEST_FUND=true
LOG_LEVEL=info
EOF

  cat > "$ROOT/apps/social/.env.local" << EOF
VITE_API_BASE_URL=http://localhost:$API_PORT
VITE_NOSTRSTACK_HOST=localhost:$API_PORT
VITE_NOSTRSTACK_RELAYS=wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol
VITE_ENABLE_REGTEST_PAY=true
VITE_NETWORK=regtest
EOF

  log "Environment files written"
}

run_migrations() {
  log "Running database migrations..."
  cd "$ROOT"
  DATABASE_URL="$PG_URL" pnpm --filter api exec prisma db push --skip-generate >/dev/null 2>&1 || true
  log "Migrations complete"
}

cleanup() {
  log "Cleaning up existing processes..."
  local pids
  pids=$(ss -tlnp 2>/dev/null | grep -E ":$API_PORT|:$SOCIAL_PORT" | grep -oP 'pid=\K[0-9]+' | sort -u || true)
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
}

start_servers() {
  log "Starting API and social app..."
  log "  API:     http://localhost:$API_PORT"
  log "  Social: http://localhost:$SOCIAL_PORT"
  log "  LNbits:  $LNBITS_URL"
  log ""
  log "Press Ctrl+C to stop"
  log "========================================"
  
  cd "$ROOT"
  exec pnpm exec concurrently \
    --kill-others \
    --names "api,social" \
    --prefix-colors "blue,magenta" \
    --prefix "[{name}]" \
    "pnpm --filter api exec tsx watch src/server.ts" \
    "pnpm --filter social dev -- --host --port $SOCIAL_PORT --strictPort"
}

main() {
  check_services
  local lnbits_key
  lnbits_key="$(get_or_create_wallet)"
  log "LNbits wallet admin key: $lnbits_key"
  write_env_files "$lnbits_key"
  run_migrations
  cleanup
  start_servers
}

main

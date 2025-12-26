#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT/.logs/dev"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
GALLERY_LOG="$LOG_DIR/gallery.log"
: >"$API_LOG"
: >"$GALLERY_LOG"

echo "🪵 writing logs to $LOG_DIR (api.log, gallery.log)"
echo "💡 view live: tail -f $API_LOG $GALLERY_LOG"
if [[ "${LOG_TAIL:-1}" != "0" ]]; then
  echo "👀 auto-following logs (set LOG_TAIL=0 to disable)"
  tail -F "$API_LOG" "$GALLERY_LOG" &
  TAIL_PID=$!
  trap 'kill $TAIL_PID >/dev/null 2>&1 || true' EXIT
fi

cd "$ROOT"

# Default to one secure origin for dev
export USE_HTTPS="${USE_HTTPS:-true}"
export HTTPS_CERT="${HTTPS_CERT:-$ROOT/certs/dev-cert.pem}"
export HTTPS_KEY="${HTTPS_KEY:-$ROOT/certs/dev-key.pem}"
export PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://localhost:3001}"
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
export LIGHTNING_PROVIDER="${LIGHTNING_PROVIDER:-lnbits}"
export ENABLE_REGTEST_PAY="${ENABLE_REGTEST_PAY:-true}"
export ENABLE_REGTEST_FUND="${ENABLE_REGTEST_FUND:-true}"
export ENABLE_LNURL_WITHDRAW="${ENABLE_LNURL_WITHDRAW:-true}"
export ENABLE_BOLT12="${ENABLE_BOLT12:-true}"
export BOLT12_PROVIDER="${BOLT12_PROVIDER:-mock}"
export PORT="${PORT:-3001}"
export DEV_SERVER_PORT="${DEV_SERVER_PORT:-4173}"

if [[ ! -f "$HTTPS_CERT" || ! -f "$HTTPS_KEY" || "${REGEN_CERTS:-0}" == "1" ]]; then
  echo "🔐 generating self-signed dev certs with SAN=localhost at $HTTPS_CERT / $HTTPS_KEY"
  mkdir -p "$(dirname "$HTTPS_CERT")"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$HTTPS_KEY" -out "$HTTPS_CERT" \
    -subj "/CN=localhost" -days 365 \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" >/tmp/dev-cert.log 2>&1 || true
else
  echo "🔐 using existing certs at $HTTPS_CERT / $HTTPS_KEY"
fi

check_port() {
  local port="$1"
  if lsof -i :"$port" >/dev/null 2>&1; then
    if [[ "${FORCE_KILL_PORTS:-0}" == "1" ]]; then
      echo "⚠️  port $port in use; FORCE_KILL_PORTS=1, terminating owner..." >&2
      lsof -i :"$port" -t | xargs -r kill
      sleep 1
    else
      echo "⚠️  port $port already in use. Stop the other process or rerun with FORCE_KILL_PORTS=1." >&2
      exit 1
    fi
  fi
}

check_port "$PORT"
check_port "$DEV_SERVER_PORT"

echo "🧬 applying Prisma migrations"
pnpm --filter api exec prisma migrate deploy --schema "$ROOT/apps/api/prisma/schema.prisma"

# Start regtest stack (bitcoind + LND + LNbits) and export LNbits admin key for dev
if command -v docker >/dev/null 2>&1; then
  echo "🚀 starting regtest stack (docker compose)"
  ./scripts/regtest-lndbits.sh up >/tmp/lnbits-up.log 2>&1 || true

  echo "🔑 ensuring LNbits superuser (admin/changeme)"
  curl -s -o /dev/null -X PUT http://localhost:15001/api/v1/auth/first_install \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"changeme","password_repeat":"changeme"}' || true

  ADMIN_COOKIE=$(mktemp)
  curl -s -c "$ADMIN_COOKIE" -X POST http://localhost:15001/api/v1/auth \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"changeme"}' >/dev/null || true
  ADMIN_JSON=$(curl -s -b "$ADMIN_COOKIE" http://localhost:15001/api/v1/wallets)
  ADMIN_KEY=$(printf '%s' "$ADMIN_JSON" | jq -r '.[0].adminkey // empty')
  WALLET_ID=$(printf '%s' "$ADMIN_JSON" | jq -r '.[0].id // empty')
  rm -f "$ADMIN_COOKIE"

  if [[ -n "$ADMIN_KEY" ]]; then
    export LN_BITS_URL=${LN_BITS_URL:-http://localhost:15001}
    export LN_BITS_API_KEY=${LN_BITS_API_KEY:-$ADMIN_KEY}
    export VITE_LNBITS_URL=${VITE_LNBITS_URL:-http://localhost:15001}
    export VITE_LNBITS_ADMIN_KEY=${VITE_LNBITS_ADMIN_KEY:-$ADMIN_KEY}
    [[ -n "$WALLET_ID" ]] && export VITE_LNBITS_WALLET_ID=${VITE_LNBITS_WALLET_ID:-$WALLET_ID}
    echo "✅ LNbits admin key exported"
  else
    echo "⚠️ could not fetch LNbits admin key; check http://localhost:15001" >&2
  fi
else
  echo "⚠️ docker not found; skipping regtest stack startup" >&2
fi

pnpm concurrently -k -p "[{name} {time}]" -n api,gallery \
  "pnpm --filter api dev | tee -a $API_LOG" \
  "pnpm --filter gallery dev -- --host --port $DEV_SERVER_PORT | tee -a $GALLERY_LOG"

echo "🧭 Reminder: verify UI changes with Chrome DevTools MCP (check console & network) and keep the tails above running while you test."

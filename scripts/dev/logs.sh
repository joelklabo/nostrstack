#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$ROOT/.logs/dev"
source "$ROOT/scripts/dev/session-manager.sh"

# Suppress "NO_COLOR env is ignored due to FORCE_COLOR" warnings
unset NO_COLOR

PORT_WAS_SET=0
DEV_SERVER_PORT_WAS_SET=0
if [[ -v PORT ]]; then
  PORT_WAS_SET=1
fi
if [[ -v DEV_SERVER_PORT ]]; then
  DEV_SERVER_PORT_WAS_SET=1
fi

mkdir -p "$LOG_DIR"
mkdir -p "$NOSTRDEV_SESSION_DIR"
API_LOG="$LOG_DIR/api.log"
SOCIAL_LOG="$LOG_DIR/social.log"
: >"$API_LOG"
: >"$SOCIAL_LOG"

echo "🪵 writing logs to $LOG_DIR (api.log, social.log)"
echo "💡 view live: tail -f $API_LOG $SOCIAL_LOG"
if [[ "${LOG_TAIL:-1}" != "0" ]]; then
  echo "👀 auto-following logs (set LOG_TAIL=0 to disable)"
  tail -F "$API_LOG" "$SOCIAL_LOG" &
  TAIL_PID=$!
fi

cd "$ROOT"

# Default to HTTP for dev unless explicitly enabled.
export USE_HTTPS="${USE_HTTPS:-false}"
export HTTPS_CERT="${HTTPS_CERT:-$ROOT/certs/dev-cert.pem}"
export HTTPS_KEY="${HTTPS_KEY:-$ROOT/certs/dev-key.pem}"
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
export PRISMA_HIDE_UPDATE_MESSAGE="${PRISMA_HIDE_UPDATE_MESSAGE:-1}"
export LIGHTNING_PROVIDER="${LIGHTNING_PROVIDER:-lnbits}"
export BITCOIN_NETWORK="${BITCOIN_NETWORK:-regtest}"
export VITE_NETWORK="${VITE_NETWORK:-$BITCOIN_NETWORK}"
REGTEST_DEFAULT=false
if [[ "$BITCOIN_NETWORK" == "regtest" ]]; then
  REGTEST_DEFAULT=true
fi
export ENABLE_REGTEST_PAY="${ENABLE_REGTEST_PAY:-$REGTEST_DEFAULT}"
export ENABLE_REGTEST_FUND="${ENABLE_REGTEST_FUND:-$REGTEST_DEFAULT}"
export VITE_ENABLE_REGTEST_PAY="${VITE_ENABLE_REGTEST_PAY:-$REGTEST_DEFAULT}"
export VITE_ENABLE_REGTEST_FUND="${VITE_ENABLE_REGTEST_FUND:-$REGTEST_DEFAULT}"
export ENABLE_LNURL_WITHDRAW="${ENABLE_LNURL_WITHDRAW:-true}"
export ENABLE_BOLT12="${ENABLE_BOLT12:-true}"
export BOLT12_PROVIDER="${BOLT12_PROVIDER:-mock}"
export PORT="${PORT:-3001}"
export DEV_SERVER_PORT="${DEV_SERVER_PORT:-4173}"
export NOSTRDEV_AGENT="${NOSTRDEV_AGENT:-${USER:-agent}}"
if [[ "$PORT_WAS_SET" == "1" && "$DEV_SERVER_PORT_WAS_SET" == "1" ]]; then
  export NOSTRDEV_MANAGED_SESSION="${NOSTRDEV_MANAGED_SESSION:-0}"
else
  export NOSTRDEV_MANAGED_SESSION="${NOSTRDEV_MANAGED_SESSION:-1}"
fi

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

ndev_claim_session
API_SCHEME="http"
if [[ "$USE_HTTPS" == "true" ]]; then
  API_SCHEME="https"
fi
export PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-$API_SCHEME://localhost:$PORT}"
API_BASE_URL="$API_SCHEME://localhost:$PORT"
echo "📦 Dev session: agent=$NOSTRDEV_AGENT slot=${NOSTRDEV_SESSION_SLOT:-manual} api=$PORT social=$DEV_SERVER_PORT"
cleanup_dev_session() {
  ndev_release_session
  if [[ -n "${TAIL_PID:-}" ]]; then
    kill "$TAIL_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup_dev_session EXIT INT TERM

echo "🧬 applying Prisma migrations"
pnpm --filter api exec prisma migrate deploy --schema "$ROOT/apps/api/prisma/schema.prisma"

# Start regtest stack (bitcoind + LND + LNbits) and export LNbits admin key for dev
if [[ "$BITCOIN_NETWORK" == "regtest" ]]; then
  if command -v docker >/dev/null 2>&1; then
    echo "🚀 starting regtest stack (docker compose)"
    ./scripts/regtest/bootstrap-lnbits.sh up >/tmp/lnbits-up.log 2>&1 || true

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
else
  echo "🌐 BITCOIN_NETWORK=$BITCOIN_NETWORK; skipping regtest stack startup"
fi

pnpm concurrently -k -p "[{name} {time}]" -n api,social \
  "pnpm --filter api dev | tee -a $API_LOG" \
  "VITE_API_BASE_URL=$API_BASE_URL \
   VITE_NOSTRSTACK_HOST=localhost:$PORT \
   pnpm --filter social dev -- --host --port $DEV_SERVER_PORT | tee -a $SOCIAL_LOG"

echo "🧭 Reminder: verify UI changes with Chrome DevTools MCP (check console & network) and keep the tails above running while you test."

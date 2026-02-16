#!/usr/bin/env bash
set -euo pipefail

# Unified demo bootstrap script.
MODE="${1:-}"
if [[ -z "${MODE}" ]]; then
  echo "Usage: $0 <regtest|mutinynet|mainnet>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PG_PORT="${PG_PORT:-65432}"
PG_URL="postgres://nostrstack:nostrstack@localhost:${PG_PORT}/nostrstack"
API_PORT="${API_PORT:-3001}"
SOCIAL_PORT="${SOCIAL_PORT:-4173}"
SOCIAL_RELAYS="${VITE_NOSTRSTACK_RELAYS:-wss://relay.damus.io}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

need_cmds() {
  for c in "$@"; do
    need_cmd "$c"
  done
}

log() {
  echo "[${MODE}] $*"
}

require_env_vars() {
  local var
  for var in "$@"; do
    [[ -n "${!var:-}" ]] || { echo "Missing env $var" >&2; exit 1; }
  done
}

show_common_config() {
  echo "  API base:            http://localhost:${API_PORT}"
  echo "  Social:              http://localhost:${SOCIAL_PORT}"
  echo "  Relays:              ${SOCIAL_RELAYS}"
  echo ""
}

ensure_postgres() {
  if ! docker ps --format '{{.Names}}' | grep -q '^nostrstack-postgres$'; then
    log "Starting Postgres on localhost:${PG_PORT} (container: nostrstack-postgres)"
    docker run -d --name nostrstack-postgres --restart unless-stopped \
      -e POSTGRES_USER=nostrstack -e POSTGRES_PASSWORD=nostrstack -e POSTGRES_DB=nostrstack \
      -p "${PG_PORT}:5432" postgres:15 >/dev/null
  else
    log "Postgres container already running; reusing."
  fi

  log "Waiting for Postgres to accept connections..."
  until docker exec nostrstack-postgres pg_isready -U nostrstack >/dev/null 2>&1; do sleep 1; done
}

run_migrations() {
  log "Running Prisma migrations against ${PG_URL}"
  DATABASE_URL="$PG_URL" pnpm --filter api exec prisma migrate deploy --schema prisma/pg/schema.prisma >/dev/null
}

start_stack() {
  local -n env_vars=$1
  env \
    BITCOIN_NETWORK="$MODE" \
    VITE_NETWORK="$MODE" \
    PORT="$API_PORT" \
    DATABASE_URL="$PG_URL" \
    LIGHTNING_PROVIDER=lnbits \
    PUBLIC_ORIGIN="http://localhost:${API_PORT}" \
    VITE_API_BASE_URL="http://localhost:${API_PORT}" \
    VITE_NOSTRSTACK_HOST="localhost:${API_PORT}" \
    VITE_ENABLE_REAL_PAYMENTS=true \
    VITE_LNBITS_URL="${LN_BITS_URL}" \
    VITE_LNBITS_ADMIN_KEY="${LN_BITS_API_KEY}" \
    VITE_NOSTRSTACK_RELAYS="$SOCIAL_RELAYS" \
    "${env_vars[@]}" \
    pnpm exec concurrently -k -n api,social \
      "pnpm --filter api dev" \
      "pnpm --filter social dev -- --host --port ${SOCIAL_PORT}"
}

case "$MODE" in
  regtest)
    need_cmds docker colima pnpm awk

    if ! docker info >/dev/null 2>&1; then
      log "Starting colima..."
      colima start >/dev/null
    fi

    log "Bringing up regtest lightning stack (bitcoind, lnd-merchant, lnd-payer, LNbits)..."
    tmpout="$(mktemp)"
    ./scripts/regtest-lndbits.sh up | tee "$tmpout"
    LN_BITS_API_KEY="$(awk '/Admin key:/ {print $NF}' "$tmpout" | tail -1)"
    rm -f "$tmpout"
    if [[ -z "${LN_BITS_API_KEY:-}" ]]; then
      echo "Failed to capture LNbits admin key from regtest-lndbits.sh output" >&2
      exit 1
    fi
    LN_BITS_URL="http://localhost:15001"

    ensure_postgres
    run_migrations

    log "Seeding demo LNURL user (alice@localhost)"
    DATABASE_URL="$PG_URL" pnpm --filter api exec tsx prisma/seed-dev.ts >/dev/null

    echo "Config:"
    echo "  LNbits UI:              http://localhost:15001"
    echo "  LNbits admin key:       $LN_BITS_API_KEY"
    echo "  Postgres:               $PG_URL"
    show_common_config
    echo ""

    env_vars=(
      ENABLE_REGTEST_PAY=true
      ENABLE_REGTEST_FUND=true
      ENABLE_LNURL_WITHDRAW=true
      ENABLE_BOLT12=true
      BOLT12_PROVIDER=mock
      VITE_ENABLE_LNURL_WITHDRAW=true
      VITE_ENABLE_BOLT12=true
      VITE_ENABLE_TEST_SIGNER=true
    )
    log "Launching API and social app (Ctrl+C to stop)..."
    start_stack env_vars
    ;;

  mutinynet)
    need_cmds docker pnpm
    LN_BITS_URL="${LN_BITS_URL:-https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io}"
    LN_BITS_API_KEY="${LN_BITS_API_KEY:-}"
    if [[ -z "$LN_BITS_API_KEY" ]]; then
      LN_BITS_API_KEY="$(az keyvault secret show --vault-name satoshis-kv-west --name lnbits-api-key --query value -o tsv 2>/dev/null)" || true
    fi
    TELEMETRY_ESPLORA_URL="${TELEMETRY_ESPLORA_URL:-https://mutinynet.com/api}"
    TELEMETRY_PROVIDER="${TELEMETRY_PROVIDER:-esplora}"
    VITE_ENABLE_TEST_SIGNER="${VITE_ENABLE_TEST_SIGNER:-false}"

    require_env_vars LN_BITS_URL LN_BITS_API_KEY TELEMETRY_ESPLORA_URL

    ensure_postgres
    run_migrations

    echo "Config:"
    echo "  LNbits:              $LN_BITS_URL"
    echo "  LNbits admin key:    $LN_BITS_API_KEY"
    echo "  Telemetry provider:  ${TELEMETRY_PROVIDER}"
    echo "  Esplora URL:         ${TELEMETRY_ESPLORA_URL}"
    show_common_config
    echo ""

    VITE_NOSTRSTACK_TIP_LNADDR="${VITE_NOSTRSTACK_TIP_LNADDR:-alice@localhost}"

    env_vars=(
      TELEMETRY_PROVIDER="$TELEMETRY_PROVIDER"
      TELEMETRY_ESPLORA_URL="$TELEMETRY_ESPLORA_URL"
      VITE_ENABLE_TEST_SIGNER="$VITE_ENABLE_TEST_SIGNER"
      VITE_NOSTRSTACK_TIP_LNADDR="$VITE_NOSTRSTACK_TIP_LNADDR"
    )
    start_stack env_vars
    ;;

  mainnet)
    [[ "${MAINNET_DEMO_OK:-}" == "true" ]] || {
      echo "Refusing to start: set MAINNET_DEMO_OK=true to acknowledge mainnet usage." >&2
      exit 1
    }

    require_env_vars LN_BITS_URL LN_BITS_API_KEY TELEMETRY_ESPLORA_URL
    [[ -n "${VITE_NOSTRSTACK_RELAYS:-}" ]] || { echo "Missing env VITE_NOSTRSTACK_RELAYS" >&2; exit 1; }
    SOCIAL_RELAYS="$VITE_NOSTRSTACK_RELAYS"

    TELEMETRY_PROVIDER="${TELEMETRY_PROVIDER:-esplora}"
    ensure_postgres
    run_migrations

    echo "Config:"
    echo "  LNbits:              $LN_BITS_URL"
    echo "  Telemetry provider:  ${TELEMETRY_PROVIDER}"
    echo "  Esplora URL:         ${TELEMETRY_ESPLORA_URL}"
    show_common_config
    echo ""

    env_vars=(
      TELEMETRY_PROVIDER="$TELEMETRY_PROVIDER"
      TELEMETRY_ESPLORA_URL="$TELEMETRY_ESPLORA_URL"
      VITE_ENABLE_TEST_SIGNER=false
    )
    start_stack env_vars
    ;;

  *)
    echo "Unknown mode: ${MODE}" >&2
    echo "Valid modes: regtest, mutinynet, mainnet" >&2
    exit 1
    ;;
esac

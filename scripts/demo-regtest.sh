#!/usr/bin/env bash
set -euo pipefail

# One-command regtest demo bring-up:
# - Starts Colima (docker) if needed
# - Starts regtest bitcoind + LND pair + LNbits (captures admin key)
# - Ensures Postgres on localhost:65432
# - Runs Prisma migrations
# - Launches API + Gallery with regtest envs


PG_PORT="${PG_PORT:-65432}"
PG_URL="postgres://nostrstack:nostrstack@localhost:${PG_PORT}/nostrstack"
API_PORT="${API_PORT:-3001}"
GALLERY_PORT="${GALLERY_PORT:-4173}"
RELAYS="${VITE_NOSTRSTACK_RELAYS:-wss://relay.damus.io}"

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
for c in docker colima pnpm jq awk sed; do need_cmd "$c"; done

log() { echo "[regtest] $*"; }

if ! docker info >/dev/null 2>&1; then
  log "Starting colima..."
  colima start >/dev/null
fi

log "Bringing up regtest lightning stack (bitcoind, lnd-merchant, lnd-payer, LNbits)..."
tmpout="$(mktemp)"
./scripts/regtest-lndbits.sh up | tee "$tmpout"
LNBITS_ADMIN_KEY="$(awk '/Admin key:/ {print $NF}' "$tmpout" | tail -1)"
rm -f "$tmpout"
if [[ -z "${LNBITS_ADMIN_KEY:-}" ]]; then
  echo "Failed to capture LNbits admin key from regtest-lndbits.sh output" >&2
  exit 1
fi

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

log "Running Prisma migrations against ${PG_URL}"
DATABASE_URL="$PG_URL" pnpm --filter api exec prisma migrate deploy --schema prisma/pg/schema.prisma >/dev/null

log "Seeding demo LNURL user (alice@localhost)"
DATABASE_URL="$PG_URL" pnpm --filter api exec tsx prisma/seed-dev.ts >/dev/null

log "Config:"
echo "  LNbits UI:              http://localhost:15001"
echo "  LNbits admin key:       $LNBITS_ADMIN_KEY"
echo "  Postgres:               $PG_URL"
echo "  API base:               http://localhost:${API_PORT}"
echo "  Gallery:                http://localhost:${GALLERY_PORT}"
echo "  Relays:                 ${RELAYS}"

log "Launching API and Gallery (Ctrl+C to stop)..."
env \
  BITCOIN_NETWORK=regtest \
  VITE_NETWORK=regtest \
  PORT="${API_PORT}" \
  DATABASE_URL="$PG_URL" \
  LIGHTNING_PROVIDER=lnbits \
  LN_BITS_URL=http://localhost:15001 \
  LN_BITS_API_KEY="$LNBITS_ADMIN_KEY" \
  ENABLE_REGTEST_PAY=true \
  ENABLE_REGTEST_FUND=true \
  ENABLE_LNURL_WITHDRAW=true \
  ENABLE_BOLT12=true \
  BOLT12_PROVIDER=mock \
  PUBLIC_ORIGIN="http://localhost:${API_PORT}" \
  VITE_API_BASE_URL="http://localhost:${API_PORT}" \
  VITE_NOSTRSTACK_HOST="localhost:${API_PORT}" \
  VITE_ENABLE_REAL_PAYMENTS=true \
  VITE_ENABLE_LNURL_WITHDRAW=true \
  VITE_ENABLE_BOLT12=true \
  VITE_LNBITS_URL=http://localhost:15001 \
  VITE_LNBITS_ADMIN_KEY="$LNBITS_ADMIN_KEY" \
  VITE_ENABLE_TEST_SIGNER=true \
  VITE_NOSTRSTACK_RELAYS="${RELAYS}" \
  pnpm exec concurrently -k -n api,gallery \
    "pnpm --filter api dev" \
    "pnpm --filter gallery dev -- --host --port ${GALLERY_PORT}"

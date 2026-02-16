#!/usr/bin/env bash
set -euo pipefail

# One-command mutinynet demo bring-up:
# - Assumes Voltage mutinynet LND + LNbits endpoints are available
# - Starts Postgres if needed
# - Runs Prisma migrations
# - Launches API + social app with mutinynet envs


PG_PORT="${PG_PORT:-65432}"
PG_URL="postgres://nostrstack:nostrstack@localhost:${PG_PORT}/nostrstack"
API_PORT="${API_PORT:-3001}"
SOCIAL_PORT="${SOCIAL_PORT:-4173}"

# Default to staging LNbits on Azure
LN_BITS_URL="${LN_BITS_URL:-https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io}"
LN_BITS_API_KEY="${LN_BITS_API_KEY:-}"
if [[ -z "$LN_BITS_API_KEY" ]]; then
  LN_BITS_API_KEY="$(az keyvault secret show --vault-name satoshis-kv-west --name lnbits-api-key --query value -o tsv 2>/dev/null)" || true
fi
TELEMETRY_ESPLORA_URL="${TELEMETRY_ESPLORA_URL:-https://mutinynet.com/api}"

require() { [[ -n "${!1:-}" ]] || { echo "Missing env $1" >&2; exit 1; }; }
require LN_BITS_URL
[[ -n "$LN_BITS_API_KEY" ]] || { echo "Missing LN_BITS_API_KEY - set it or ensure az keyvault access" >&2; exit 1; }
require TELEMETRY_ESPLORA_URL
export TELEMETRY_PROVIDER="${TELEMETRY_PROVIDER:-esplora}"
export VITE_NOSTRSTACK_RELAYS="${VITE_NOSTRSTACK_RELAYS:-wss://relay.damus.io}"
export VITE_ENABLE_TEST_SIGNER="${VITE_ENABLE_TEST_SIGNER:-false}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 1; }; }
for c in docker pnpm; do need "$c"; done

echo "[mutinynet] Starting Postgres on localhost:${PG_PORT} if not running..."
if ! docker ps --format '{{.Names}}' | grep -q '^nostrstack-postgres$'; then
  docker run -d --name nostrstack-postgres --restart unless-stopped \
    -e POSTGRES_USER=nostrstack -e POSTGRES_PASSWORD=nostrstack -e POSTGRES_DB=nostrstack \
    -p "${PG_PORT}:5432" postgres:15 >/dev/null
fi
until docker exec nostrstack-postgres pg_isready -U nostrstack >/dev/null 2>&1; do sleep 1; done

echo "[mutinynet] Running Prisma migrations..."
DATABASE_URL="$PG_URL" pnpm --filter api exec prisma migrate deploy --schema prisma/pg/schema.prisma >/dev/null

echo "[mutinynet] Config:"
echo "  LNbits:              $LN_BITS_URL"
echo "  LNbits admin key:    $LN_BITS_API_KEY"
echo "  Telemetry provider:  ${TELEMETRY_PROVIDER}"
echo "  Esplora URL:         ${TELEMETRY_ESPLORA_URL}"
echo "  API base:            http://localhost:${API_PORT}"
echo "  Social:              http://localhost:${SOCIAL_PORT}"
echo "  Relays:              ${VITE_NOSTRSTACK_RELAYS}"

# Default tip address for Support Nostrstack
VITE_NOSTRSTACK_TIP_LNADDR="${VITE_NOSTRSTACK_TIP_LNADDR:-alice@localhost}"

env \
  BITCOIN_NETWORK=mutinynet \
  VITE_NETWORK=mutinynet \
  PORT="${API_PORT}" \
  DATABASE_URL="$PG_URL" \
  TELEMETRY_PROVIDER="$TELEMETRY_PROVIDER" \
  TELEMETRY_ESPLORA_URL="$TELEMETRY_ESPLORA_URL" \
  LIGHTNING_PROVIDER=lnbits \
  LN_BITS_URL="$LN_BITS_URL" \
  LN_BITS_API_KEY="$LN_BITS_API_KEY" \
  PUBLIC_ORIGIN="http://localhost:${API_PORT}" \
  VITE_API_BASE_URL="http://localhost:${API_PORT}" \
  VITE_NOSTRSTACK_HOST="localhost:${API_PORT}" \
  VITE_ENABLE_REAL_PAYMENTS=true \
  VITE_LNBITS_URL="$LN_BITS_URL" \
  VITE_LNBITS_ADMIN_KEY="$LN_BITS_API_KEY" \
  VITE_NOSTRSTACK_RELAYS="$VITE_NOSTRSTACK_RELAYS" \
  VITE_ENABLE_TEST_SIGNER="$VITE_ENABLE_TEST_SIGNER" \
  VITE_NOSTRSTACK_TIP_LNADDR="$VITE_NOSTRSTACK_TIP_LNADDR" \
  pnpm exec concurrently -k -n api,social \
    "pnpm --filter api dev" \
    "pnpm --filter social dev -- --host --port ${SOCIAL_PORT}"

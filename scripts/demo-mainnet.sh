#!/usr/bin/env bash
set -euo pipefail

# Safety-gated mainnet preset (no default values).

if [[ "${MAINNET_DEMO_OK:-}" != "true" ]]; then
  echo "Refusing to start: set MAINNET_DEMO_OK=true to acknowledge mainnet usage." >&2
  exit 1
fi


PG_PORT="${PG_PORT:-65432}"
PG_URL="postgres://nostrstack:nostrstack@localhost:${PG_PORT}/nostrstack"
API_PORT="${API_PORT:-3001}"
GALLERY_PORT="${GALLERY_PORT:-4173}"

require() { [[ -n "${!1:-}" ]] || { echo "Missing env $1" >&2; exit 1; }; }
for var in LN_BITS_URL LN_BITS_API_KEY VITE_NOSTRSTACK_RELAYS TELEMETRY_ESPLORA_URL; do require "$var"; done
export TELEMETRY_PROVIDER="${TELEMETRY_PROVIDER:-esplora}"

echo "[mainnet] Starting Postgres on localhost:${PG_PORT} if not running..."
if ! docker ps --format '{{.Names}}' | grep -q '^nostrstack-postgres$'; then
  docker run -d --name nostrstack-postgres --restart unless-stopped \
    -e POSTGRES_USER=nostrstack -e POSTGRES_PASSWORD=nostrstack -e POSTGRES_DB=nostrstack \
    -p "${PG_PORT}:5432" postgres:15 >/dev/null
fi
until docker exec nostrstack-postgres pg_isready -U nostrstack >/dev/null 2>&1; do sleep 1; done

echo "[mainnet] Running Prisma migrations..."
DATABASE_URL="$PG_URL" pnpm --filter api exec prisma migrate deploy --schema prisma/pg/schema.prisma >/dev/null

echo "[mainnet] Config:"
echo "  LNbits:              $LN_BITS_URL"
echo "  Telemetry provider:  ${TELEMETRY_PROVIDER}"
echo "  Esplora URL:         ${TELEMETRY_ESPLORA_URL}"
echo "  API base:            http://localhost:${API_PORT}"
echo "  Gallery:             http://localhost:${GALLERY_PORT}"
echo "  Relays:              ${VITE_NOSTRSTACK_RELAYS}"

env \
  BITCOIN_NETWORK=mainnet \
  VITE_NETWORK=mainnet \
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
  VITE_ENABLE_TEST_SIGNER=false \
  pnpm exec concurrently -k -n api,social \
    "pnpm --filter api dev" \
    "pnpm --filter social dev -- --host --port ${GALLERY_PORT}"

#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Defaults for demo
# Load local API env if present (provides LN_BITS_API_KEY, DATABASE_URL, etc.)
if [[ -f "apps/api/.env.local" ]]; then
  set -a
# shellcheck disable=SC1091
  source apps/api/.env.local
  set +a
fi

# Load local gallery env if present (provides VITE_* overrides)
if [[ -f "apps/gallery/.env.local" ]]; then
  set -a
# shellcheck disable=SC1091
  source apps/gallery/.env.local
  set +a
fi

: "${PORT:=3001}"
: "${DATABASE_URL:=postgres://nostrstack:nostrstack@localhost:5432/nostrstack}"
: "${LN_BITS_URL:=https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io}"
: "${LN_BITS_API_KEY:=}"
: "${ADMIN_API_KEY:=dev-admin-key}"
: "${VITE_API_BASE_URL:=http://localhost:3001}"
: "${VITE_NOSTRSTACK_HOST:=lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io}"
: "${VITE_ENABLE_REAL_PAYMENTS:=true}"

if [[ -z "$LN_BITS_API_KEY" ]]; then
  # Try to source from existing api env file if present
  if [[ -f "apps/api/.env.local" ]]; then
    LN_BITS_API_KEY=$(grep -E "^LN_BITS_API_KEY=" apps/api/.env.local | cut -d= -f2- || true)
  fi
fi

if [[ -z "$LN_BITS_API_KEY" ]]; then
  echo "LN_BITS_API_KEY is required (admin key from LNbits)." >&2
  exit 1
fi

if [[ "$DATABASE_URL" != file:* ]]; then
  echo "[demo] Starting Postgres via docker compose..."
  docker compose up -d postgres >/dev/null

  echo "[demo] Waiting for Postgres to be ready..."
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U nostrstack >/dev/null 2>&1; then
      echo "[demo] Postgres is ready"
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
      echo "Postgres did not become ready in time" >&2
      exit 1
    fi
  done
else
  echo "[demo] Using SQLite (no Postgres needed)"
fi

# Write local env files if missing
API_ENV="apps/api/.env.local"
if [[ ! -f "$API_ENV" ]]; then
  cat > "$API_ENV" <<EOF
NODE_ENV=development
PORT=$PORT
LOG_LEVEL=info
LIGHTNING_PROVIDER=lnbits
LN_BITS_URL=$LN_BITS_URL
LN_BITS_API_KEY=$LN_BITS_API_KEY
DATABASE_URL=$DATABASE_URL
PUBLIC_ORIGIN=http://localhost:$PORT
ADMIN_API_KEY=$ADMIN_API_KEY
EOF
  echo "[demo] Wrote $API_ENV"
fi

GALLERY_ENV="apps/gallery/.env.local"
if [[ ! -f "$GALLERY_ENV" ]]; then
  cat > "$GALLERY_ENV" <<EOF
VITE_API_BASE_URL=$VITE_API_BASE_URL
VITE_NOSTRSTACK_HOST=$VITE_NOSTRSTACK_HOST
VITE_ENABLE_REAL_PAYMENTS=$VITE_ENABLE_REAL_PAYMENTS
EOF
  echo "[demo] Wrote $GALLERY_ENV"
fi

# Start dev servers
echo "[demo] Starting API on :$PORT and gallery on :4173..."
PORT=$PORT DATABASE_URL=$DATABASE_URL LN_BITS_URL=$LN_BITS_URL LN_BITS_API_KEY=$LN_BITS_API_KEY ADMIN_API_KEY=$ADMIN_API_KEY \
  VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_NOSTRSTACK_HOST=$VITE_NOSTRSTACK_HOST VITE_ENABLE_REAL_PAYMENTS=$VITE_ENABLE_REAL_PAYMENTS \
  LIGHTNING_PROVIDER=${LIGHTNING_PROVIDER:-lnbits} \
  pnpm demo

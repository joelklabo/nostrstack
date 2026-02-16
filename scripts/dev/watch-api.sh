#!/usr/bin/env bash
# Restart API dev server on source changes using entr
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
# shellcheck disable=SC2016
find apps/api/src -type f | entr -r sh -c '
  echo "[entr] restarting API dev";
  cd apps/api && LN_BITS_URL=${LN_BITS_URL:-http://localhost:15001} \
  LN_BITS_API_KEY=${LN_BITS_API_KEY:-changeme} \
  LIGHTNING_PROVIDER=${LIGHTNING_PROVIDER:-lnbits} \
  PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-http://localhost:3001} \
  DATABASE_URL=${DATABASE_URL:-file:./dev.db} \
  pnpm dev
'

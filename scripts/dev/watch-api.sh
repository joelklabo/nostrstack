#!/usr/bin/env bash
# Restart API dev server on source changes using entr
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
source "$root/scripts/dev/session-manager.sh"
NOSTRDEV_SESSION_COMMAND="watch-api"
NOSTRDEV_MANAGED_SESSION="${NOSTRDEV_MANAGED_SESSION:-1}"
ndev_claim_session
trap 'ndev_release_session' EXIT INT TERM
# shellcheck disable=SC2016
find apps/api/src -type f | entr -r sh -c '
  echo "[entr] restarting API dev";
  cd apps/api && PORT='"$PORT"' \
  LN_BITS_URL=${LN_BITS_URL:-http://localhost:15001} \
  LN_BITS_API_KEY=${LN_BITS_API_KEY:-changeme} \
  LIGHTNING_PROVIDER=${LIGHTNING_PROVIDER:-lnbits} \
  PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-http://localhost:'"$PORT"'} \
  DATABASE_URL=${DATABASE_URL:-file:./dev.db} \
  pnpm dev
'

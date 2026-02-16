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
api_protocol="http"
if is_truthy "${USE_HTTPS:-false}"; then
  api_protocol="https"
fi
default_public_origin="$api_protocol://localhost:$PORT"
find apps/api/src -type f | entr -r sh -c '
  echo "[entr] restarting API dev";
  cd apps/api && PORT='"$PORT"' \
  LN_BITS_URL=${LN_BITS_URL:-http://localhost:15001} \
  LN_BITS_API_KEY=${LN_BITS_API_KEY:-changeme} \
  LIGHTNING_PROVIDER=${LIGHTNING_PROVIDER:-lnbits} \
  PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-'"$default_public_origin"'} \
  DATABASE_URL=${DATABASE_URL:-file:./dev.db} \
  pnpm dev
'

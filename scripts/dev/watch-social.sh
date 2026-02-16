#!/usr/bin/env bash
# Restart social dev server on source changes using entr
set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "$root"
source "$root/scripts/dev/session-manager.sh"
NOSTRDEV_SESSION_COMMAND="watch-social"
NOSTRDEV_MANAGED_SESSION="${NOSTRDEV_MANAGED_SESSION:-1}"
ndev_claim_session
trap 'ndev_release_session' EXIT INT TERM

api_protocol="http"
if is_truthy "${USE_HTTPS:-false}"; then
  api_protocol="https"
fi

# shellcheck disable=SC2016
find apps/social/src -type f | entr -r sh -c '
  echo "[entr] restarting social dev";
  cd apps/social && VITE_API_BASE_URL=${VITE_API_BASE_URL:-'"$api_protocol"'://localhost:'"$PORT"'} \
  VITE_NOSTRSTACK_HOST=${VITE_NOSTRSTACK_HOST:-localhost:'"$PORT"'} \
  VITE_NOSTRSTACK_RELAYS=${VITE_NOSTRSTACK_RELAYS:-mock} \
  pnpm dev -- --host --port '"$DEV_SERVER_PORT"'
'

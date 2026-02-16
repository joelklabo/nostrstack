#!/usr/bin/env bash
# Restart social dev server on source changes using entr
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
# shellcheck disable=SC2016
find apps/social/src -type f | entr -r sh -c '
  echo "[entr] restarting social dev";
  cd apps/social && VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:3001} \
  VITE_NOSTRSTACK_HOST=${VITE_NOSTRSTACK_HOST:-localhost:3001} \
  VITE_NOSTRSTACK_RELAYS=${VITE_NOSTRSTACK_RELAYS:-mock} \
  pnpm dev -- --host --port 4173
'

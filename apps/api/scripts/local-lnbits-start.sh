#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not running; start Docker Desktop first" >&2
  exit 1
fi

docker compose -f deploy/lnbits/docker-compose.yml up -d

echo "LNbits should now be reachable at http://localhost:5000"

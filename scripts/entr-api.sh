#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/entr-api.sh is kept for compatibility; use scripts/dev/watch-api.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/watch-api.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/entr-app.sh is kept for compatibility; use scripts/dev/watch-site.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/watch-site.sh" "$@"

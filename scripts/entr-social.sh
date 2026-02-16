#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/entr-social.sh is kept for compatibility; use scripts/dev/watch-social.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/watch-social.sh" "$@"

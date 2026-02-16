#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/dev-logs.sh is kept for compatibility; use scripts/dev/logs.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/logs.sh" "$@"

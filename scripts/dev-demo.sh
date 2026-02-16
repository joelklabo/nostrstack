#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/dev-demo.sh is kept for compatibility; use scripts/dev/launch-local-demo.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/launch-local-demo.sh" "$@"

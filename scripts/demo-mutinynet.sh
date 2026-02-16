#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/demo-mutinynet.sh is kept for compatibility; use scripts/demo/mutinynet.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/demo/mutinynet.sh" "$@"

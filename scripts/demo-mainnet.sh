#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/demo-mainnet.sh is kept for compatibility; use scripts/demo/mainnet.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/demo/mainnet.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/dev-network.sh is kept for compatibility; use scripts/dev/network-switch.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/network-switch.sh" "$@"

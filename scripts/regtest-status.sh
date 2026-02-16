#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/regtest-status.sh is kept for compatibility; use scripts/regtest/status.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/regtest/status.sh" "$@"

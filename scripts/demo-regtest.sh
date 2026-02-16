#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/demo-regtest.sh is kept for compatibility; use scripts/demo/regtest.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/demo/regtest.sh" "$@"

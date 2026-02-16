#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/run-demo.sh is kept for compatibility; use scripts/demo/run.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/demo/run.sh" "$@"

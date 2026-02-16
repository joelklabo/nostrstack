#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/dev-honkbox.sh is kept for compatibility; use scripts/dev/launch-honkbox.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/dev/launch-honkbox.sh" "$@"

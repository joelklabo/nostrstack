#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/lnbits-status.sh is kept for compatibility; use scripts/lnbits/status.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/lnbits/status.sh" "$@"

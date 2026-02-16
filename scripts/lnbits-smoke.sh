#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/lnbits-smoke.sh is kept for compatibility; use scripts/lnbits/smoke.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/lnbits/smoke.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/voltage-setup.sh is kept for compatibility; use scripts/lnbits/setup-voltage.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/lnbits/setup-voltage.sh" "$@"

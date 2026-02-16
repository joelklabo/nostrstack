#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/lnbits-cutover-mainnet.sh is kept for compatibility; use scripts/lnbits/cutover-mainnet.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/lnbits/cutover-mainnet.sh" "$@"

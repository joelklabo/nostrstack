#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/regtest-lndbits.sh is kept for compatibility; use scripts/regtest/bootstrap-lnbits.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/regtest/bootstrap-lnbits.sh" "$@"

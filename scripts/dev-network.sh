#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)

usage() {
  echo "Usage: $0 --network regtest|mutinynet|mainnet" >&2
  exit 1
}

NETWORK=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)
      NETWORK="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$NETWORK" ]]; then
        NETWORK="$1"
        shift
      else
        usage
      fi
      ;;
  esac
done

[[ -n "$NETWORK" ]] || usage

case "$NETWORK" in
  regtest|mutinynet|mainnet) ;;
  *)
    echo "Unsupported network: $NETWORK" >&2
    usage
    ;;
esac

PROFILE="$ROOT/.env.network.$NETWORK"
if [[ -f "$PROFILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROFILE"
  set +a
fi

export BITCOIN_NETWORK="${BITCOIN_NETWORK:-$NETWORK}"
export VITE_NETWORK="${VITE_NETWORK:-$NETWORK}"

if [[ "$NETWORK" == "mainnet" && "${MAINNET_DEMO_OK:-}" != "true" ]]; then
  echo "Refusing to start: set MAINNET_DEMO_OK=true to acknowledge mainnet usage." >&2
  exit 1
fi

if [[ "$NETWORK" != "regtest" ]]; then
  : "${LN_BITS_URL:?Missing LN_BITS_URL for $NETWORK}"
  : "${LN_BITS_API_KEY:?Missing LN_BITS_API_KEY for $NETWORK}"
fi

exec "$ROOT/scripts/dev-logs.sh"

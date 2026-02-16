#!/usr/bin/env bash
set -euo pipefail

# Quick public health probe for LNbits funding backend.
# Usage: LNBITS_URL=https://lnbits.example.com ./scripts/lnbits/status.sh

URL="${LNBITS_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set LNBITS_URL env var (e.g., https://lnbits-stg-west...)" >&2
  exit 1
fi

resp="$(curl -s -w '\n%{http_code}' "$URL/status/health")"
body="$(echo "$resp" | head -n -1)"
code="$(echo "$resp" | tail -n1)"

echo "Status code: $code"
echo "Body: $body"

[[ "$code" == "200" ]] || exit 1

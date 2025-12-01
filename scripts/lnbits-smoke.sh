#!/usr/bin/env bash
set -euo pipefail

# Quick smoke test against an LNbits instance.
# Requirements: curl, jq
#
# Usage:
#   LNBITS_URL=https://lnbits.example.com \
#   LNBITS_ADMIN_KEY=xxxxxxxxxxxxxxxxxxxx \
#     ./scripts/lnbits-smoke.sh [sats]
#
# Default amount: 1000 sats.

AMOUNT="${1:-1000}"
URL="${LNBITS_URL:-}"
KEY="${LNBITS_ADMIN_KEY:-}"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "Set LNBITS_URL and LNBITS_ADMIN_KEY env vars." >&2
  exit 1
fi

echo "Creating $AMOUNT-sat invoice on $URL ..."
resp="$(curl -s -w '\n%{http_code}' -X POST "$URL/api/v1/payments" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"out\":false,\"amount\":$AMOUNT,\"memo\":\"smoke\"}")"

body="$(echo "$resp" | head -n -1)"
code="$(echo "$resp" | tail -n1)"

if [[ "$code" != "200" && "$code" != "201" ]]; then
  echo "Request failed ($code): $body" >&2
  exit 1
fi

hash="$(echo "$body" | jq -r '.payment_hash // empty')"
bolt11="$(echo "$body" | jq -r '.payment_request // empty')"

echo "OK: hash=$hash"
echo "BOLT11: $bolt11"

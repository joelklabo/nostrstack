#!/bin/sh
set -e

# Decode TLS cert and macaroon secrets into files that LndWallet expects.
if [ -n "$LND_GRPC_CERT_B64" ]; then
  echo "$LND_GRPC_CERT_B64" | base64 -d > /tmp/lnd-tls.cert
  export LND_GRPC_CERT=/tmp/lnd-tls.cert
fi

if [ -n "$LND_GRPC_MACAROON_B64" ]; then
  echo "$LND_GRPC_MACAROON_B64" | base64 -d > /tmp/lnd-admin.macaroon
  # Provide hex strings; LndWallet accepts hex.
  MAC_HEX="$(python - <<'PY'
import binascii
data = open('/tmp/lnd-admin.macaroon','rb').read()
print(binascii.hexlify(data).decode(), end="")
PY
)"
  export LND_GRPC_MACAROON="$MAC_HEX"
  export LND_GRPC_ADMIN_MACAROON="$MAC_HEX"
  ls -l /tmp/lnd-admin.macaroon >&2 || true
  wc -c /tmp/lnd-admin.macaroon >&2 || true
fi

if [ -n "$LND_GRPC_MACAROON" ]; then
  printf "ENV LND_GRPC_MACAROON=hex:%.12s...\n" "$LND_GRPC_MACAROON" >&2
else
  echo "ENV LND_GRPC_MACAROON=unset" >&2
fi

# Normalize endpoint: strip scheme and any embedded port.
if [ -n "$LND_GRPC_ENDPOINT" ]; then
  host_only="$(echo "$LND_GRPC_ENDPOINT" | sed 's@^.*://@@' | cut -d: -f1)"
  [ -n "$host_only" ] && export LND_GRPC_ENDPOINT="$host_only"
fi

# If no explicit port, try to read from endpoint host:port form.
if [ -z "$LND_GRPC_PORT" ] && echo "$LND_GRPC_ENDPOINT" | grep -q ':'; then
  export LND_GRPC_PORT="$(echo "$LND_GRPC_ENDPOINT" | cut -d: -f2)"
fi
if [ -z "$LND_GRPC_PORT" ]; then
  export LND_GRPC_PORT=10009
fi

echo "LNbits boot env: LND_GRPC_ENDPOINT=${LND_GRPC_ENDPOINT:-unset} LND_GRPC_PORT=${LND_GRPC_PORT:-unset} PROVIDER=${LNBITS_BACKEND_WALLET_CLASS:-unset}" >&2
if [ -n "$LNBITS_DATABASE_URL" ]; then
  echo "LNbits DB params: ${LNBITS_DATABASE_URL#*\?}" >&2
fi

exec env \
  PYTHONPATH="/app:${PYTHONPATH}" \
  LND_GRPC_ENDPOINT="${LND_GRPC_ENDPOINT}" \
  LND_GRPC_PORT="${LND_GRPC_PORT}" \
  LND_GRPC_CERT="${LND_GRPC_CERT}" \
  LND_GRPC_MACAROON="${LND_GRPC_MACAROON}" \
  LND_GRPC_ADMIN_MACAROON="${LND_GRPC_ADMIN_MACAROON}" \
  LNBITS_BACKEND_WALLET_CLASS="${LNBITS_BACKEND_WALLET_CLASS:-LndWallet}" \
  LNBITS_FUNDING_SOURCE="${LNBITS_FUNDING_SOURCE:-LndWallet}" \
  LNBITS_DATABASE_URL="${LNBITS_DATABASE_URL}" \
  LNBITS_DATA_FOLDER="${LNBITS_DATA_FOLDER:-/data}" \
  uv run lnbits --port "${LNBITS_PORT:-5000}" --host "${LNBITS_HOST:-0.0.0.0}" --forwarded-allow-ips='*'

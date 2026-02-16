#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose -f deploy/regtest/docker-compose.yml"

echo "=== compose ps ==="
$COMPOSE ps

btc() { $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"; }
lnd() {
  local svc="$1"; shift
  local port
  case "$svc" in
    lnd-merchant) port=10009 ;;
    lnd-payer) port=10010 ;;
    *) port=10009 ;;
  esac
  $COMPOSE exec -T "$svc" lncli --network=regtest --lnddir=/data --rpcserver="$svc:$port" --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert "$@"
}

echo
echo "=== chain ==="
btc getblockchaininfo | jq '{height:.blocks, progress:.verificationprogress}'

echo
echo "=== lnd merchant ==="
lnd lnd-merchant getinfo | jq '{alias, synced:.synced_to_chain, uris, pubkey:.identity_pubkey}'
lnd lnd-merchant walletbalance | jq '{onchain:.total_balance}'

echo
echo "=== lnd payer ==="
lnd lnd-payer getinfo | jq '{alias, synced:.synced_to_chain, pubkey:.identity_pubkey}'
lnd lnd-payer walletbalance | jq '{onchain:.total_balance}'

echo
echo "=== channels (payer) ==="
lnd lnd-payer listchannels | jq '{count:(.channels|length), channels:[.channels[] | {remote_pubkey, local:.local_balance, remote:.remote_balance}]}'

echo
echo "=== LNbits health ==="
curl -sf http://localhost:15001/status/health || true

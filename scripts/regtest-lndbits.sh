#!/usr/bin/env bash
set -euo pipefail

# Bring up regtest bitcoind + two LND nodes + LNbits wired to lnd-merchant.
# Idempotent enough for local dev; assumes fresh volumes on first run.

COMPOSE="docker compose -f deploy/regtest/docker-compose.yml"
PASS="regtestpass"
PASS_B64=$(printf "%s" "$PASS" | base64 | tr -d '\n')

host_rest_port() {
  case "$1" in
    lnd-merchant) echo 18080 ;;
    lnd-payer) echo 19080 ;;
    *) echo 18080 ;;
  esac
}

wait_rest() {
  local port
  port=$(host_rest_port "$1")
  until curl -sk "https://localhost:${port}/v1/state" >/dev/null 2>&1; do
    sleep 1
  done
}

maybe_init_wallet() {
  local svc="$1"
  if $COMPOSE exec -T "$svc" test -f /data/data/chain/bitcoin/regtest/admin.macaroon; then
    return 0
  fi
  echo "[+] Creating wallet for $svc via REST"
  wait_rest "$svc"
  local seed port
  port=$(host_rest_port "$svc")
  seed=$(curl -sk "https://localhost:${port}/v1/genseed" | jq -c '.cipher_seed_mnemonic')
  curl -sk -X POST "https://localhost:${port}/v1/initwallet" \
    -H "Content-Type: application/json" \
    -d "{\"wallet_password\":\"${PASS_B64}\",\"cipher_seed_mnemonic\":${seed}}" >/dev/null
}

ensure_unlocked() {
  local svc="$1"
  local port
  port=$(host_rest_port "$svc")
  if $COMPOSE exec -T "$svc" test -f /data/data/chain/bitcoin/regtest/admin.macaroon; then
    :
  else
    maybe_init_wallet "$svc"
  fi
  # attempt unlock via REST (idempotent)
  curl -sk -X POST "https://localhost:${port}/v1/unlockwallet" \
    -H "Content-Type: application/json" \
    -d "{\"wallet_password\":\"${PASS_B64}\"}" >/dev/null 2>&1 || true
}

wait_lnd_ready() {
  local svc="$1"
  until $COMPOSE exec -T "$svc" lncli --network=regtest --lnddir=/data --rpcserver="$svc:$(rpc_port "$svc")" --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert getinfo >/dev/null 2>&1; do
    sleep 2
  done
}

rpc_port() {
  case "$1" in
    lnd-merchant) echo 10009;;
    lnd-payer) echo 10010;;
    *) echo 10009;;
  esac
}

rest_port() {
  case "$1" in
    lnd-merchant) echo 8080;;
    lnd-payer) echo 8081;;
    *) echo 8080;;
  esac
}

wait_for_bitcoind() {
  echo "[+] Waiting for bitcoind..."
  until $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin getblockchaininfo >/dev/null 2>&1; do
    sleep 2
  done
}

ensure_miner_wallet() {
  echo "[+] Ensuring miner wallet exists"
  $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin createwallet miner >/dev/null 2>&1 || true
}

maybe_mine_initial() {
  local height
  height=$($COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin getblockcount)
  if (( height < 101 )); then
    echo "[+] Mining $((101 - height)) blocks to bootstrap chain (current height: $height)"
    mine_blocks $((101 - height))
  else
    echo "[=] Chain already bootstrapped (height $height); skipping initial mine"
  fi
}

mine_blocks() {
  local n="$1"
  local addr
  addr=$($COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner getnewaddress)
  $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner generatetoaddress "$n" "$addr" >/dev/null
}

fund_payer() {
  local balance
  balance=$($COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:$(rpc_port lnd-payer) --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert walletbalance | jq -r '.total_balance | tonumber')
  if (( balance > 200000000 )); then
    echo "[=] Payer already funded (balance: ${balance} sats); skipping onchain top-up"
    return
  fi
  echo "[+] Funding lnd-payer onchain"
  local addr
  addr=$($COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:$(rpc_port lnd-payer) --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert newaddress p2wkh | jq -r '.address')
  $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner sendtoaddress "$addr" 1 >/dev/null
  mine_blocks 6
}

get_pubkey() {
  local svc="$1"
  $COMPOSE exec -T "$svc" lncli --network=regtest --lnddir=/data --rpcserver="$svc:$(rpc_port "$svc")" --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert getinfo | jq -r '.identity_pubkey'
}

connect_nodes() {
  echo "[+] Connecting payer -> merchant"
  local dest_pub
  dest_pub=$(get_pubkey lnd-merchant)
  $COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:$(rpc_port lnd-payer) --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert connect "${dest_pub}@lnd-merchant:9735" >/dev/null 2>&1 || true
}

open_channel() {
  echo "[+] Opening channel payer -> merchant"
  local dest_pub
  dest_pub=$(get_pubkey lnd-merchant)
  # skip if channel already exists
  if $COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:$(rpc_port lnd-payer) --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert listchannels | jq -e --arg pk "$dest_pub" '.channels[] | select(.remote_pubkey==$pk)' >/dev/null; then
    echo "    channel already open"
    return
  fi
  $COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:$(rpc_port lnd-payer) --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert openchannel --node_key="$dest_pub" --local_amt=1000000 --sat_per_vbyte=1 >/dev/null
  mine_blocks 6
}

ensure_lnbits_superuser() {
  echo "[+] Creating LNbits superuser (admin/changeme)"
  curl -s -o /dev/null -X PUT http://localhost:15001/api/v1/auth/first_install \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"changeme","password_repeat":"changeme"}' || true
}

fetch_admin_key() {
  local cookie
  cookie=$(mktemp)
  curl -s -c "$cookie" -X POST http://localhost:15001/api/v1/auth \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"changeme"}' >/dev/null
  curl -s -b "$cookie" http://localhost:15001/api/v1/wallets | jq -r '.[0].adminkey'
}

usage() {
  echo "Usage: $0 {up|down|status}"
  exit 1
}

if [[ ${1:-} == "up" ]]; then
  echo "[+] Starting regtest stack"
  $COMPOSE up -d
  wait_for_bitcoind
  ensure_miner_wallet
  maybe_mine_initial

  maybe_init_wallet lnd-merchant
  maybe_init_wallet lnd-payer
  ensure_unlocked lnd-merchant
  ensure_unlocked lnd-payer
  wait_lnd_ready lnd-merchant
  wait_lnd_ready lnd-payer

  fund_payer
  connect_nodes
  open_channel

  echo "[+] Restarting LNbits so it sees LND macaroons"
  $COMPOSE restart lnbits >/dev/null
  until curl -s http://localhost:15001 >/dev/null 2>&1; do sleep 2; done

  ensure_lnbits_superuser
  ADMIN_KEY=$(fetch_admin_key)
  cat <<EOFMSG

Regtest LNbits is ready.
- LNbits UI:        http://localhost:15001
- Merchant LND REST: https://localhost:18080 (self-signed)
- Admin key:         ${ADMIN_KEY}

Use these envs for API:
  LN_BITS_URL=http://localhost:15001
  LN_BITS_API_KEY=${ADMIN_KEY}
  LIGHTNING_PROVIDER=lnbits
EOFMSG
elif [[ ${1:-} == "down" ]]; then
  $COMPOSE down -v
elif [[ ${1:-} == "status" ]]; then
  $COMPOSE ps
else
  usage
fi

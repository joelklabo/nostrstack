#!/usr/bin/env bash
set -euo pipefail

# Bring up regtest bitcoind + two LND nodes + LNbits wired to lnd-merchant.
# Idempotent enough for local dev; assumes fresh volumes on first run.

COMPOSE="docker compose -f deploy/regtest/docker-compose.yml"
PASS="regtestpass"
PASS_B64=$(printf "%s" "$PASS" | base64 | tr -d '\n')

bitcoin_cli() {
  $COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

bitcoin_cli_miner() {
  bitcoin_cli -rpcwallet=miner "$@"
}

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
  until bitcoin_cli getblockchaininfo >/dev/null 2>&1; do
    sleep 2
  done
}

ensure_miner_wallet() {
  echo "[+] Ensuring miner wallet exists + loaded"
  # Create if missing, then load (bitcoind may start with wallet unloaded after restarts).
  bitcoin_cli createwallet miner >/dev/null 2>&1 || true
  bitcoin_cli loadwallet miner >/dev/null 2>&1 || true
  bitcoin_cli_miner getwalletinfo >/dev/null 2>&1 || true
}

maybe_mine_initial() {
  local height
  height=$(bitcoin_cli getblockcount)
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
  addr=$(bitcoin_cli_miner getnewaddress)
  bitcoin_cli_miner generatetoaddress "$n" "$addr" >/dev/null
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
  bitcoin_cli_miner sendtoaddress "$addr" 1 >/dev/null
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

lncli_cmd() {
  local svc="$1"
  shift
  $COMPOSE exec -T "$svc" lncli --network=regtest --lnddir=/data --rpcserver="$svc:$(rpc_port "$svc")" --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert "$@"
}

lnd_info_field() {
  local svc="$1"
  local jqExpr="$2"
  local out
  out=$(lncli_cmd "$svc" getinfo 2>/dev/null || true)
  if [[ -z "$out" ]]; then
    echo ""
    return 0
  fi
  echo "$out" | jq -r "$jqExpr" 2>/dev/null || echo ""
}

ensure_lnd_synced() {
  echo "[+] Ensuring LND nodes are synced to chain"
  local maxLoops=120
  local loop=0
  while (( loop < maxLoops )); do
    loop=$((loop + 1))
    local btcHeight payerSynced merchantSynced payerH merchantH
    btcHeight=$(bitcoin_cli getblockcount 2>/dev/null || echo 0)
    payerSynced=$(lnd_info_field lnd-payer '.synced_to_chain // false')
    merchantSynced=$(lnd_info_field lnd-merchant '.synced_to_chain // false')
    payerH=$(lnd_info_field lnd-payer '.block_height // 0')
    merchantH=$(lnd_info_field lnd-merchant '.block_height // 0')

    if [[ "$payerSynced" == "true" && "$merchantSynced" == "true" ]]; then
      echo "[=] LND synced (bitcoind height ${btcHeight}, payer ${payerH}, merchant ${merchantH})"
      return 0
    fi

    # If bitcoind is behind either node's known height, mine to catch up quickly.
    local targetH="$btcHeight"
    if [[ "$payerH" =~ ^[0-9]+$ ]] && (( payerH > targetH )); then targetH="$payerH"; fi
    if [[ "$merchantH" =~ ^[0-9]+$ ]] && (( merchantH > targetH )); then targetH="$merchantH"; fi

    if (( btcHeight < targetH )); then
      local delta=$((targetH - btcHeight))
      local chunk=$delta
      if (( chunk > 50 )); then chunk=50; fi
      echo "[+] Mining ${chunk} blocks to catch up (bitcoind ${btcHeight} -> ${targetH}; payer ${payerH} synced=${payerSynced}, merchant ${merchantH} synced=${merchantSynced})"
      mine_blocks "$chunk"
    else
      echo "[+] Waiting for LND sync (bitcoind ${btcHeight}; payer ${payerH} synced=${payerSynced}, merchant ${merchantH} synced=${merchantSynced})"
      mine_blocks 1
    fi
    sleep 1
  done

  echo "[!] Timed out waiting for LND to sync"
  echo "bitcoind: $(bitcoin_cli getblockchaininfo 2>/dev/null || true)"
  echo "payer getinfo: $(lncli_cmd lnd-payer getinfo 2>/dev/null || true)"
  echo "merchant getinfo: $(lncli_cmd lnd-merchant getinfo 2>/dev/null || true)"
  return 1
}

ensure_active_channel() {
  echo "[+] Ensuring payer -> merchant has an active channel"
  connect_nodes
  local dest_pub
  dest_pub=$(get_pubkey lnd-merchant)

  local has_any has_active
  has_any=$(lncli_cmd lnd-payer listchannels 2>/dev/null | jq -r --arg pk "$dest_pub" '[.channels[]? | select(.remote_pubkey==$pk)] | length' 2>/dev/null || echo 0)
  has_active=$(lncli_cmd lnd-payer listchannels 2>/dev/null | jq -r --arg pk "$dest_pub" '[.channels[]? | select(.remote_pubkey==$pk and .active==true)] | length' 2>/dev/null || echo 0)

  if [[ "$has_active" =~ ^[0-9]+$ ]] && (( has_active > 0 )); then
    echo "[=] Active channel present"
    return 0
  fi

  if [[ "$has_any" =~ ^[0-9]+$ ]] && (( has_any > 0 )); then
    echo "[=] Channel exists but inactive; mining and retrying"
    mine_blocks 6
  else
    open_channel
  fi

  local tries=0
  while (( tries < 25 )); do
    tries=$((tries + 1))
    connect_nodes
    has_active=$(lncli_cmd lnd-payer listchannels 2>/dev/null | jq -r --arg pk "$dest_pub" '[.channels[]? | select(.remote_pubkey==$pk and .active==true)] | length' 2>/dev/null || echo 0)
    if [[ "$has_active" =~ ^[0-9]+$ ]] && (( has_active > 0 )); then
      echo "[=] Channel is active"
      return 0
    fi
    sleep 2
  done

  echo "[!] No active channel after retries"
  echo "payer peers: $(lncli_cmd lnd-payer listpeers 2>/dev/null || true)"
  echo "payer channels: $(lncli_cmd lnd-payer listchannels 2>/dev/null || true)"
  echo "payer pending: $(lncli_cmd lnd-payer pendingchannels 2>/dev/null || true)"
  echo "payer getinfo: $(lncli_cmd lnd-payer getinfo 2>/dev/null || true)"
  echo "merchant getinfo: $(lncli_cmd lnd-merchant getinfo 2>/dev/null || true)"
  return 1
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

  ensure_lnd_synced
  fund_payer
  ensure_active_channel

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

#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose -f deploy/regtest/docker-compose.yml"
BITCOIN_CLI="$COMPOSE exec -T bitcoind bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner"
MERCHANT_LNCLI="$COMPOSE exec -T lnd-merchant lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert"
PAYER_LNCLI="$COMPOSE exec -T lnd-payer lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert"

if ! $COMPOSE ps >/dev/null 2>&1; then
  echo "regtest stack not running (deploy/regtest). Start it first: ./scripts/regtest-lndbits.sh up" >&2
  exit 1
fi

echo "[+] Funding lnd-merchant onchain (1 BTC)"
addr=$($MERCHANT_LNCLI newaddress p2wkh | jq -r '.address')
$BITCOIN_CLI sendtoaddress "$addr" 1 >/dev/null
$BITCOIN_CLI generatetoaddress 6 $($BITCOIN_CLI getnewaddress) >/dev/null

printf "[+] Merchant onchain balance: %s sat\n" "$($MERCHANT_LNCLI walletbalance | jq -r '.total_balance')"

# open a channel with outbound liquidity from merchant to payer
payer_pub=$($PAYER_LNCLI getinfo | jq -r '.identity_pubkey')
local_total=$($MERCHANT_LNCLI listchannels | jq '[.channels[].local_balance | tonumber] | add // 0')
if (( local_total < 300000 )); then
  echo "[+] Opening channel merchant -> payer (500k sats)"
  $MERCHANT_LNCLI openchannel --node_key="$payer_pub" --local_amt=500000 --sat_per_vbyte=1 >/dev/null
  $BITCOIN_CLI generatetoaddress 6 $($BITCOIN_CLI getnewaddress) >/dev/null
else
  echo "[=] Merchant already has >=300k sats local liquidity; skipping new channel"
fi

printf "[+] Merchant channel balances:\n%s\n" "$($MERCHANT_LNCLI listchannels | jq '{local:.channels[].local_balance, remote:.channels[].remote_balance}')"
printf "[+] Payer channel balances:\n%s\n" "$($PAYER_LNCLI listchannels | jq '{local:.channels[].local_balance, remote:.channels[].remote_balance}')"

echo "Done. LNbits (merchant) now has outbound liquidity for sending/paying invoices."

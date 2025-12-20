# Local demo: LNbits backends

Two ways to run the demo locally:
- **Regtest (real settlement)** – bitcoind + two LND nodes + LNbits wired to the merchant node.
- **Dummy (no settlement)** – LNbits mock backend that only issues invoices.

## A) Regtest (real payments)

Prereqs: Docker running (Colima/Docker Desktop), `jq`, `pnpm install`.

1) **Start the stack + create channel + superuser**
   ```sh
   ./scripts/regtest-lndbits.sh up
   ```
   The script prints an admin key and URLs, e.g.:
   ```
   LNbits UI:        http://localhost:15001
   Merchant LND REST: https://localhost:18080 (self-signed)
   Admin key:         <ADMINKY>
   ```
2) **Run nostrstack API against regtest LNbits**
   ```sh
   cd apps/api
   LN_BITS_URL=http://localhost:15001 \
   LN_BITS_API_KEY=<ADMINKY> \
   LIGHTNING_PROVIDER=lnbits \
   ENABLE_REGTEST_PAY=true \
   ENABLE_REGTEST_FUND=true \
   PUBLIC_ORIGIN=http://localhost:3001 \
   pnpm dev
   ```
3) **Run the gallery demo**
   ```sh
   cd apps/gallery
   VITE_API_BASE_URL=http://localhost:3001 \
   VITE_NOSTRSTACK_HOST=localhost:3001 \
   VITE_ENABLE_REGTEST_PAY=true \
   pnpm dev -- --host --port 4173
   ```
   Open http://127.0.0.1:4173 and try tips/paywall/comments; invoices settle over the local regtest channel.
4) **Pay a zap via regtest**
   - Click **ZAP** on a post to open the modal.
   - Use **PAY_REGTEST** to pay the invoice with the local payer node.
   - If the wallet is empty, use **Fund regtest wallet** or call `curl -X POST http://localhost:3001/regtest/fund`.
5) **(Optional) Pay an invoice from the payer node**
   ```sh
   docker compose -f deploy/regtest/docker-compose.yml exec \
     lnd-payer lncli --network=regtest --lnddir=/data \
     --rpcserver=lnd-payer:10010 \
     --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon \
     --tlscertpath=/data/tls.cert payinvoice <BOLT11>
   ```
6) **Stop everything**
   ```sh
   ./scripts/regtest-lndbits.sh down
   ```

### Add spendable sats to LNbits (regtest)
By default the merchant node has only inbound liquidity. To give LNbits outbound sats for sending/paying invoices, hit the faucet endpoint (or click “Fund regtest wallet” in the gallery):
```sh
curl -X POST http://localhost:3001/regtest/fund
```
This mines coins to `lnd-merchant` and opens a 500k sat channel to the payer, leaving ~0.5M sats local on the merchant side for spending.

Notes:
- Ports: LNbits `15001`, merchant LND REST `18080`, payer LND REST `19080`.
- The script is idempotent; rerun `up` to recreate wallets/channel if volumes were removed.

## B) Dummy backend (invoice-only)

1) **Start LNbits (mock funding)**
   ```sh
   docker compose -f deploy/lnbits/docker-compose.yml up -d
   # ln service listens on http://localhost:5000
   ```
2) **Create a wallet + copy the Admin key** from http://localhost:5000 (Wallet → API Info).
3) **Run API**
   ```sh
   cd apps/api
   LN_BITS_URL=http://localhost:5000 \
   LN_BITS_API_KEY=<ADMIN_KEY> \
   LIGHTNING_PROVIDER=lnbits \
   PUBLIC_ORIGIN=http://localhost:3001 \
   pnpm dev
   ```
4) **Run gallery** (same as above, point to API).
5) **Stop**
   ```sh
   docker compose -f deploy/lnbits/docker-compose.yml down -v
   ```

Mutinynet/mainnet: swap `LN_BITS_URL/API_KEY` to your staging/prod LNbits and keep `LIGHTNING_PROVIDER=lnbits`.

### Mutinynet (staging) quickstart
If you have Azure Key Vault access, grab the staging admin key:
```sh
ADMIN_KEY=$(az keyvault secret show --vault-name satoshis-kv-west --name lnbits-api-key --query value -o tsv)
```
Then point API/gallery to staging:
```sh
cd apps/api
LN_BITS_URL=https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io \
LN_BITS_API_KEY=$ADMIN_KEY \
LIGHTNING_PROVIDER=lnbits \
PUBLIC_ORIGIN=http://localhost:3001 \
DATABASE_URL=file:./dev.db \
pnpm dev
```
Gallery:
```sh
cd apps/gallery
VITE_API_BASE_URL=http://localhost:3001 \
VITE_NOSTRSTACK_HOST=localhost:3001 \
pnpm dev -- --host --port 4173
```

### Regtest smoke (CLI)
With the regtest stack and API running locally, verify end-to-end payment:
```sh
pnpm smoke:regtest-demo
```
This creates a real BOLT11 via `/api/pay`, pays it with the bundled `lnd-payer`, and checks status=PAID.

### Nostr comments in the demo
- For quick mock comments (no relays, no signer), set relays to `mock` in the Config box (default).
- For real relays, set `VITE_NOSTRSTACK_RELAYS` (or use the Config input) to a single relay like `wss://relay.damus.io` and enable a NIP-07 signer. See `docs/nip07-setup.md` for signer steps.

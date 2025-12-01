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
   PUBLIC_ORIGIN=http://localhost:3001 \
   pnpm dev
   ```
3) **Run the gallery demo**
   ```sh
   cd apps/gallery
   VITE_API_BASE_URL=http://localhost:3001 \
   VITE_NOSTRSTACK_HOST=localhost:3001 \
   pnpm dev -- --host --port 4173
   ```
   Open http://127.0.0.1:4173 and try tips/paywall/comments; invoices settle over the local regtest channel.
4) **(Optional) Pay an invoice from the payer node**
   ```sh
   docker compose -f deploy/regtest/docker-compose.yml exec \
     lnd-payer lncli --network=regtest --lnddir=/data \
     --rpcserver=lnd-payer:10010 \
     --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon \
     --tlscertpath=/data/tls.cert payinvoice <BOLT11>
   ```
5) **Stop everything**
   ```sh
   ./scripts/regtest-lndbits.sh down
   ```

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

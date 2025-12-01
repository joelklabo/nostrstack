# Local demo with real invoices (LNbits)

Goal: run nostrstack API + gallery locally and generate real Lightning invoices via LNbits (dummy backend is fine for testing).

## Prereqs
- Docker running (Docker Desktop).
- pnpm deps installed (`pnpm install`).

## Steps
1) **Start LNbits (dummy funding)**
   ```sh
   docker compose -f deploy/lnbits/docker-compose.yml up -d
   # ln service listens on http://localhost:5000
   ```
2) **Create wallet + admin key**
   - Open http://localhost:5000
   - Create a new wallet; open the wallet menu → API Info → copy the *Admin API Key*.
3) **Run nostrstack API pointed at LNbits**
   ```sh
   cd apps/api
   LN_BITS_URL=http://localhost:5000 \
   LN_BITS_API_KEY=<ADMIN_KEY> \
   LIGHTNING_PROVIDER=lnbits \
   PUBLIC_ORIGIN=http://localhost:3001 \
   pnpm dev
   ```
   API runs at http://localhost:3001.
4) **Run gallery demo against this API**
   ```sh
   cd apps/gallery
   VITE_API_BASE_URL=http://localhost:3001 \
   VITE_NOSTRSTACK_HOST=localhost:3001 \
   pnpm dev -- --host --port 4173
   ```
   Open http://127.0.0.1:4173 and use the tip/pay widgets. Invoices come from your local LNbits instance.
5) **Tear down**
   ```sh
   docker compose -f deploy/lnbits/docker-compose.yml down -v
   ```

Notes:
- Dummy funding source won’t forward payments to real Lightning; invoices still generate for UI/testing.
- For mutinynet, replace LN_BITS_URL/API_KEY with your staging instance/keys and set `LIGHTNING_PROVIDER=lnbits`.
- Pay-to-act E2E with real settlement: export `LNBITS_URL` and `LNBITS_ADMIN_KEY` and run `pnpm --filter api test:e2e:pay` (payer).

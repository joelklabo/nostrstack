# Deployment Guide

## Prerequisites

- Node.js 20+
- PNPM 9+
- A PostgreSQL database (optional, defaults to SQLite for dev/demo)
- An LNbits instance (for Lightning payments)

## Build

Run the build command from the root:

```bash
pnpm build
```

## Deploying the API (Backend)

The API is a Node.js application.

1. Navigate to `apps/api`.
2. Deploy the contents, ensuring `dist/server.js` is the entry point.
3. Set environment variables:
   - `DATABASE_URL`: Connection string to your Postgres DB (or file path for SQLite).
   - `LN_BITS_URL`: URL to your LNbits instance.
   - `LN_BITS_API_KEY`: Admin key for LNbits.
   - `BITCOIN_NETWORK`: `regtest`, `mutinynet`, or `mainnet`.
   - `TELEMETRY_PROVIDER`: `bitcoind`, `esplora`, or `mock` (use `esplora` for mutinynet/mainnet).
   - `TELEMETRY_ESPLORA_URL`: Base URL for Esplora when provider is `esplora` (e.g., `https://blockstream.info/api`).
   - `BITCOIND_RPC_URL`: Required when provider is `bitcoind`.
   - `PUBLIC_ORIGIN`: The public URL of this API (e.g., `https://api.nostrstack.com`).
   - `NOSTR_SECRET_KEY`: (Optional) nsec for the system bot.
   - `PORT`: Port to listen on (default 3001).
   - `ENABLE_REGTEST_PAY`: **Dev-only** toggle for `/api/regtest/pay` (default false; keep unset in staging/prod).
   - `ENABLE_REGTEST_FUND`: **Dev-only** toggle for `/api/regtest/fund` (default false; keep unset in staging/prod).
   - `MAINNET_DEMO_OK`: Required by local demo scripts when using mainnet (`true` to proceed).

## Deploying the Gallery (Frontend)

The Gallery is a static Single Page Application (SPA).

1. Navigate to `apps/gallery/dist`.
2. Deploy these static files to any static host (Cloudflare Pages, Vercel, Netlify, Nginx, etc.).
3. **Configuration:** The frontend connects to the API. You must configure the build or the runtime environment (if using a specific server) to point to the API.

   - The build embeds `VITE_API_BASE_URL` if set during build time.
   - Otherwise, it defaults to `http://localhost:3001`.
   - To customize for production, rebuild with:

     ```bash
     VITE_API_BASE_URL=https://api.nostrstack.com pnpm --filter gallery build
     ```

## Docker

You can also use the provided `Dockerfile` in `apps/api` for containerized deployment.

For the Gallery (frontend), a `Dockerfile` is provided in `apps/gallery` which builds the static site and serves it via Nginx.

```bash
docker build -f apps/gallery/Dockerfile -t nostrstack-gallery .
docker run -p 8080:80 nostrstack-gallery
```

## Automated Deployment (CI/CD)

The repository includes a GitHub Actions workflow `.github/workflows/azure-deploy.yml` for deploying the API to Azure Container Apps.
For the frontend (Gallery), we recommend setting up a workflow with Cloudflare Pages or Vercel linked to the `apps/gallery` directory, with the build command `pnpm build`.

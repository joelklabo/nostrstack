# nostrstack

Monorepo for a multi-tenant Lightning + Nostr backend with SDK and embeddable widgets. Currently a scaffold; features are stubbed and ready to extend.

## Packages

- `apps/api` – Fastify API server (TypeScript, Prisma, OpenNode provider stub)
- `apps/social` – Main social app (Vite + React app for user flows)
- `apps/docs` – Documentation app
- `packages/sdk` – Typed client for the API
- `packages/widgets` – Browser bundle and widgets
- `packages/config` – Shared lint/tsconfig
- `deploy/azure` – Bicep + GH Actions pipeline for Azure Container Apps
- `docs/commands.md` – Command reference for local + CI workflows
- `docs/project-structure.md` – Workspace map and ownership

## Speckit

- Specs live in `specs/speckit/` (constitution + embeddable comment/tip widget plan).

## Getting started

```sh
pnpm install
docker compose up -d postgres
cp apps/api/.env.example .env
pnpm dev   # runs API + social app with shared local logs
```

Database migrations (Postgres):

```sh
DATABASE_URL=postgres://nostrstack:nostrstack@localhost:5432/nostrstack pnpm --filter api prisma migrate deploy --schema apps/api/prisma/pg/schema.prisma
```

Seed demo tenant/user:

```sh
DATABASE_URL=postgres://nostrstack:nostrstack@localhost:5432/nostrstack pnpm --filter api seed
```

Deploy: see `deploy/azure/README.md` and `.github/workflows/azure-deploy.yml` for Azure Container Apps pipeline.

- Staging pipeline: `.github/workflows/azure-deploy-staging.yml` (deploys to `nostrstack-api-stg` with optional Log Analytics).

Funding sources / LNbits:

- Switch providers via env: `LIGHTNING_PROVIDER=lnbits` with `LN_BITS_URL`, `LN_BITS_API_KEY`; default is OpenNode.
- Local LNbits dev helper: `docker compose -f deploy/lnbits/docker-compose.yml up` (exposes :5000).

Observability:

- Prometheus metrics at `/metrics` (per-tenant labels), enabled by default.
- OpenTelemetry traces/metrics optional: set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` (plus `OTEL_EXPORTER_OTLP_HEADERS` if needed). Service name defaults to `nostrstack-api`.

Public Nostr event landing:

- View any event/profile/address at `https://nostrstack.com/nostr/<id>` (local dev: `https://localhost:4173/nostr/<id>`).
- Supported IDs: 64-char hex, `note`, `nevent`, `naddr`, `npub`, `nprofile` (optional `nostr:` prefix).
- API: `GET /api/nostr/event/:id` on the API server (local dev: `https://localhost:3001/api/nostr/event/<id>`).

Payments:

- Profile SendSats and zap flow notes: `docs/payments.md`.

Find friend + tip flow:

- Open `/search` (or “Find friend” in the sidebar) to resolve `npub`, `nprofile`, hex pubkeys, or `nip05`.
- Open the profile, zap posts, and send a 500-sat tip (enable `VITE_ENABLE_PROFILE_PAY=true`).
- Setup + troubleshooting: `docs/find-friend-tip.md`.

## Demo modes (phased)

- See `docs/demo-modes.md` for the three presets (regtest, mutinynet, mainnet) and one-liners.
- Quick regtest start:

  ```sh
  pnpm demo:regtest   # colima+docker required; API :3001, social :4173
  ```

### Network switching (dev)

- Use `pnpm dev:network -- --network regtest|mutinynet|mainnet` to load `.env.network.*` profiles (sets BITCOIN_NETWORK/VITE_NETWORK + telemetry provider defaults).
- For mutinynet/mainnet, set `LN_BITS_URL` + `LN_BITS_API_KEY` and a matching `TELEMETRY_ESPLORA_URL` (`MAINNET_DEMO_OK=true` required for mainnet).

See `AGENTS.md` for workflow conventions.

### Embeddable comments + tips

- Add a script/bundle for `@nostrstack/widgets`, then drop:

  ```html
  <div
    data-nostrstack-comment-tip="thread-or-slug"
    data-tip-username="alice"
    data-tip-item-id="post-123"
    data-tip-show-feed="false"
  ></div>
  ```

Use `data-relays` to override relays, `data-tip-preset-amounts-sats` for presets, and `data-base-url`/`data-host` to point at your API/tenant.
nostrstack-run 1771142197

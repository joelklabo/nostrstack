# nostrstack

Monorepo for a multi-tenant Lightning + Nostr backend with SDK and embeddable widgets. Currently a scaffold; features are stubbed and ready to extend.

## Packages

- `apps/api` – Fastify API server (TypeScript, Prisma, OpenNode provider stub)
- `apps/gallery` – Demo app to exercise SDK/embed (Vite + React skeleton)
- `packages/sdk` – Typed client for the API
- `packages/embed` – Browser bundle and widgets
- `packages/config` – Shared lint/tsconfig
- `deploy/azure` – Bicep + GH Actions pipeline for Azure Container Apps

## Getting started

```sh
pnpm install
docker compose up -d postgres
cp apps/api/.env.example .env
pnpm dev   # runs the API against Postgres on :5432
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

## Demo modes (phased)

- See `docs/demo-modes.md` for the three presets (regtest, mutinynet, mainnet) and one-liners.
- Quick regtest start:

  ```sh
  pnpm demo:regtest   # colima+docker required; API :3001, gallery :4173
  ```

See `AGENTS.md` for workflow conventions. Tasks and status: `pnpm exec bd list`.

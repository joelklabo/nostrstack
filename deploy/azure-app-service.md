# Azure App Service Notes (draft)

- Build artifacts: `pnpm --filter api build` outputs `apps/api/dist`. Run with `node dist/server.js`.
- Env vars: `PORT`, `LOG_LEVEL`, `OP_NODE_API_KEY`, `DATABASE_URL` (use Azure Postgres or SQLite for dev), `PUBLIC_ORIGIN`.
- Health: GET `/health`; Metrics: GET `/metrics`; Docs: `/docs`.
- Recommended deployment steps:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm --filter api build`
  3. Start command: `node apps/api/dist/server.js`
- Add Azure Monitor container insights; scrape `/metrics` with Prometheus if available.
- For multi-tenant custom domains, front with Azure Front Door; map `/.well-known/*` paths to API.

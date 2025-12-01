# Agent Workflow

This repo is scaffolded for AI+human pair work.

**Pick up work via Beads:** This repo uses Beads (https://github.com/steveyegge/beads) as the sole task tracker. `bd` is installed as a dev dependency; run it via `pnpm exec bd ...`. Workflows live in `.beads.yaml`.
  - List: `pnpm exec bd list`
  - Run a workflow: `pnpm exec bd run api-test`
  - Help: `pnpm exec bd help`

- Use `pnpm install` at root to set up all workspaces.
- Local DB: `docker compose up -d postgres` (default `DATABASE_URL` points to postgres://satoshis:satoshis@localhost:55432/satoshis). Tests still use SQLite unless `TEST_DATABASE_URL` is set.
- Lightning provider: set `LIGHTNING_PROVIDER=opennode|lnbits`. LNbits needs `LN_BITS_URL` and `LN_BITS_API_KEY`. Local helper: `docker compose -f deploy/lnbits/docker-compose.yml up` (exposes :5000).
- Primary scripts:
  - API dev: `pnpm --filter api dev`
  - Gallery dev: `pnpm --filter gallery dev`
  - Lint/test all: `pnpm lint`, `pnpm test`, `pnpm typecheck`
- LNbits smoke: `LNBITS_URL=<url> LNBITS_ADMIN_KEY=<adminkey> ./scripts/lnbits-smoke.sh [sats]`
- LNbits health: `LNBITS_URL=<url> ./scripts/lnbits-status.sh`
- Source of truth for tasks is `.beads.yaml` + `pnpm exec bd list`. There is no ISSUES.md; architecture notes live in code/docs.
- Add new beads to `.beads.yaml` for repeatable tasks (examples included).
- Staging (west coast): Container App `satoshis-api-stg-west` uses system-managed identity to read secrets from Key Vault `satoshis-kv-west` (DATABASE_URL, ADMIN_API_KEY, OP_NODE_API_KEY, OP_NODE_WEBHOOK_SECRET, LN_BITS_URL, LN_BITS_API_KEY). ACR `satoshiswestacr` is set as registry. PUBLIC_ORIGIN currently `https://satoshis-api-stg-west.westus3.azurecontainerapps.io`. Lightning provider env defaults to `LIGHTNING_PROVIDER=lnbits`.
- Staging lightning (LNbits): see `docs/staging-lightning.md` for base URL, key vault secret names, and smoke-test commands. Funding source is Voltage mutinynet LND via gRPC.
- Prod lightning (west coast, Container App `lnbits-prod-west`): LNbits 1.3.1 backed by Voltage LND (mutinynet for now) + Postgres DB `lnbitsprod` on server `satoshis-pg-west`. Secrets live in Key Vault `satoshis-kv-west`:
  - DB: `lnbits-prod-database-url`, `database-url-prod` (postgres://satoshis:Poop7037X%21Z@.../lnbitsprod?sslmode=require)
  - LND: `lnd-mainnet-endpoint` (`satoshis.u.voltageapp.io:10009`), `lnd-mainnet-macaroon-hex`, `lnd-mainnet-tls` (PEM), network set to `signet` until we flip to mainnet.
  - Admin UI first-install completed. Admin creds are in Key Vault (`lnbits-prod-admin-user` / `lnbits-prod-admin-password`). Health: `curl https://lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io/status/health` (expects funding_source=LndWallet).

## Beads usage (bd)
- Generate the repo-specific guide: `bd onboard --output .beads/BD_GUIDE.md` (commit it).
- Initialize in repo root: `bd init --team` (protected main) or `bd init --contributor` (fork); then run `bd doctor`.
- Status mapping expected by the UI: open(`open|ready|todo|backlog`), in progress(`in_progress|doing|wip`), blocked(`blocked`), closed(`closed|done|resolved`), other(anything else). Set `bd update <id> --status in_progress` when work starts.
- Daemon/merge driver: accept prompts; manage with `bd daemons health|killall`. Data lives in `.beads/`—commit it with code.
- If the viewer shows zero projects, run `bd doctor` then `bd daemons killall`, and reload.
- When you close an issue that had code changes, make a commit and push at the time of closure (one commit per closed issue).

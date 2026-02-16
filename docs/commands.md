# Command Reference

This document is the canonical list of common project commands.

- Local helper scripts now live in `scripts/` subfolders for clearer naming:
  - `scripts/dev/*`, `scripts/demo/*`, `scripts/regtest/*`, `scripts/lnbits/*`, `scripts/mcp/*`
  - Legacy top-level `scripts/*.sh` shims are retained for backward compatibility.

## Local workflows

### Full stack

- `pnpm dev`  
  Start API + social (HTTPS + shared logs) for local development.

- `pnpm demo:regtest`  
  Start local regtest demo flow (`API :3001`, `social :4173`).

### Package/target commands

- `pnpm lint`  
  Run all workspace lint checks.

- `pnpm typecheck`  
  Run TypeScript checks for all workspace projects.

- `pnpm test`  
  Run all unit tests.

- `pnpm test:ci`  
  Run tests with a writable Vitest cache path for CI/read-only workspaces.

- `pnpm check`  
  Run `lint`, `test`, `typecheck`.

- `make ci`  
  Run `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`.

- `make test-ci`  
  Same as `pnpm test:ci` via the Makefile.

## App-scoped commands

- `pnpm --filter api dev`  
  Run the API dev server.

- `pnpm --filter social dev`  
  Run the social app dev server.

- `pnpm --filter social exec playwright test`  
  Run social e2e tests.

- `pnpm --filter api exec prisma migrate deploy --schema apps/api/prisma/pg/schema.prisma`  
  Apply Prisma migrations in the API package.

## Release and deploy helpers

- `pnpm deploy:staging`  
  Trigger the staging Azure deployment workflow.

- `pnpm deploy:prod`  
  Trigger the production Azure deployment workflow.

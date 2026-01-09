# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NostrStack is a monorepo for a multi-tenant Lightning + Nostr backend with SDK and embeddable widgets. It provides tip/pay widgets, Nostr comments, profile sections, and blockchain stats for personal sites.

## Common Commands

```bash
# Install dependencies
pnpm install

# Development (API only)
pnpm dev

# Development (API + Social app together)
pnpm demo                    # API :3001, social :4173
pnpm dev:logs               # With HTTPS and logging to .logs/dev/
pnpm dev:docs               # Docs site on :4174

# Run tests
pnpm test                    # All unit tests
pnpm --filter api test       # API unit tests only
pnpm --filter social test    # Social app unit tests only
pnpm e2e                     # API end-to-end tests (Playwright)
pnpm --filter social e2e     # Social app e2e tests

# Run a single test file
pnpm --filter api exec vitest run path/to/test.ts
pnpm --filter social exec vitest run path/to/test.ts

# Linting and type checking
pnpm lint                    # All linting
pnpm typecheck               # TypeScript check
pnpm format                  # Prettier format
pnpm check                   # lint + test + typecheck

# Build
pnpm build                   # Build all packages

# Demo modes (regtest/mutinynet/mainnet)
pnpm demo:regtest            # Local regtest with LNbits
pnpm demo:mutinynet          # Mutinynet network
pnpm demo:mainnet            # Mainnet (requires MAINNET_DEMO_OK=true)

# Network switching
pnpm dev:network -- --network regtest|mutinynet|mainnet

# Storybook
pnpm --filter social storybook        # Dev server on :6006
pnpm --filter social build-storybook  # Build static

# Database
# Local dev uses SQLite by default, prod uses PostgreSQL
# Both schemas are now unified - pg/schema.prisma is the source of truth
DATABASE_URL=postgres://nostrstack:nostrstack@localhost:5432/nostrstack pnpm --filter api prisma migrate deploy --schema apps/api/prisma/pg/schema.prisma
pnpm --filter api seed                 # Seed demo data
```

## Architecture

### Apps

- **apps/api**: Fastify + Prisma API server. Multi-tenant with LightningProvider abstraction (LNbits). Handles payments, Nostr endpoints, LNURLp/NIP-05, webhooks. Prometheus metrics at `/metrics`, optional OpenTelemetry.
- **apps/social**: Production Nostr social network with feed, profiles, DMs, notifications, wallet. Uses `@nostrstack/react` and `@nostrstack/widgets`.
- **apps/docs**: Widget documentation and demos. Standalone Vite app showcasing embeddable components.

### Packages

- **packages/sdk**: Typed client for the API
- **packages/widgets**: Browser bundle with script-tag widgets (tip, comments, share, profile, blockchain stats). Uses `data-ns-*` attributes for auto-mount.
- **packages/tokens**: W3C DTCG format design tokens. Single source of truth for colors, typography, spacing, shadows, radii.
- **packages/react**: React components (SupportSection, profile, share, comments, tip feed, blockchain stats)
- **packages/ui**: Shared UI components (Alert, Skeleton, Toast)
- **packages/nostr**: Shared Nostr utilities (identity encoding/decoding, profile parsing, threading)
- **packages/injector**: Static-site CLI for injecting embed scripts
- **packages/config**: Shared lint/tsconfig
- **packages/create-nostrstack-site**: Site scaffolding tool

### Data Flow (Happy Path Tip)

Browser widget → API `/api/pay` (tenant lookup) → LightningProvider.createCharge → invoice to browser → payer pays → LNbits webhook → API updates Payment → widgets poll/verify

### Tenancy

Tenant resolved from host header or `domain` param. User entries store lightningAddress; LNURLp uses tenant domain + username.

### Environments

- **Local**: SQLite dev DB, regtest LNbits; social :4173, docs :4174, API :3001
- **Staging**: LNbits + Voltage mutinynet LND, Postgres, Azure Container Apps
- **Prod**: LNbits + Voltage mainnet LND

## Key Environment Variables

- `DATABASE_URL`: Prisma DB connection (SQLite for dev: `file:./dev.db`)
- `LIGHTNING_PROVIDER`: `lnbits` or `opennode`
- `LN_BITS_URL`, `LN_BITS_API_KEY`: LNbits configuration
- `BITCOIN_NETWORK`: `regtest`, `mutinynet`, or `mainnet`
- `TELEMETRY_PROVIDER`: `bitcoind`, `esplora`, or `mock`
- `TELEMETRY_ESPLORA_URL`: Esplora endpoint for mutinynet/mainnet
- `USE_HTTPS`, `HTTPS_CERT`, `HTTPS_KEY`: HTTPS for local dev
- `VITE_ENABLE_PROFILE_PAY=true`: Enable profile pay feature

## Beads Task Management

The project uses Beads (`bd`) for task tracking:

```bash
pnpm exec bd list            # List tasks
pnpm exec bd ready           # Get next task
bd admin cleanup --older-than 30  # Clean old issues (NEVER without --older-than)
```

## Conventions

- Commits follow Conventional Commits
- WCAG 2.1 Level AA accessibility standards for UI
- Visual regression testing with Chromatic
- Widgets use `.ns-*` classes and `--ns-*` CSS variables (from @nostrstack/tokens)

# Project Structure

This monorepo is split into `apps/*` (deployable applications) and `packages/*` (reusable libraries).

## Apps

- `apps/api`  
  Fastify/Prisma API that owns tenant-aware storage, LNbits/Nostr routes, and event APIs.

- `apps/web`  
  Primary React/Vite frontend for user flows (profiles, feeds, zap flows, payments).

- `apps/docs`  
  Internal documentation and reference site.

## Packages

- `packages/config`  
  Shared config tooling (lint/typecheck conventions).

- `packages/contracts`  
  Shared contract and domain-shape types for web/API alignment.

- `packages/react`  
  Shared React primitives used by apps and widget surfaces.

- `packages/sdk`  
  API client SDK and typed route helpers.

- `packages/test-utils`  
  Reusable test helpers and fixtures for apps and packages.

- `packages/tokens`  
  Token and currency abstractions for wallet/payment helpers.

- `packages/ui`  
  Design-system-level UI building blocks used by the web app.

- `packages/widgets`  
  Embeddable widget bundles and script-tag entrypoints.

- `packages/nostr`  
  Nostr primitives shared across API and frontend.

- `packages/nostr-tools`  
  Internal protocol helpers for relays, events, and crypto operations.

- `packages/create-nostrstack-site`  
  CLI and scaffolding helpers for quick bootstraps.

## Dependency direction

- `packages/*` should contain reusable logic with minimal assumptions about app runtime.
- `apps/*` orchestrate UI/UX and wire workspace packages to concrete runtime behavior.
- `deploy/*` and `.github/workflows/*` describe environment integration and release behavior.

## Suggested maintenance convention

- Add a package-level `README.md` when the module's public interface is stable.
- Keep cross-cutting config in `package.json`, `scripts/*`, and workspace docs instead of per-author ad hoc scripts.

# Deprecated transitive dependencies

`pnpm install` currently emits a small set of deprecated transitive dependency warnings. These are not
first-party dependencies in this repo; they are pulled in by dev tooling or server plugins. Until
upstream packages are upgraded, these warnings are expected.

## Sources
- `@humanwhocodes/config-array@0.11.14` + `@humanwhocodes/object-schema@2.0.3`: pulled by `eslint@8.57.0`
  via `@typescript-eslint/*` and eslint plugins (dev tooling). Upgrading to ESLint v9+ should remove
  these but requires config migration.
- `rimraf@3.0.2`, `glob@7.2.3`, `inflight@1.0.6`: pulled by `eslint@8.57.0` → `file-entry-cache@6.0.1`
  → `flat-cache@3.2.0`. These should clear with future ESLint/flat-cache upgrades.
- `glob@8.1.0`: pulled by `@fastify/static@6.12.0` (via `@fastify/swagger-ui`). Upgrading Fastify static
  to a newer major may remove it.
- `boolean@3.2.0`: pulled by `shellcheck@4.1.0` → `global-agent` → `roarr` (dev tooling). Consider an
  upstream upgrade or replacement when available.
- `node-domexception@1.0.0`: pulled by `node-fetch@3.3.2` (dev dependency) via `fetch-blob` and
  `formdata-polyfill`. Revisit if node-fetch/fetch-blob updates land.
- `whatwg-encoding@3.1.1`: pulled by `jsdom@24.1.0` (Vitest) via `html-encoding-sniffer`. Revisit when
  jsdom updates.

## Next steps
- Revisit during upgrades to ESLint, Fastify static, node-fetch, jsdom, or shellcheck.

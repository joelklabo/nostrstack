# nostrstack architecture (high level)

## Components
- **API (apps/api)**: Fastify + Prisma. Multi-tenant LightningProvider abstraction (LNbits now), Nostr endpoints, LNURLp/NIP-05, payments/webhooks.
- **Lightning backend**: LNbits (staging/prod) backed by Voltage LND; local regtest LNbits for demo.
- **Gallery demo (apps/gallery)**: Vite/React app showcasing widgets; talks to API.
- **Embed package (@nostrstack/widgets)**: Tip/pay/comments widgets, relay badge, invoice popover, user card; exports design tokens.
- **SDK (@nostrstack/sdk)**: Typed client for API.
- **Injector/CLI**: Static-site injector for adding embed script to static outputs.

## Personal Site Kit
- See `docs/architecture/personal-site-kit.md` for component map, config schema, privacy stance, and CSP/CORS guidance.

## Data flow (happy path tip)
Browser widget → API `/api/pay` (tenant lookup) → LightningProvider.createCharge(LNbits) → invoice to browser → payer pays → LNbits webhook → API updates Payment → widgets poll/verify.

## Bitcoin telemetry
- API exposes `/api/bitcoin/status` for configured network, source (`bitcoind`/`esplora`/`mock`), sync/IBD, mempool stats, and Lightning provider health.
- Provider selection via `TELEMETRY_PROVIDER`; use `TELEMETRY_ESPLORA_URL` for Esplora-backed networks (mutinynet/mainnet).

## Tenancy
Tenant resolved from host header or `domain` param. User entries store lightningAddress; LNURLp uses tenant domain + username.

## Environments
- **Local**: SQLite dev DB, regtest LNbits/LND via `scripts/regtest-lndbits.sh`; gallery on 4173, API 3001.
- **Staging**: LNbits container + Voltage mutinynet LND, Postgres, Container Apps.
- **Prod**: LNbits + Voltage mainnet LND (cutover pending).

## Key dependencies
- LNbits + LND, Prisma, Fastify, Playwright (e2e), Vite/React (gallery), pnpm workspace.

## Known risks/gaps (current)
- Relies on tenant seed in dev DB for LNURLp; ensure seeds run.
- Real-relay comments require signer; mock fallback exists.
- Secret handling via Azure KV; need periodic sweeps.
- CI real-relay tests are opt-in.

## Diagrams (todo)
- Sequence diagram for tip/paywall.
- Deployment diagram (API, LNbits, Postgres, LND, relays, gallery).

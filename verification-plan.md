# Demo verification plan

## Lightning (regtest)
1) Start stack: `./scripts/regtest-lndbits.sh up`.
2) Seed dev DB: `cd apps/api && DATABASE_URL=file:./dev.db pnpm exec tsx prisma/seed-dev.ts` (auto-runs on `pnpm dev`).
3) Start API: `DATABASE_URL=file:./dev.db LN_BITS_URL=http://localhost:15001 LN_BITS_API_KEY=<admin> LIGHTNING_PROVIDER=lnbits PUBLIC_ORIGIN=http://localhost:3001 pnpm --filter api dev`.
4) Start gallery: `VITE_API_BASE_URL=http://localhost:3001 VITE_NOSTRSTACK_HOST=localhost:3001 VITE_NOSTRSTACK_RELAYS=wss://relay.damus.io pnpm --filter gallery dev -- --host --port 4173`.
5) Run smoke: `pnpm smoke:regtest-demo` (creates invoice via /api/pay, pays via lnd-payer, asserts PAID).

## Lightning (UI)
- In gallery at http://localhost:4173, click "Send sats" → invoice popover shows QR; pay via `docker compose ... lnd-payer lncli payinvoice <bolt11>`; check `/api/lnurlp/pay/status/<ref>` = PAID.

## Nostr comments (real relays)
- Set relays field to `wss://relay.damus.io`.
- Enable NIP-07 signer (Alby/nos2x). Post a comment; relay pill should show `real`. Verify via `nostr.watch` or `wss://relay.damus.io` subscription for tag `demo-thread`.

## Nostr comments (mock)
- Set relays to `mock`; post comment; appears locally (for offline demo).

## Evidence to collect
- Screenshot of invoice popover + lncli pay success + status PAID.
- Screenshot of comment posted with relay pill showing real + relay subscription showing event.

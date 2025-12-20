# Nostrdb Evaluation for Nostrstack

## Goal
Assess whether integrating nostrdb would materially improve Nostrstack's ability
to render any Nostr event at `nostrstack.com/nostr/<id>` with profiles and
related content.

## Current upstream notes (as of 2025-12-20)
- Embedded C library backed by LMDB with a custom in-memory event representation
  for zero-copy access; design inspired by strfry.
  Source: https://github.com/damus-io/nostrdb
- API is explicitly unstable and under heavy development.
  Source: https://github.com/damus-io/nostrdb
- CLI `ndb` supports `stat`, `search`, `query`, and `import`, with optional
  `--skip-verification`.
  Source: https://github.com/damus-io/nostrdb
- Build step is `make ndb`; README includes fulltext search examples.
  Source: https://github.com/damus-io/nostrdb
- No GitHub releases are currently published (check repo Releases page).
  Source: https://github.com/damus-io/nostrdb

## Fit with Nostrstack's event viewer
Event viewers need:
- Fast fetch by ID (kind 1, 0, 6, 7, 9735, etc.)
- Profile lookup (kind 0) for authors, mentioned pubkeys, and referenced events
- Related event retrieval (repost/quote, replies, zap receipts)
- Basic caching to avoid repeated relay round-trips

nostrdb helps most when:
- You want a local index for large volumes of events
- You need fast fulltext search
- You want relay-like query capabilities backed by local storage

For a server-side `/nostr/:id` viewer, the minimum viable path remains relay
fetch + caching. nostrdb can help, but only after building a bridge layer.

## Integration cost / risk
- C library with an unstable API implies a non-trivial FFI or sidecar service
  for our Node/TypeScript stack.
- CLI is still limited; releases are not published, so tooling and interfaces
  may shift quickly.

## Options
1) **No nostrdb (short-term)**: Build `/nostr/:id` viewer using existing Nostr
   tooling + caching (SQLite/Postgres). Use relay queries to hydrate profiles and
   related notes.
2) **Sidecar service**: Run nostrdb + an RPC layer (Rust/C) that exposes queries
   to the Node API. Keeps the web stack clean while gaining local index speed.
3) **FFI in Node**: Bind nostrdb directly (N-API / node-gyp). Fast but highest
   maintenance risk while API is unstable.

## Recommendation
Short-term: **Do not integrate** nostrdb yet. Build the viewer with relay
fetching + caching, and re-evaluate once nostrdb's API stabilizes and
relay-like queries mature.

Mid-term: If we outgrow relay fetch latency or need fulltext search, adopt
nostrdb via a sidecar service to avoid coupling Node to a rapidly changing C
API.

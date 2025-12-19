# Nostrdb Evaluation for Nostrstack

## Goal
Assess whether integrating nostrdb would materially improve Nostrstack's ability
to render any Nostr event at `nostrstack.com/nostr/<id>` with profiles and
related content.

## What nostrdb is (from upstream)
- Embedded nostr database (C library) backed by LMDB with memory-mapped storage
  and zero-copy access to event fields; design inspired by strfry. Source:
  https://github.com/damus-io/nostrdb
- API is explicitly unstable and under heavy development. Source:
  https://github.com/damus-io/nostrdb
- Includes a CLI (`ndb`) with limited commands (stat, search, query, import) and
  a simple build step (`make ndb`). Source:
  https://github.com/damus-io/nostrdb
- The author describes an ingest API (`ndb_process_event`), a multithreaded
  ingester, and plans for relay-like query behavior in the future. Source:
  https://nostr.com/naddr1qqxnzd3ex5eryvfkx56nydesqgsr9cvzwc652r4m83d86ykplrnm9dg5gwdvzzn8ameanlvut35wy3grqsqqqa282m6u3g

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

For a server-side `/nostr/:id` viewer, the minimum viable path is still relay
fetch + caching. nostrdb can help, but only after building a bridge layer.

## Integration cost / risk
- C library with an unstable API implies a non-trivial FFI or sidecar service
  for our Node/TypeScript stack.
- No published releases on GitHub, and the CLI is still limited, so tooling is
  evolving.

## Options
1) **No nostrdb (short-term)**: Build `/nostr/:id` viewer using existing Nostr
   tooling + caching (Redis/Postgres). Use relay queries to hydrate profiles and
   related notes.
2) **Sidecar service**: Run nostrdb + an RPC layer (Rust/C) that exposes queries
   to the Node API. Lets us keep the web stack clean while gaining local index
   performance.
3) **FFI in Node**: Bind nostrdb directly (N-API / node-gyp). Fast but highest
   maintenance risk while API is unstable.

## Recommendation
Short-term: **Do not integrate** nostrdb yet. Build the viewer with relay
fetching + caching, and re-evaluate once nostrdb's API stabilizes and relay-like
queries mature.

Mid-term: If we outgrow relay fetch latency or need fulltext search, adopt
nostrdb via a sidecar service to avoid coupling Node to a rapidly changing C
API.

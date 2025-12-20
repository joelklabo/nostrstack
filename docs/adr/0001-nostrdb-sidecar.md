# ADR 0001: Nostrdb Sidecar Evaluation

Status: Accepted
Date: 2025-12-20

## Context
- We need fast Nostr event retrieval and caching for the public `/nostr/:id` landing page.
- nostrdb is an embedded C library backed by LMDB with an explicitly unstable API and a
  small CLI (`ndb`) for stat/search/query/import.
  Source: https://github.com/damus-io/nostrdb
- No GitHub releases are currently published; interfaces may shift quickly.
  Source: https://github.com/damus-io/nostrdb

## Decision
- **Do not adopt nostrdb in the current epic.**
- Revisit once nostrdb stabilizes and exposes relay-like queries we can rely on.
- If adopted later, prefer a **sidecar service** with a stable HTTP/RPC boundary
  rather than direct Node FFI.

## Consequences
- Continue with relay fetch + Prisma-backed caching in the API.
- No local fulltext search in the short term.
- If we outgrow relay performance, design a sidecar with endpoints for:
  - fetch by event id
  - fetch profile by pubkey
  - query by kind/author/identifier

## Alternatives Considered
- Direct Node FFI (highest maintenance risk with unstable C API).
- Postgres/SQLite-only caching (already in use; no local fulltext search).

## References
- https://github.com/damus-io/nostrdb

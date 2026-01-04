# Nostr Event Replies API (Design)

## Overview
`/api/nostr/event/:id` returns a resolved Nostr event plus reply metadata for the thread. Replies are used by the `/nostr/:id` view to render a chronological thread without loading an unbounded list.

## NIP alignment
- Threading follows **NIP-10** `e` tags with `root`/`reply` markers when present.
- Mentions/quotes align with **NIP-27** conventions where tag data is available.
- Legacy `e` tags without markers are treated as reply-thread hints:
  - First `e` tag is treated as `root` when determinable.
  - Last `e` tag is treated as `reply`.
  - If ambiguous, fall back to the event id as `replyThreadId`.

## Endpoint
`GET /api/nostr/event/:id`

### Query parameters
- `relays` (string, optional): Comma-separated relay URLs.
- `limitRefs` (int, optional): Max references to return per group.
- `timeoutMs` (int, optional): Relay fetch timeout.
- `replyLimit` (int, optional): Max replies to return (default from env; clamped to max).
- `replyCursor` (string, optional): Opaque cursor for pagination. Use the `replyPage.nextCursor` value.

### Response shape
```json
{
  "target": {
    "input": "...",
    "type": "event",
    "id": "...",
    "relays": ["wss://..."]
  },
  "event": { "id": "...", "kind": 1, "content": "..." },
  "author": { "pubkey": "...", "profile": { "name": "..." } },
  "references": {
    "root": ["..."],
    "reply": ["..."],
    "mention": ["..."],
    "quote": ["..."],
    "address": ["..."],
    "profiles": ["..."]
  },
  "replyThreadId": "<root or target id>",
  "replies": [
    { "id": "...", "created_at": 123, "kind": 1, "content": "..." }
  ],
  "replyPage": {
    "hasMore": true,
    "nextCursor": "opaque"
  }
}
```

## Reply selection + ordering
- Replies are `kind:1` events whose `e` tags reference the thread id.
- Thread id is resolved using NIP-10 markers:
  - If event has an `e` tag marked `root`, use that id as `replyThreadId`.
  - Otherwise use the event id as `replyThreadId`.
- Replies are sorted oldest -> newest (`created_at` ascending), and deduped by event id.
- Ignore circular/malformed references (self-referential `e` tags or missing ids).

## Pagination semantics
- `replyCursor` is an opaque token returned by the API.
- When `hasMore` is true, call again with `replyCursor=nextCursor` to fetch the next page.
- The server must ensure stable ordering when paginating (tie-break by id if needed).

## Validation + error codes
- `replyLimit` must be a positive integer; clamp to max or return `400 invalid_reply_limit`.
- `replyCursor` must be a non-empty string; invalid values return `400 invalid_reply_cursor`.
- Existing error codes remain: `invalid_id`, `invalid_relays`, `not_found`, `invalid_event`, `timeout`.
- Rate limits should return `429 rate_limited` with `Retry-After` when available.

## Caching notes
- Reply pages should use a short TTL cache (in-memory or per-request) to avoid relay bursts.
- Cache key should include thread id + relays + limit + cursor.
- Do not cache invalid signatures or malformed events.

# Nostr Event Landing: Requirements + API Contract

## Goal
Provide a public, shareable landing page at `nostrstack.com/nostr/<id>` that can load any Nostr event (or profile/addressable target), render it safely, and resolve common references with cached API-backed data.

## Supported Identifier Formats
The landing page and API MUST accept the following identifiers (case-insensitive, with optional `nostr:` prefix):

- **Hex event id**: 64 hex chars
- **NIP-19/NIP-21** bech32 forms:
  - `note` / `nevent` (event id)
  - `npub` / `nprofile` (profile pubkey)
  - `naddr` (addressable event: kind + pubkey + identifier)

### Behavior by Target Type
- **Event targets** (`hex`, `note`, `nevent`): return the event + author profile + references.
- **Profile targets** (`npub`, `nprofile`): return the profile event (kind 0) as the primary event.
- **Addressable targets** (`naddr`): resolve by `{kind, pubkey, identifier}`; return the matched event.

## Public Landing Behavior
- Route: `/nostr/:id`
- The page MUST render:
  - event metadata (id, pubkey, kind, created_at)
  - author profile (if available)
  - event content (safe plaintext rendering)
  - reference previews (root/reply/mention/quote/addressable) when present
  - raw JSON (collapsed/expandable)
- Must show explicit **loading**, **error**, and **empty/not found** states.
- Reference previews are resolved by fetching each referenced event/profile from the API (best-effort).

## API Contract

### Endpoint
- `GET /nostr/event/:id`
- Optional mirror: `GET /api/nostr/event/:id`

### Query Parameters (optional)
- `relays` (string): comma-separated relay list. Only `wss://` URLs are accepted (plus `ws://localhost` for dev).
- `limitRefs` (number): maximum number of references per list to return. If omitted, returns full lists (UI still caps display).
- `timeoutMs` (number): per-fetch timeout override in milliseconds.

### Response Shape (200)
```json
{
  "target": {
    "input": "nostr:note1...",
    "type": "event|profile|address",
    "relays": ["wss://relay.damus.io"],
    "id": "<hex>",
    "pubkey": "<hex>",
    "kind": 30023,
    "identifier": "my-article"
  },
  "event": {
    "id": "<hex>",
    "pubkey": "<hex>",
    "created_at": 1710000000,
    "kind": 1,
    "tags": [["e", "..."], ["p", "..."]],
    "content": "...",
    "sig": "<hex>"
  },
  "author": {
    "pubkey": "<hex>",
    "profile": {
      "name": "...",
      "display_name": "...",
      "about": "...",
      "picture": "...",
      "nip05": "...",
      "lud16": "..."
    }
  },
  "references": {
    "root": ["<event-id>", "<event-id>"],
    "reply": ["<event-id>"],
    "mention": ["<event-id>"],
    "quote": ["<event-id>"],
    "address": ["<kind:pubkey:identifier>"],
    "profiles": ["<pubkey>"]
  }
}
```

Notes:
- `target.id` is set for `event` targets, `target.pubkey` for `profile` targets, and `target.kind`/`target.identifier` for `address` targets.
- The API does **not** return reference previews; the UI requests each reference separately.

### Error Response (4xx/5xx)
```json
{
  "error": "invalid_id|invalid_relays|not_found|timeout|no_relays|invalid_event|internal_error",
  "message": "Human readable error string",
  "requestId": "<uuid>"
}
```

### Example Requests
- `https://nostrstack.com/nostr/note1...`
- `https://nostrstack.com/nostr/0cfe7d17c5bccff73b56dd96c5144835e2effda9a9895927c475a74f98013640`
- `GET https://nostrstack.com/api/nostr/event/nprofile1...?relays=wss://relay.damus.io`

## Caching Requirements
- Read-through cache for resolved events (and associated author profiles).
- Default TTL: **600 seconds** (`NOSTR_EVENT_CACHE_TTL_SECONDS`).
- Cache size cap: `NOSTR_EVENT_CACHE_MAX_ENTRIES` (default 2000).
- Cache is bypassed when TTL is 0 or Prisma is unavailable.

## Relay Fetching Rules
- Use relay hints from `nevent` / `nprofile` / `naddr` if present.
- Merge with `NOSTR_RELAYS` server config; fall back to the default relay list when empty.
- Enforce max relays (`NOSTR_EVENT_MAX_RELAYS`, default 8).
- Timeout per fetch (`NOSTR_EVENT_FETCH_TIMEOUT_MS`, default 8000ms).

## Performance Targets
- Median fetch time under 1.5s when cached.
- 95th percentile under 6s for relay fetches.
- Limit reference previews in UI to avoid excessive relay calls.

## UX States
- **Loading**: show “Fetching event data...” and a soft spinner.
- **Error**: show clear reason (invalid id, not found, timeout) and retry option.
- **Partial data**: show event even if some references fail; show placeholders.

## Security + Safety
- Validate input length and format.
- Only allow `wss://` relay URLs (`ws://localhost` allowed for dev).
- Verify event signatures and id consistency before caching/rendering.
- Render event content as text only; never inject HTML.

## Edge Cases
- Invalid/malformed IDs
- Events missing content/tags
- Profile events with invalid JSON
- Relays down or partially failing
- Extremely long content (truncate preview text)

## Assumptions
- Server-side resolver is the source of truth; gallery falls back to direct relay fetch only if the API fails.
- Reference previews are capped and best-effort, not guaranteed.

## Standing Note
While implementing any part of this feature, **always** look for refactoring opportunities, bug fixes, and improvements. Create new bd tasks for any such findings.

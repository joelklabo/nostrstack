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

## API Contract

### Endpoint
- `GET /nostr/event/:id`
- Optional mirror: `GET /api/nostr/event/:id`

### Query Parameters (optional)
- `relays` (string): comma-separated wss relay list. Only accepted if valid `wss://` URLs.
- `limitRefs` (number): maximum number of reference previews to return (default 6).
- `timeoutMs` (number): per-fetch timeout override, bounded to sane limits.

### Response Shape (200)
```json
{
  "target": {
    "input": "nostr:note1...",
    "type": "event|profile|address",
    "canonical": "note1...",
    "relays": ["wss://relay.damus.io"],
    "address": { "kind": 30023, "pubkey": "...", "identifier": "my-article" }
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
    "root": ["<event-id>", "<event-id>"] ,
    "reply": ["<event-id>"] ,
    "mention": ["<event-id>"] ,
    "quote": ["<event-id>"] ,
    "address": ["<kind:pubkey:identifier>"] ,
    "profiles": ["<pubkey>"]
  },
  "referencePreviews": [
    {
      "type": "event|profile|address",
      "id": "<hex>",
      "note": "note1...",
      "kind": 1,
      "pubkey": "<hex>",
      "created_at": 1710000000,
      "summary": "short preview text",
      "profile": { "name": "...", "picture": "..." }
    }
  ],
  "cache": {
    "hit": true,
    "stale": false,
    "fetchedAt": "2025-12-20T18:30:00.000Z",
    "ttlSeconds": 600
  }
}
```

### Error Response (4xx/5xx)
```json
{
  "error": "invalid_id|not_found|timeout|relay_unavailable|internal_error",
  "message": "Human readable error string",
  "requestId": "<uuid>"
}
```

## Caching Requirements
- Read-through cache for resolved event payloads (including author profile and reference previews).
- Default TTL: **10 minutes** (configurable).
- **Stale-while-revalidate**: serve stale data when TTL expired and refresh in the background when possible.
- Store relay list + fetchedAt + ttl in cache metadata.
- Cache must be invalidated if signature verification fails.

## Relay Fetching Rules
- Use relay hints from `nevent`/`nprofile`/`naddr` if present.
- Merge with `VITE_NOSTRSTACK_RELAYS` / server config.
- Enforce a max relay count (default 8).
- Timeout per relay fetch (default 8000ms).

## Performance Targets
- Median fetch time under 1.5s when cached.
- 95th percentile under 6s for relay fetches.
- Limit reference previews to avoid excessive relay calls.

## UX States
- **Loading**: show “Fetching event data...” and a soft spinner.
- **Error**: show clear reason (invalid id, not found, timeout) and retry option.
- **Partial data**: show event even if some references fail; show placeholders.

## Security + Safety
- Validate input length and format.
- Only allow `wss://` relay URLs (unless explicitly allowlisted).
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

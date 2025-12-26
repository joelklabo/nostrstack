# Identifier resolution & trust model

## Purpose
Define how we resolve user-provided identifiers (npub/nprofile/hex pubkey/nip05/lightning address) into a canonical pubkey and what trust signals we surface in UI.

## Inputs supported
- npub (bech32)
- nprofile (bech32 with pubkey + relays)
- hex pubkey (64 hex chars)
- nip05 (name@domain)
- lightning address (name@domain) and LNURL (bech32/URL)

## Output model
```
ProfileRef {
  pubkey: string;          // 64-char hex
  source: 'npub' | 'nprofile' | 'hex' | 'nip05' | 'lightning';
  nip05?: string;          // name@domain when verified
  relays?: string[];       // optional (from nprofile or nip05 relays)
  lightning?: string;      // normalized lightning address or lnurl
  verified?: boolean;      // only true for nip05 verified
}
```

## Resolution order (client)
1) Trim input, strip leading `nostr:` if present.
2) Detect bech32 prefix:
   - `npub`: decode -> pubkey.
   - `nprofile`: decode -> pubkey + relays.
   - Any other bech32 prefix -> invalid.
3) Detect 64-char hex -> pubkey.
4) Detect `name@domain` -> classify as nip05 or lightning address.
   - If user explicitly selects "NIP-05" mode, treat as nip05.
   - Otherwise attempt nip05 resolution first; if nip05 fails, fall back to lightning address only (no pubkey).
5) Detect LNURL (bech32 or https URL) -> lightning address (no pubkey).

## NIP-05 resolution (server proxy)
- Request: `GET /api/nostr/identity?nip05=name@domain`
- Server performs:
  - Parse name/domain; reject invalid characters and length.
  - Fetch `https://domain/.well-known/nostr.json?name=<name>`.
  - Reject redirects, non-HTTPS, and oversized responses.
  - Validate JSON schema: `names` map required; `relays` optional.
  - If `names[name]` exists, return pubkey + relays.

## Trust model
- **Verified**: nip05 resolved via proxy and pubkey matches mapping for name.
- **Unverified**: direct bech32 or hex input; no third-party check.
- **Lightning-only**: lightning address provided without pubkey; usable for sending sats, not for profile nav.

UI should reflect trust:
- Show "Verified" badge only for nip05 verified.
- Show "Direct" label for npub/hex/nprofile.
- Show "Lightning only" label for LN address without pubkey.

## Cache policy
- Server proxy caches:
  - Success: TTL 10 min (configurable).
  - Negative (not found / invalid): TTL 2 min.
- Client caches resolved ProfileRef in-memory for session duration (no persistence).

## Error taxonomy (client)
- `invalid_format`: does not match supported patterns.
- `decode_failed`: bech32 or hex decode error.
- `nip05_unreachable`: network/timeout.
- `nip05_invalid`: response missing names map or invalid JSON.
- `nip05_mismatch`: name exists but pubkey invalid.
- `lightning_only`: no pubkey resolved; show limited actions.

## Security considerations
- HTTPS-only for nip05 lookups (except localhost in dev if explicitly allowed).
- No redirects; do not follow to avoid SSRF.
- Max response size (e.g. 64KB).
- Timeout per request (e.g. 3s) and overall budget (e.g. 5s).

## UI implications
- Surface inline errors near the input field.
- Provide examples for valid formats.
- Allow retry for transient nip05 errors.

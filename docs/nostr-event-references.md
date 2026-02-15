# Nostr Event References: Resolution Rules + UI Behavior

## Purpose

Define how `/nostr/:id` resolves and presents references to other events and profiles. This spec combines tag-based references (NIP-10 style) with inline `nostr:` mentions (NIP-27).

## Reference Sources

1. **Tag-based references**
   - `e` tags (events)
   - `a` tags (addressable events)
   - `q` tags (quote references)
   - `p` tags (pubkey mentions)
2. **Inline mentions in content**
   - `nostr:<bech32>` links in event content

## Tag Interpretation

### `e` tags (event references)

- Prefer NIP-10 markers in tag position 3 when present:
  - `root`: thread root
  - `reply`: direct reply
  - `mention`: unstructured mention
- If no markers exist:
  - Treat the **first** `e` tag as `root` and the **last** as `reply` (legacy positional convention).
  - All others become `mention`.

### `a` tags (addressable references)

- `a` tag format: `kind:pubkey:identifier` (may include relay hint).
- Treated as **addressable references** and displayed as a separate section.

### `q` tags (quote references)

- Treat each `q` tag as a **quoted event** reference.

### `p` tags (pubkey mentions)

- Treated as **profile mentions** and displayed as chips.

## Inline `nostr:` Mentions (NIP-27)

- Parse any `nostr:` URI in event content.
- Supported bech32 types: `note`, `nevent`, `npub`, `nprofile`, `naddr`.
- Convert to canonical ids and **deduplicate** with tag-based references.
- Render inline as internal links to `/nostr/<id>`.

## De-duplication Rules

- De-dupe by canonical event id or addressable coordinate.
- If both tag-based and inline mention exist, keep **one** preview entry.
- For profiles, de-dupe pubkeys.

## Ordering Rules (UI)

Display references in this order:

1. Root (single, if present)
2. Reply (single, if present)
3. Quotes (up to limit)
4. Addressable references (up to limit)
5. Mentions (events, up to limit)
6. Profile mentions (pubkeys, chips)

## Limits

- Default max previews: **6** total (configurable).
- Hard cap per category: **3** (root + reply are special and always allowed).
- If more references exist, show a “+N more” indicator.

## UI Mapping

- **Root**: “Thread root” section
- **Reply**: “In reply to” section
- **Quotes**: “Quoted events” section
- **Addressable**: “Addressable references” section
- **Mentions**: “Mentions” section
- **Profiles**: “Mentioned profiles” chip list

## Edge Cases

- Conflicting markers: prefer `root` and `reply` markers; ignore duplicates.
- Missing root but reply present: show reply only.
- Too many references: cap + show overflow count.
- Mixed hex + bech32: always normalize to hex internally, render bech32 in UI.

## Standing Note

While implementing any part of this feature, **always** look for refactoring opportunities, bug fixes, and improvements.

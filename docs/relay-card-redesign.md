# Relay Card Redesign

## Goals
- Make relay pills information-dense and “alive” by surfacing rich metadata, health, and recent activity in one glance.
- Provide affordances to act (copy URL, open dashboard, pin/unpin) directly from the card.
- Keep the layout compact so multiple relays can be scanned side-by-side.

## Current State (web `RelayCard`)
- Shows host, optional `name` and `software`, recv count, last activity, and a tiny sparkline.
- Activity and send status are coupled into one color; states like auth-required, paid relay, or unsupported NIPs are invisible.
- No quick actions (copy/share/open), and no indication of relay quality (uptime/latency/limits).

## Relay Metadata We Can Surface
- **NIP-11 Relay Information Document**: `name`, `description`, `pubkey`, `contact`, `supported_nips`, `software`, `version`, `icon`, `language`, `tags`, `payments_url`, `limitation.*` (max message length, subscription/filter limits, retention windows, auth/payment requirements). citeturn1search1turn1search8
- **Operational signals**: online/offline, median latency/ping, recent availability windows from relay probes (e.g., nostr.watch API exposes `status` and round-trip metrics per relay). citeturn1search7
- **Content/feature hints**: supported NIPs (e.g., NIP-09 deletion, NIP-50 search, NIP-45 ephemeral), payment requirements, rate limits.
- **Activity pulses**: recent recv/send counts, last event timestamps (already tracked locally), plus rolling throughput (events per minute) derived from recent recv counter deltas.

## Inspiration
- **nostr.watch** surfaces health/latency badges and lets users drill into relay details quickly. citeturn1search7
- **nostr.design** showcases compact, card-based relay/module layouts with clear primary + secondary text hierarchy. citeturn0search0

## Proposed UX & Layout
Compact 3-column grid (avatar/status | main stack | metrics/actions):

1) **Status chip + avatar**
   - Colored dot with pulse for live traffic; tooltip shows last event and last send times.
   - Small relay icon (NIP-11 `icon` if present) fallback to generated hash glyph.

2) **Heading stack**
   - Primary: host (monospace) + optional verified badge if `auth_required`/`payment_required`.
   - Secondary: `name` and short `description` snippet; software + version tag.
   - Support tags row (tiny pills) for top NIPs (e.g., 05/09/11/15/33/50), payment-required, auth-required, language.

3) **Live metrics rail** (right aligned)
   - Health pill: `online/offline` with latency (ms) and uptime % (last 24h if available).
   - Activity sparkline: 16-bar mini chart using recent recv delta history (local buffer) with “recvm” label (events/min).
   - Retention/limits: e.g., “retains 7d · max 20 filters” derived from `limitation`.
   - Action row: copy relay URL, open nostr.watch page, toggle pin/disable; share as `git+` URL when present.

## Data & Engineering Plan
1) **NIP-11 fetch & cache**
   - Expand existing fetch to capture all documented fields and store in `RelayStats` (name, description, icon, software, version, supported_nips, contact, pubkey, payments_url, language, tags, limitation, payment_required/auth_required flags).
   - Cache per relay in memory with `updated_at`; respect `Access-Control` failures gracefully.

2) **Health probe enhancements**
   - Measure connect handshake latency (ms) during existing probe; track rolling average and last success timestamp.
   - Store `online` boolean and last error to show precise failure reasons.

3) **Activity window**
   - Keep a small ring buffer per relay of recv counts sampled every 10s to compute recent events/min for sparkline.

4) **UI pass**
   - Implement new 3-column layout, tag chips, health pill, and action buttons; support light/dark palettes.

5) **Story/tests**
   - Add Storybook states (online/offline, paid, auth-required, slow, high-traffic) and a Playwright screenshot test.

## Task Links
- Epic: `lightning-v01`
- Research/plan: `lightning-v01.1`
- UI implementation: `lightning-v01.2`
- Metadata/stats pipeline: `lightning-v01.3`
- Stories/tests: `lightning-v01.4`

import { nip19 } from 'nostr-tools';

import { type InlineMentions } from './types.js';
import { uniq } from './utils.js';

const NOSTR_URI_RE = /nostr:([0-9a-z]+)/gi;

/**
 * Parse inline nostr: mentions from event content.
 * Returns arrays of event IDs, profile pubkeys, and address references.
 */
export function parseInlineMentions(content?: string): InlineMentions {
  const events: string[] = [];
  const profiles: string[] = [];
  const addresses: string[] = [];
  if (!content) return { events, profiles, addresses };

  for (const match of content.matchAll(NOSTR_URI_RE)) {
    const token = match[1];
    if (!token) continue;
    try {
      const decoded = nip19.decode(token.toLowerCase());
      if (decoded.type === 'note') {
        events.push(decoded.data as string);
      } else if (decoded.type === 'nevent') {
        const data = decoded.data as { id: string };
        if (data?.id) events.push(data.id);
      } else if (decoded.type === 'npub') {
        profiles.push(decoded.data as string);
      } else if (decoded.type === 'nprofile') {
        const data = decoded.data as { pubkey: string };
        if (data?.pubkey) profiles.push(data.pubkey);
      } else if (decoded.type === 'naddr') {
        const data = decoded.data as { kind: number; pubkey: string; identifier: string };
        if (data?.pubkey && data?.identifier != null && data?.kind != null) {
          addresses.push(`${data.kind}:${data.pubkey}:${data.identifier}`);
        }
      }
    } catch {
      // ignore invalid mentions
    }
  }

  return {
    events: uniq(events),
    profiles: uniq(profiles),
    addresses: uniq(addresses)
  };
}

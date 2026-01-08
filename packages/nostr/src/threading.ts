import { type Event } from 'nostr-tools';

import { type ThreadingReferences } from './types.js';
import { isHex64, uniq } from './utils.js';

type ThreadingOptions = {
  selfId?: string;
};

function normalizeEventId(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!isHex64(normalized)) return null;
  return normalized;
}

/**
 * Extract thread references from an event's e-tags (NIP-10).
 * Returns root, reply, and mention references with proper marker handling.
 */
export function extractThreadReferences(
  event: Event,
  options: ThreadingOptions = {}
): ThreadingReferences {
  const root: string[] = [];
  const reply: string[] = [];
  const mention: string[] = [];
  const unmarked: string[] = [];

  const selfId = options.selfId?.trim().toLowerCase();

  for (const tag of event.tags) {
    if (tag[0] !== 'e') continue;
    const rawId = tag[1];
    if (!rawId) continue;
    const id = normalizeEventId(rawId);
    if (!id) continue;
    const marker = tag[3];

    // Skip self-references unless marked as root
    if (selfId && id === selfId && marker !== 'root') continue;

    if (marker === 'root') root.push(id);
    else if (marker === 'reply') reply.push(id);
    else if (marker === 'mention') mention.push(id);
    else unmarked.push(id);
  }

  // NIP-10 fallback: first unmarked is root, last unmarked is reply
  const firstUnmarked = unmarked[0];
  const lastUnmarked = unmarked[unmarked.length - 1];
  if (root.length === 0 && firstUnmarked !== undefined) root.push(firstUnmarked);
  if (reply.length === 0 && unmarked.length > 1 && lastUnmarked !== undefined) reply.push(lastUnmarked);

  // Remaining unmarked become mentions
  const used = new Set([...root, ...reply]);
  for (const id of unmarked) {
    if (!used.has(id)) mention.push(id);
  }

  return {
    root: uniq(root),
    reply: uniq(reply),
    mention: uniq(mention)
  };
}

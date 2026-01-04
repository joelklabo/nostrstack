import { type Event } from 'nostr-tools';

import { isHex64, uniq } from './nostr-utils.js';

export type ThreadingReferences = {
  root: string[];
  reply: string[];
  mention: string[];
};

type ThreadingOptions = {
  selfId?: string;
};

function normalizeEventId(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!isHex64(normalized)) return null;
  return normalized;
}

export function extractThreadReferences(event: Event, options: ThreadingOptions = {}): ThreadingReferences {
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
    if (selfId && id === selfId && marker !== 'root') continue;
    if (marker === 'root') root.push(id);
    else if (marker === 'reply') reply.push(id);
    else if (marker === 'mention') mention.push(id);
    else unmarked.push(id);
  }

  if (root.length === 0 && unmarked.length > 0) root.push(unmarked[0]);
  if (reply.length === 0 && unmarked.length > 1) reply.push(unmarked[unmarked.length - 1]);

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

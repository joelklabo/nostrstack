export function normalizeRelays(relays: string[]) {
  return relays
    .map((relay) => relay.trim())
    .filter(Boolean);
}

export function mergeRelays(...lists: Array<string[] | undefined>) {
  const merged: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const relay of normalizeRelays(list)) {
      if (!merged.includes(relay)) merged.push(relay);
    }
  }
  return merged;
}

export function selectRelays(options: {
  targetRelays?: string[];
  overrideRelays?: string[];
  defaultRelays?: string[];
  maxRelays?: number;
}) {
  const merged = mergeRelays(options.overrideRelays, options.targetRelays, options.defaultRelays);
  if (options.maxRelays && merged.length > options.maxRelays) {
    return merged.slice(0, options.maxRelays);
  }
  return merged;
}

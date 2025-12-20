const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isAllowedRelayUrl(relay: string) {
  if (!relay) return false;
  try {
    const url = new URL(relay);
    if (url.protocol === 'wss:') return true;
    if (url.protocol === 'ws:' && LOCALHOST_HOSTS.has(url.hostname)) return true;
  } catch {
    return false;
  }
  return false;
}

export function normalizeRelays(relays: string[]) {
  return relays
    .map((relay) => relay.trim())
    .filter(Boolean)
    .filter(isAllowedRelayUrl);
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

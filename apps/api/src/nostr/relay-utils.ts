const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type RelayFilters = {
  allowlist?: string[];
  denylist?: string[];
};

type RelayPattern = {
  host: string;
  wildcard: boolean;
  matchAll: boolean;
};

function normalizeHostname(hostname: string) {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function parsePattern(raw: string): RelayPattern | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === '*') return { host: '*', wildcard: false, matchAll: true };
  let host = trimmed;
  if (/^wss?:\/\//i.test(trimmed)) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      return null;
    }
  } else {
    host = trimmed.split('/')[0];
    host = host.split('@').pop() ?? host;
    if (host.startsWith('[') && host.includes(']')) {
      host = host.slice(1, host.indexOf(']'));
    } else if (host.includes(':')) {
      host = host.split(':')[0];
    }
  }
  const wildcard = host.startsWith('*.');
  const normalized = wildcard ? host.slice(2).toLowerCase() : host.toLowerCase();
  if (!normalized) return null;
  return { host: normalized, wildcard, matchAll: false };
}

function matchesPattern(hostname: string, pattern: RelayPattern) {
  if (pattern.matchAll) return true;
  const host = hostname.toLowerCase();
  if (pattern.wildcard) {
    return host === pattern.host || host.endsWith(`.${pattern.host}`);
  }
  return host === pattern.host;
}

function compilePatterns(list?: string[]) {
  return (list ?? []).map(parsePattern).filter((pattern): pattern is RelayPattern => Boolean(pattern));
}

export function isAllowedRelayUrl(relay: string, filters: RelayFilters = {}) {
  if (!relay) return false;
  try {
    const url = new URL(relay);
    const hostname = normalizeHostname(url.hostname);
    if (url.protocol === 'wss:') return passesFilters(hostname, filters);
    if (url.protocol === 'ws:' && LOCALHOST_HOSTS.has(hostname)) {
      return passesFilters(hostname, filters);
    }
  } catch {
    return false;
  }
  return false;
}

function passesFilters(hostname: string, filters: RelayFilters) {
  const denyPatterns = compilePatterns(filters.denylist);
  if (denyPatterns.some((pattern) => matchesPattern(hostname, pattern))) return false;
  const allowPatterns = compilePatterns(filters.allowlist);
  if (allowPatterns.length === 0) return true;
  return allowPatterns.some((pattern) => matchesPattern(hostname, pattern));
}

export function normalizeRelays(relays: string[], filters: RelayFilters = {}) {
  return relays
    .map((relay) => relay.trim())
    .filter(Boolean)
    .filter((relay) => isAllowedRelayUrl(relay, filters));
}

export function mergeRelays(filters: RelayFilters, ...lists: Array<string[] | undefined>) {
  const merged: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const relay of normalizeRelays(list, filters)) {
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
  allowlist?: string[];
  denylist?: string[];
}) {
  const merged = mergeRelays(
    { allowlist: options.allowlist, denylist: options.denylist },
    options.overrideRelays,
    options.targetRelays,
    options.defaultRelays
  );
  if (options.maxRelays && merged.length > options.maxRelays) {
    return merged.slice(0, options.maxRelays);
  }
  return merged;
}

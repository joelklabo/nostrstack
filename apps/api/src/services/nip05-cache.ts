export type Nip05Record = {
  pubkey: string;
  relays?: string[];
  nip05: string;
  name: string;
  domain: string;
  fetchedAt: number;
};

type CacheEntry = {
  value: Nip05Record | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function pruneExpired(now: number) {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function getNip05Cache(key: string, now: number = Date.now()) {
  pruneExpired(now);
  const entry = cache.get(key);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

export function setNip05Cache(key: string, value: Nip05Record, ttlMs: number, now: number = Date.now()) {
  if (ttlMs <= 0) return;
  pruneExpired(now);
  cache.set(key, { value, expiresAt: now + ttlMs });
}

export function setNip05NegativeCache(key: string, ttlMs: number, now: number = Date.now()) {
  if (ttlMs <= 0) return;
  pruneExpired(now);
  cache.set(key, { value: null, expiresAt: now + ttlMs });
}

export function clearNip05Cache() {
  cache.clear();
}

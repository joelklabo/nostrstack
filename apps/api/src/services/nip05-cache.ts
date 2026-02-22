import type { PrismaClient } from '@prisma/client';

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

const memoryCache = new Map<string, CacheEntry>();

function pruneExpiredMemory(now: number) {
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

export function getNip05Cache(key: string, now: number = Date.now()) {
  pruneExpiredMemory(now);
  const entry = memoryCache.get(key);
  if (!entry) return { hit: false, value: null };
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

export function setNip05Cache(
  key: string,
  value: Nip05Record,
  ttlMs: number,
  now: number = Date.now()
) {
  if (ttlMs <= 0) return;
  pruneExpiredMemory(now);
  memoryCache.set(key, { value, expiresAt: now + ttlMs });
}

export function setNip05NegativeCache(key: string, ttlMs: number, now: number = Date.now()) {
  if (ttlMs <= 0) return;
  pruneExpiredMemory(now);
  memoryCache.set(key, { value: null, expiresAt: now + ttlMs });
}

export function clearNip05Cache() {
  memoryCache.clear();
}

export async function clearNip05CacheDb(prisma: PrismaClient): Promise<void> {
  await prisma.nip05Cache.deleteMany({});
}

function serializeRelays(relays?: string[]) {
  return relays ? JSON.stringify(relays) : null;
}

function parseRelays(raw?: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function getNip05CacheDb(
  prisma: PrismaClient,
  key: string,
  now: Date = new Date()
): Promise<{ hit: boolean; value: Nip05Record | null; isNegative: boolean }> {
  const cached = await prisma.nip05Cache.findUnique({
    where: { cacheKey: key }
  });

  if (!cached) return { hit: false, value: null, isNegative: false };

  if (cached.expiresAt <= now) {
    await prisma.nip05Cache.delete({ where: { id: cached.id } });
    return { hit: false, value: null, isNegative: false };
  }

  const isNegative = cached.pubkey === '';

  return {
    hit: true,
    value: isNegative
      ? null
      : {
          pubkey: cached.pubkey,
          relays: parseRelays(cached.relays),
          nip05: cached.nip05,
          name: cached.name,
          domain: cached.domain,
          fetchedAt: cached.fetchedAt.getTime()
        },
    isNegative
  };
}

export async function setNip05CacheDb(
  prisma: PrismaClient,
  key: string,
  value: Nip05Record,
  ttlSeconds: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.nip05Cache.upsert({
    where: { cacheKey: key },
    update: {
      pubkey: value.pubkey,
      relays: serializeRelays(value.relays),
      nip05: value.nip05,
      name: value.name,
      domain: value.domain,
      fetchedAt: new Date(value.fetchedAt),
      expiresAt
    },
    create: {
      cacheKey: key,
      pubkey: value.pubkey,
      relays: serializeRelays(value.relays),
      nip05: value.nip05,
      name: value.name,
      domain: value.domain,
      fetchedAt: new Date(value.fetchedAt),
      expiresAt
    }
  });
}

export async function setNip05NegativeCacheDb(
  prisma: PrismaClient,
  key: string,
  ttlSeconds: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.nip05Cache.upsert({
    where: { cacheKey: key },
    update: {
      pubkey: '',
      relays: null,
      nip05: key,
      name: key.split('@')[0] || '',
      domain: key.split('@')[1] || '',
      fetchedAt: new Date(),
      expiresAt
    },
    create: {
      cacheKey: key,
      pubkey: '',
      relays: null,
      nip05: key,
      name: key.split('@')[0] || '',
      domain: key.split('@')[1] || '',
      fetchedAt: new Date(),
      expiresAt
    }
  });
}

export async function pruneExpiredNip05Cache(prisma: PrismaClient, now: Date = new Date()) {
  const result = await prisma.nip05Cache.deleteMany({
    where: { expiresAt: { lt: now } }
  });
  return result.count;
}

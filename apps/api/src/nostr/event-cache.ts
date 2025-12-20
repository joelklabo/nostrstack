import type { PrismaClient } from '@prisma/client';
import type { Event } from 'nostr-tools';

import { pruneExpiredNostrCache } from '../services/cache-prune.js';
import type { NostrTarget } from './nostr-utils.js';

export type CachedEvent = {
  event: Event;
  relays: string[];
  fetchedAt: Date;
  expiresAt: Date;
  source: 'event' | 'address' | 'profile';
};

function parseRelays(raw?: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeRelays(relays: string[]) {
  return JSON.stringify(relays);
}

function parseEvent(raw: string) {
  return JSON.parse(raw) as Event;
}

function serializeEvent(event: Event) {
  return JSON.stringify(event);
}

export async function getCachedEvent(
  prisma: PrismaClient,
  target: NostrTarget,
  now: Date = new Date()
): Promise<CachedEvent | null> {
  if (target.type === 'address') {
    const cached = await prisma.nostrAddressCache.findUnique({
      where: {
        kind_pubkey_identifier: {
          kind: target.kind,
          pubkey: target.pubkey,
          identifier: target.identifier
        }
      }
    });
    if (!cached) return null;
    if (cached.expiresAt <= now) {
      await prisma.nostrAddressCache.delete({ where: { id: cached.id } });
      return null;
    }
    return {
      event: parseEvent(cached.eventJson),
      relays: parseRelays(cached.relays),
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
      source: 'address'
    };
  }

  if (target.type === 'profile') {
    const cached = await prisma.nostrEventCache.findFirst({
      where: { pubkey: target.pubkey, kind: 0 },
      orderBy: { fetchedAt: 'desc' }
    });
    if (!cached) return null;
    if (cached.expiresAt <= now) {
      await prisma.nostrEventCache.delete({ where: { id: cached.id } });
      return null;
    }
    return {
      event: parseEvent(cached.eventJson),
      relays: parseRelays(cached.relays),
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
      source: 'profile'
    };
  }

  const cached = await prisma.nostrEventCache.findUnique({
    where: { eventId: target.id }
  });
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    await prisma.nostrEventCache.delete({ where: { id: cached.id } });
    return null;
  }

  return {
    event: parseEvent(cached.eventJson),
    relays: parseRelays(cached.relays),
    fetchedAt: cached.fetchedAt,
    expiresAt: cached.expiresAt,
    source: 'event'
  };
}

export async function storeCachedEvent(
  prisma: PrismaClient,
  input: {
    event: Event;
    relays: string[];
    fetchedAt: Date;
    ttlSeconds: number;
    target?: NostrTarget;
  }
) {
  const expiresAt = new Date(input.fetchedAt.getTime() + input.ttlSeconds * 1000);
  const payload = {
    eventId: input.event.id,
    eventJson: serializeEvent(input.event),
    pubkey: input.event.pubkey,
    kind: input.event.kind,
    relays: serializeRelays(input.relays),
    fetchedAt: input.fetchedAt,
    expiresAt
  };

  await prisma.nostrEventCache.upsert({
    where: { eventId: input.event.id },
    update: payload,
    create: payload
  });

  if (input.target?.type === 'address') {
    await prisma.nostrAddressCache.upsert({
      where: {
        kind_pubkey_identifier: {
          kind: input.target.kind,
          pubkey: input.target.pubkey,
          identifier: input.target.identifier
        }
      },
      update: {
        ...payload,
        kind: input.target.kind,
        pubkey: input.target.pubkey,
        identifier: input.target.identifier
      },
      create: {
        ...payload,
        kind: input.target.kind,
        pubkey: input.target.pubkey,
        identifier: input.target.identifier
      }
    });
  }

  await pruneExpiredNostrCache(prisma);
}

import type { PrismaClient } from '@prisma/client';
import { type Event, SimplePool, validateEvent, verifyEvent } from 'nostr-tools';

import { getCachedEvent, storeCachedEvent } from './event-cache.js';
import {
  decodeNostrTarget,
  getTagValues,
  type NostrTarget,
  parseInlineMentions,
  parseProfileContent,
  type ProfileMeta,
  uniq
} from './nostr-utils.js';
import { selectRelays } from './relay-utils.js';

export type ResolvedAuthor = {
  pubkey: string;
  profile: ProfileMeta | null;
  profileEvent?: Event | null;
};

export type ResolvedReferences = {
  root: string[];
  reply: string[];
  mention: string[];
  quote: string[];
  address: string[];
  profiles: string[];
};

export type ResolvedEvent = {
  target: NostrTarget;
  event: Event;
  author: ResolvedAuthor;
  relays: string[];
  references: ResolvedReferences;
};

export type ResolveOptions = {
  relays?: string[];
  defaultRelays?: string[];
  maxRelays?: number;
  timeoutMs?: number;
  referenceLimit?: number;
  cacheTtlSeconds?: number;
  prisma?: PrismaClient;
};

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = globalThis.setTimeout(() => {
        globalThis.clearTimeout(id);
        reject(new Error('Request timed out'));
      }, ms);
    })
  ]);
}

const MAX_INPUT_LENGTH = 512;

function isVerifiedEvent(event: Event) {
  return validateEvent(event) && verifyEvent(event);
}

function limitList(list: string[], limit?: number) {
  if (!limit || list.length <= limit) return list;
  return list.slice(0, limit);
}

function normalizeEventId(id: string) {
  return id.trim().toLowerCase();
}

function normalizeCoordinate(coord: string) {
  return coord.trim().toLowerCase();
}

function extractReferences(event: Event, limit?: number): ResolvedReferences {
  const root: string[] = [];
  const reply: string[] = [];
  const mention: string[] = [];
  const quote: string[] = [];
  const address: string[] = [];
  const profiles: string[] = [];

  const unmarked: string[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== 'e') continue;
    const id = tag[1];
    if (!id) continue;
    const marker = tag[3];
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

  quote.push(...getTagValues(event, 'q'));
  address.push(...getTagValues(event, 'a'));
  profiles.push(...getTagValues(event, 'p'));

  const inline = parseInlineMentions(event.content);
  mention.push(...inline.events);
  address.push(...inline.addresses);
  profiles.push(...inline.profiles);

  const normalizedRoot = uniq(root.map(normalizeEventId));
  const normalizedReply = uniq(reply.map(normalizeEventId));
  const normalizedMention = uniq(mention.map(normalizeEventId));
  const normalizedQuote = uniq(quote.map(normalizeEventId));
  const normalizedAddress = uniq(address.map(normalizeCoordinate));
  const normalizedProfiles = uniq(profiles.map(normalizeEventId));

  return {
    root: limitList(normalizedRoot, limit),
    reply: limitList(normalizedReply, limit),
    mention: limitList(normalizedMention, limit),
    quote: limitList(normalizedQuote, limit),
    address: limitList(normalizedAddress, limit),
    profiles: limitList(normalizedProfiles, limit)
  };
}

async function fetchEventByTarget(
  pool: SimplePool,
  target: NostrTarget,
  relays: string[],
  timeoutMs: number
) {
  if (target.type === 'event') {
    return withTimeout(pool.get(relays, { ids: [target.id] }), timeoutMs);
  }
  if (target.type === 'profile') {
    return withTimeout(pool.get(relays, { kinds: [0], authors: [target.pubkey] }), timeoutMs);
  }
  return withTimeout(
    pool.get(relays, { kinds: [target.kind], authors: [target.pubkey], '#d': [target.identifier] }),
    timeoutMs
  );
}

async function fetchAuthorProfile(pool: SimplePool, pubkey: string, relays: string[], timeoutMs: number) {
  return withTimeout(pool.get(relays, { kinds: [0], authors: [pubkey] }), timeoutMs);
}

export async function resolveNostrEvent(rawId: string, options: ResolveOptions = {}): Promise<ResolvedEvent> {
  const cleanedInput = rawId.trim();
  if (!cleanedInput || cleanedInput.length > MAX_INPUT_LENGTH) {
    throw new Error('invalid_id');
  }
  const target = decodeNostrTarget(cleanedInput);
  if (!target) {
    throw new Error('unsupported_id');
  }

  const relays = selectRelays({
    targetRelays: target.relays,
    overrideRelays: options.relays,
    defaultRelays: options.defaultRelays,
    maxRelays: options.maxRelays
  });

  if (relays.length === 0) {
    throw new Error('no_relays');
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const pool = new SimplePool();
  const prisma = options.prisma;

  if (prisma) {
    let cached = await getCachedEvent(prisma, target);
    if (cached && !isVerifiedEvent(cached.event)) {
      cached = null;
    }
    if (cached) {
      let profileEvent: Event | null = null;
      let authorProfile: ProfileMeta | null = null;

      if (cached.event.kind === 0) {
        profileEvent = cached.event;
        authorProfile = parseProfileContent(cached.event.content);
      } else {
        const cachedProfile = await getCachedEvent(prisma, {
          type: 'profile',
          pubkey: cached.event.pubkey,
          relays: []
        });
        if (cachedProfile && isVerifiedEvent(cachedProfile.event)) {
          profileEvent = cachedProfile.event;
          authorProfile = parseProfileContent(cachedProfile.event.content);
        }
      }

      return {
        target,
        event: cached.event,
        author: {
          pubkey: cached.event.pubkey,
          profile: authorProfile,
          profileEvent
        },
        relays: cached.relays.length ? cached.relays : relays,
        references: extractReferences(cached.event, options.referenceLimit)
      };
    }
  }

  try {
    const event = await fetchEventByTarget(pool, target, relays, timeoutMs);
    if (!event) throw new Error('not_found');
    if (!isVerifiedEvent(event)) {
      throw new Error('invalid_event');
    }

    const profileEvent = event.kind === 0
      ? event
      : await fetchAuthorProfile(pool, event.pubkey, relays, timeoutMs);
    const verifiedProfileEvent = profileEvent && isVerifiedEvent(profileEvent) ? profileEvent : null;
    const authorProfile = parseProfileContent(verifiedProfileEvent?.content);
    const references = extractReferences(event, options.referenceLimit);
    const ttlSeconds = options.cacheTtlSeconds ?? 0;

    if (prisma && ttlSeconds > 0) {
      const fetchedAt = new Date();
      await storeCachedEvent(prisma, { event, relays, fetchedAt, ttlSeconds, target });
      if (verifiedProfileEvent && verifiedProfileEvent.id !== event.id) {
        await storeCachedEvent(prisma, { event: verifiedProfileEvent, relays, fetchedAt, ttlSeconds });
      }
    }

    return {
      target,
      event,
      author: {
        pubkey: event.pubkey,
        profile: authorProfile,
        profileEvent: verifiedProfileEvent ?? null
      },
      relays,
      references
    };
  } finally {
    globalThis.setTimeout(() => {
      try {
        pool.close(relays);
      } catch {
        // ignore close errors
      }
    }, 0);
  }
}

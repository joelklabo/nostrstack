import type { PrismaClient } from '@prisma/client';
import { type Event, SimplePool, validateEvent, verifyEvent } from 'nostr-tools';

import {
  nostrEventCacheCounter,
  nostrEventRelayFetchDuration,
  nostrEventResolveFailureCounter
} from '../telemetry/metrics.js';
import { getCachedEvent, storeCachedEvent } from './event-cache.js';
import {
  decodeNostrTarget,
  getTagValues,
  isHex64,
  type NostrTarget,
  parseInlineMentions,
  parseProfileContent,
  type ProfileMeta,
  uniq
} from './nostr-utils.js';
import { selectRelays } from './relay-utils.js';
import { extractThreadReferences } from './threading.js';

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
  relayAllowlist?: string[];
  relayDenylist?: string[];
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

function getFailureReason(err: unknown) {
  if (err instanceof Error) {
    switch (err.message) {
      case 'invalid_id':
      case 'unsupported_id':
      case 'no_relays':
      case 'not_found':
      case 'invalid_event':
        return err.message;
      case 'Request timed out':
        return 'timeout';
      default:
        return 'error';
    }
  }
  return 'error';
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
  const { root, reply, mention } = extractThreadReferences(event, { selfId: event.id });
  const quote: string[] = [];
  const address: string[] = [];
  const profiles: string[] = [];

  quote.push(...getTagValues(event, 'q'));
  address.push(...getTagValues(event, 'a'));
  profiles.push(...getTagValues(event, 'p'));

  const inline = parseInlineMentions(event.content);
  mention.push(...inline.events);
  address.push(...inline.addresses);
  profiles.push(...inline.profiles);

  const normalizedRoot = uniq(root.map(normalizeEventId));
  const normalizedReply = uniq(reply.map(normalizeEventId));
  const normalizedMention = uniq(mention.map(normalizeEventId).filter(isHex64));
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
  const prisma = options.prisma;
  let relays: string[] = [];
  let pool: SimplePool | null = null;

  try {
    const cleanedInput = rawId.trim();
    if (!cleanedInput || cleanedInput.length > MAX_INPUT_LENGTH) {
      throw new Error('invalid_id');
    }
    const target = decodeNostrTarget(cleanedInput);
    if (!target) {
      throw new Error('unsupported_id');
    }

    relays = selectRelays({
      targetRelays: target.relays,
      overrideRelays: options.relays,
      defaultRelays: options.defaultRelays,
      maxRelays: options.maxRelays,
      allowlist: options.relayAllowlist,
      denylist: options.relayDenylist
    });

    if (relays.length === 0) {
      throw new Error('no_relays');
    }

    const timeoutMs = options.timeoutMs ?? 8000;
    const activePool = new SimplePool();
    pool = activePool;

    if (prisma) {
      let cached = await getCachedEvent(prisma, target);
      if (cached && !isVerifiedEvent(cached.event)) {
        cached = null;
      }
      if (cached) {
        nostrEventCacheCounter.labels('hit').inc();
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
      nostrEventCacheCounter.labels('miss').inc();
    }

    const fetchStart = Date.now();
    let event: Event | null = null;
    try {
      event = await fetchEventByTarget(activePool, target, relays, timeoutMs);
    } catch (err) {
      const fetchDuration = (Date.now() - fetchStart) / 1000;
      nostrEventRelayFetchDuration.labels('failure').observe(fetchDuration);
      throw err;
    }
    const fetchDuration = (Date.now() - fetchStart) / 1000;
    nostrEventRelayFetchDuration.labels(event ? 'success' : 'failure').observe(fetchDuration);
    if (!event) throw new Error('not_found');
    if (!isVerifiedEvent(event)) {
      throw new Error('invalid_event');
    }

    const profileEvent = event.kind === 0
      ? event
      : await fetchAuthorProfile(activePool, event.pubkey, relays, timeoutMs);
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
  } catch (err) {
    nostrEventResolveFailureCounter.labels(getFailureReason(err)).inc();
    throw err;
  } finally {
    if (pool) {
      const poolToClose = pool;
      globalThis.setTimeout(() => {
        try {
          poolToClose.close(relays);
        } catch {
          // ignore close errors
        }
      }, 0);
    }
  }
}

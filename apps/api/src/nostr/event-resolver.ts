import type { PrismaClient } from '@prisma/client';
import { type Event, type Filter, SimplePool, validateEvent, verifyEvent } from 'nostr-tools';

import {
  nostrEventCacheCounter,
  nostrEventRelayFetchDuration,
  nostrEventResolveFailureCounter,
  nostrReplyFetchCounter,
  nostrReplyFetchDuration
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

export type ReplyPage = {
  hasMore: boolean;
  nextCursor?: string | null;
};

export type ResolvedEvent = {
  target: NostrTarget;
  event: Event;
  author: ResolvedAuthor;
  relays: string[];
  references: ResolvedReferences;
  replyThreadId?: string;
  replies?: Event[];
  replyPage?: ReplyPage;
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
  replyLimit?: number;
  replyMaxLimit?: number;
  replyCursor?: string;
  replyTimeoutMs?: number;
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

type ReplyCursor = {
  createdAt: number;
  id: string;
};

function encodeReplyCursor(cursor: ReplyCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeReplyCursor(raw: string): ReplyCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      createdAt?: number;
      id?: string;
    };
    const createdAt = Number(decoded?.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
    const id = typeof decoded?.id === 'string' ? decoded.id.trim().toLowerCase() : '';
    if (!isHex64(id)) return null;
    return { createdAt: Math.floor(createdAt), id };
  } catch {
    return null;
  }
}

function getFailureReason(err: unknown) {
  if (err instanceof Error) {
    switch (err.message) {
      case 'invalid_id':
      case 'unsupported_id':
      case 'no_relays':
      case 'not_found':
      case 'invalid_event':
      case 'invalid_reply_limit':
      case 'invalid_reply_cursor':
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

function resolveReplyThreadId(event: Event) {
  const threadRefs = extractThreadReferences(event, { selfId: event.id });
  return threadRefs.root[0] ?? event.id;
}

function compareEventsAsc(a: Event, b: Event) {
  if (a.created_at !== b.created_at) return a.created_at - b.created_at;
  return a.id.localeCompare(b.id);
}

function isBeforeCursor(event: Event, cursor: ReplyCursor) {
  if (event.created_at < cursor.createdAt) return true;
  if (event.created_at > cursor.createdAt) return false;
  return event.id < cursor.id;
}

async function fetchReplies({
  pool,
  relays,
  threadId,
  replyLimit,
  replyCursor,
  timeoutMs,
  targetEventId
}: {
  pool: SimplePool;
  relays: string[];
  threadId: string;
  replyLimit: number;
  replyCursor: ReplyCursor | null;
  timeoutMs: number;
  targetEventId: string;
}): Promise<{ replies: Event[]; replyPage: ReplyPage }> {
  const filter: Filter = {
    kinds: [1],
    '#e': [threadId],
    limit: replyLimit + 1
  };
  if (replyCursor) {
    filter.until = replyCursor.createdAt;
  }

  const fetchStart = Date.now();
  try {
    const events = await withTimeout(pool.querySync(relays, filter, { maxWait: timeoutMs }), timeoutMs);
    const duration = (Date.now() - fetchStart) / 1000;
    const deduped = new Map<string, Event>();

    for (const event of events) {
      if (!event?.id || event.id === targetEventId) continue;
      if (!isVerifiedEvent(event)) continue;
      if (deduped.has(event.id)) continue;
      deduped.set(event.id, event);
    }

    let filtered = Array.from(deduped.values());
    if (replyCursor) {
      filtered = filtered.filter((event) => isBeforeCursor(event, replyCursor));
    }
    filtered.sort(compareEventsAsc);

    const hasMore = filtered.length > replyLimit;
    const pageReplies = hasMore ? filtered.slice(-replyLimit) : filtered;
    const nextCursor = hasMore && pageReplies.length > 0
      ? encodeReplyCursor({
        createdAt: pageReplies[0].created_at,
        id: pageReplies[0].id
      })
      : null;

    nostrReplyFetchDuration.labels('success').observe(duration);
    nostrReplyFetchCounter.labels(pageReplies.length > 0 ? 'success' : 'empty').inc();

    return {
      replies: pageReplies,
      replyPage: {
        hasMore,
        nextCursor
      }
    };
  } catch {
    const duration = (Date.now() - fetchStart) / 1000;
    nostrReplyFetchDuration.labels('failure').observe(duration);
    nostrReplyFetchCounter.labels('failure').inc();
    return {
      replies: [],
      replyPage: {
        hasMore: false,
        nextCursor: null
      }
    };
  }
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
  let resolved: ResolvedEvent | null = null;

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

        resolved = {
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
      } else {
        nostrEventCacheCounter.labels('miss').inc();
      }
    }

    if (!resolved) {
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

      resolved = {
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
    }

    const shouldFetchReplies = options.replyLimit != null || options.replyCursor != null;
    if (shouldFetchReplies) {
      const requestedLimit = options.replyLimit ?? options.replyMaxLimit;
      if (requestedLimit == null || !Number.isFinite(requestedLimit) || requestedLimit <= 0) {
        throw new Error('invalid_reply_limit');
      }
      const maxLimit = options.replyMaxLimit ?? requestedLimit;
      const replyLimit = Math.min(requestedLimit, maxLimit);
      const replyTimeoutMs = options.replyTimeoutMs ?? options.timeoutMs ?? 8000;
      const rawCursor = options.replyCursor?.trim();
      if (options.replyCursor && !rawCursor) {
        throw new Error('invalid_reply_cursor');
      }
      const parsedCursor = rawCursor ? decodeReplyCursor(rawCursor) : null;
      if (rawCursor && !parsedCursor) {
        throw new Error('invalid_reply_cursor');
      }

      const replyThreadId = resolveReplyThreadId(resolved.event);
      const replyResult = await fetchReplies({
        pool: activePool,
        relays: resolved.relays,
        threadId: replyThreadId,
        replyLimit,
        replyCursor: parsedCursor,
        timeoutMs: replyTimeoutMs,
        targetEventId: resolved.event.id
      });

      resolved = {
        ...resolved,
        replyThreadId,
        replies: replyResult.replies,
        replyPage: replyResult.replyPage
      };
    }

    if (!resolved) {
      throw new Error('not_found');
    }
    return resolved;
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

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../env.js';
import { resolveNostrEvent } from '../nostr/event-resolver.js';
import { isAllowedRelayUrl } from '../nostr/relay-utils.js';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];

const parseCsv = (raw?: string) =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

function relayFilters() {
  return {
    allowlist: parseCsv(env.NOSTR_RELAY_ALLOWLIST),
    denylist: parseCsv(env.NOSTR_RELAY_DENYLIST)
  };
}

function parseRelays(raw?: string) {
  const filters = relayFilters();
  if (!raw) return { relays: [], invalid: [] as string[] };
  const entries = raw
    .split(',')
    .map((relay) => relay.trim())
    .filter(Boolean);
  const relays = entries.filter((relay) => isAllowedRelayUrl(relay, filters));
  const invalid = entries.filter((relay) => !isAllowedRelayUrl(relay, filters));
  return { relays, invalid };
}

function parseIntParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

type NostrEventRoute = {
  Params: { id: string };
  Querystring: {
    relays?: string;
    limitRefs?: string;
    timeoutMs?: string;
    replyLimit?: string;
    replyCursor?: string;
  };
};

export async function registerNostrEventRoute(app: FastifyInstance) {
  const handler = async (
    request: FastifyRequest<NostrEventRoute>,
    reply: FastifyReply
  ) => {
    const id = request.params.id;
    const limitRefs = parseIntParam(request.query.limitRefs);
    if (request.query.limitRefs && limitRefs == null) {
      return reply.code(400).send({
        error: 'invalid_limit',
        message: 'limitRefs must be a positive integer.',
        requestId: request.id
      });
    }

    const timeoutMs = parseIntParam(request.query.timeoutMs);
    if (request.query.timeoutMs && timeoutMs == null) {
      return reply.code(400).send({
        error: 'invalid_timeout',
        message: 'timeoutMs must be a positive integer.',
        requestId: request.id
      });
    }

    const replyLimit = parseIntParam(request.query.replyLimit);
    if (request.query.replyLimit && replyLimit == null) {
      return reply.code(400).send({
        error: 'invalid_reply_limit',
        message: 'replyLimit must be a positive integer.',
        requestId: request.id
      });
    }

    const replyCursor = request.query.replyCursor?.trim();
    if (request.query.replyCursor !== undefined && !replyCursor) {
      return reply.code(400).send({
        error: 'invalid_reply_cursor',
        message: 'replyCursor must be a non-empty string.',
        requestId: request.id
      });
    }

    const relayOverride = parseRelays(request.query.relays);
    if (request.query.relays && relayOverride.invalid.length > 0) {
      return reply.code(400).send({
        error: 'invalid_relays',
        message: 'Relays must use wss:// (or ws://localhost for dev).',
        invalidRelays: relayOverride.invalid,
        requestId: request.id
      });
    }
    if (request.query.relays && relayOverride.relays.length === 0) {
      return reply.code(400).send({
        error: 'invalid_relays',
        message: 'relays must include at least one valid relay URL.',
        requestId: request.id
      });
    }

    const defaultRelays = parseRelays(env.NOSTR_RELAYS);
    const relays = defaultRelays.relays.length ? defaultRelays.relays : DEFAULT_RELAYS;
    const replyMaxLimit = env.NOSTR_EVENT_REPLY_MAX_LIMIT;
    const resolvedReplyLimit = Math.min(
      replyLimit ?? env.NOSTR_EVENT_REPLY_LIMIT,
      replyMaxLimit
    );
    const replyTimeoutMs = timeoutMs ?? env.NOSTR_EVENT_REPLY_TIMEOUT_MS;

    try {
      const resolved = await resolveNostrEvent(id, {
        relays: relayOverride.relays.length ? relayOverride.relays : undefined,
        defaultRelays: relays,
        maxRelays: app.config?.NOSTR_EVENT_MAX_RELAYS,
        relayAllowlist: relayFilters().allowlist,
        relayDenylist: relayFilters().denylist,
        timeoutMs: timeoutMs ?? app.config?.NOSTR_EVENT_FETCH_TIMEOUT_MS,
        referenceLimit: limitRefs ?? undefined,
        cacheTtlSeconds: app.config?.NOSTR_EVENT_CACHE_TTL_SECONDS,
        replyLimit: resolvedReplyLimit,
        replyMaxLimit,
        replyCursor: replyCursor ?? undefined,
        replyTimeoutMs,
        prisma: app.prisma,
        logger: request.log
      });

      const targetPayload: Record<string, unknown> = {
        input: id,
        type: resolved.target.type,
        relays: resolved.relays
      };
      if (resolved.target.type === 'event') targetPayload.id = resolved.target.id;
      if (resolved.target.type === 'profile') targetPayload.pubkey = resolved.target.pubkey;
      if (resolved.target.type === 'address') {
        targetPayload.kind = resolved.target.kind;
        targetPayload.pubkey = resolved.target.pubkey;
        targetPayload.identifier = resolved.target.identifier;
      }

      const payload: Record<string, unknown> = {
        target: targetPayload,
        event: resolved.event,
        author: {
          pubkey: resolved.author.pubkey,
          profile: resolved.author.profile
        },
        references: resolved.references
      };

      if (resolved.replyThreadId) payload.replyThreadId = resolved.replyThreadId;
      if (resolved.replies) payload.replies = resolved.replies;
      if (resolved.replyPage) payload.replyPage = resolved.replyPage;

      return reply.code(200).send(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'internal_error';
      if (message === 'unsupported_id') {
        return reply.code(400).send({
          error: 'invalid_id',
          message: 'Unsupported or invalid nostr identifier.',
          requestId: request.id
        });
      }
      if (message === 'invalid_id') {
        return reply.code(400).send({
          error: 'invalid_id',
          message: 'Identifier is empty or exceeds the maximum length.',
          requestId: request.id
        });
      }
      if (message === 'not_found') {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Event not found on available relays.',
          requestId: request.id
        });
      }
      if (message === 'invalid_event') {
        return reply.code(422).send({
          error: 'invalid_event',
          message: 'Event failed signature verification.',
          requestId: request.id
        });
      }
      if (message === 'no_relays') {
        return reply.code(503).send({
          error: 'no_relays',
          message: 'No relays configured to resolve this event.',
          requestId: request.id
        });
      }
      if (message === 'invalid_reply_limit') {
        return reply.code(400).send({
          error: 'invalid_reply_limit',
          message: 'replyLimit must be a positive integer.',
          requestId: request.id
        });
      }
      if (message === 'invalid_reply_cursor') {
        return reply.code(400).send({
          error: 'invalid_reply_cursor',
          message: 'replyCursor must be a non-empty string.',
          requestId: request.id
        });
      }
      if (message === 'Request timed out') {
        return reply.code(504).send({
          error: 'timeout',
          message: 'Relay request timed out.',
          requestId: request.id
        });
      }
      request.log.error({ err }, 'nostr event resolve failed');
      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to resolve nostr event.',
        requestId: request.id
      });
    }
  };

  const schema = {
    params: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 512 }
      }
    },
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        relays: { type: 'string' },
        limitRefs: { type: 'string' },
        timeoutMs: { type: 'string' },
        replyLimit: { type: 'string' },
        replyCursor: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          target: {
            type: 'object',
            properties: {
              input: { type: 'string' },
              type: { type: 'string' },
              relays: { type: 'array', items: { type: 'string' } },
              id: { type: 'string' },
              pubkey: { type: 'string' },
              kind: { type: 'integer' },
              identifier: { type: 'string' }
            }
          },
          event: {
            type: 'object',
            additionalProperties: true
          },
          author: {
            type: 'object',
            properties: {
              pubkey: { type: 'string' },
              profile: { type: 'object', additionalProperties: true }
            }
          },
          references: {
            type: 'object',
            additionalProperties: true
          },
          replyThreadId: { type: 'string' },
          replies: { type: 'array', items: { type: 'object', additionalProperties: true } },
          replyPage: { type: 'string' }
        }
      },
      400: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, invalidRelays: { type: 'array', items: { type: 'string' } } }
      },
      404: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } }
      },
      422: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } }
      },
      500: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } }
      },
      503: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } }
      },
      504: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } }
      }
    }
  };

  app.get('/nostr/event/:id', { schema }, handler);
  app.get('/api/nostr/event/:id', { schema }, handler);
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../env.js';
import { resolveNostrEvent } from '../nostr/event-resolver.js';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];

function parseRelays(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((relay) => relay.trim())
    .filter(Boolean);
}

function parseIntParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

type NostrEventRoute = {
  Params: { id: string };
  Querystring: { relays?: string; limitRefs?: string; timeoutMs?: string };
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

    const relayOverride = parseRelays(request.query.relays);
    if (request.query.relays && relayOverride.length === 0) {
      return reply.code(400).send({
        error: 'invalid_relays',
        message: 'relays must include at least one valid relay URL.',
        requestId: request.id
      });
    }

    const defaultRelays = parseRelays(env.NOSTR_RELAYS) || [];
    const relays = defaultRelays.length ? defaultRelays : DEFAULT_RELAYS;

    try {
      const resolved = await resolveNostrEvent(id, {
        relays: relayOverride.length ? relayOverride : undefined,
        defaultRelays: relays,
        maxRelays: app.config?.NOSTR_EVENT_MAX_RELAYS,
        timeoutMs: timeoutMs ?? app.config?.NOSTR_EVENT_FETCH_TIMEOUT_MS,
        referenceLimit: limitRefs ?? undefined,
        cacheTtlSeconds: app.config?.NOSTR_EVENT_CACHE_TTL_SECONDS,
        prisma: app.prisma
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

      return reply.code(200).send({
        target: targetPayload,
        event: resolved.event,
        author: {
          pubkey: resolved.author.pubkey,
          profile: resolved.author.profile
        },
        references: resolved.references
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'internal_error';
      if (message === 'unsupported_id') {
        return reply.code(400).send({
          error: 'invalid_id',
          message: 'Unsupported or invalid nostr identifier.',
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
      if (message === 'no_relays') {
        return reply.code(503).send({
          error: 'no_relays',
          message: 'No relays configured to resolve this event.',
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
        timeoutMs: { type: 'string' }
      }
    }
  };

  app.get('/nostr/event/:id', { schema }, handler);
  app.get('/api/nostr/event/:id', { schema }, handler);
}

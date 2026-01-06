import { Buffer } from 'node:buffer';

import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import {
  getNip05Cache,
  type Nip05Record,
  setNip05Cache,
  setNip05NegativeCache
} from '../services/nip05-cache.js';
import {
  nip05ProxyCacheCounter,
  nip05ProxyErrorCounter,
  nip05ProxyFetchDuration
} from '../telemetry/metrics.js';

type Nip05Query = {
  nip05?: string;
  name?: string;
  domain?: string;
};

type Nip05Response = {
  pubkey: string;
  relays?: string[];
  nip05: string;
  name: string;
  domain: string;
};

const NAME_RE = /^[a-z0-9._-]{1,64}$/i;
const DOMAIN_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;
const IPV6_RE = /^\[[0-9a-f:]+\](?::\d{1,5})?$/i;

function isLocalhost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function parseNip05Input(query: Nip05Query) {
  if (query.nip05) {
    const raw = query.nip05.trim().toLowerCase();
    const parts = raw.split('@');
    if (parts.length !== 2) return null;
    return { name: parts[0], domain: parts[1] };
  }
  if (query.name && query.domain) {
    return { name: query.name.trim().toLowerCase(), domain: query.domain.trim().toLowerCase() };
  }
  return null;
}

function isValidName(name: string) {
  return name === '_' || NAME_RE.test(name);
}

function isValidDomain(domain: string) {
  if (DOMAIN_RE.test(domain)) return true;
  if (IPV6_RE.test(domain)) return true;
  return false;
}

function buildNip05Url(domain: string, name: string) {
  const allowHttpLocalhost = env.NIP05_PROXY_ALLOW_HTTP_LOCALHOST || env.NODE_ENV !== 'production';
  const base = new URL(`https://${domain}`);
  if (allowHttpLocalhost && isLocalhost(base.hostname)) {
    base.protocol = 'http:';
  }
  base.pathname = '/.well-known/nostr.json';
  base.searchParams.set('name', name);
  return base;
}

async function readJsonWithLimit(res: Response, maxBytes: number) {
  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error('nip05_response_too_large');
  }
  if (!res.body) {
    return res.json() as Promise<unknown>;
  }
  const reader = res.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { done: isDone, value } = await reader.read();
    done = isDone;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error('nip05_response_too_large');
      }
      chunks.push(value);
    }
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const text = buffer.toString('utf8');
  return JSON.parse(text) as unknown;
}

function parseNip05Response(body: unknown, name: string, domain: string): Nip05Response | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const names = record.names as Record<string, unknown> | undefined;
  if (!names || typeof names !== 'object') return null;
  const pubkey = names[name];
  if (typeof pubkey !== 'string') return null;
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return null;

  const relaysRaw = record.relays as Record<string, unknown> | undefined;
  let relays: string[] | undefined;
  if (relaysRaw && typeof relaysRaw === 'object') {
    const relayList = relaysRaw[pubkey] as unknown;
    if (Array.isArray(relayList)) {
      const cleaned = relayList
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (cleaned.length) relays = cleaned;
    }
  }

  return {
    pubkey: pubkey.toLowerCase(),
    relays,
    nip05: `${name}@${domain}`,
    name,
    domain
  };
}

export async function registerNostrIdentityRoute(app: FastifyInstance) {
  app.get(
    '/api/nostr/identity',
    {
      schema: {
        description: 'Resolve a NIP-05 identifier to a Nostr public key and relays',
        summary: 'Resolve NIP-05',
        tags: ['Nostr'],
        querystring: {
          type: 'object',
          properties: {
            nip05: {
              type: 'string',
              description: 'Full NIP-05 identifier (user@domain.com)',
              example: 'jack@nostrstack.lol'
            },
            name: {
              type: 'string',
              description: 'User name part (if nip05 not provided)',
              example: 'jack'
            },
            domain: {
              type: 'string',
              description: 'Domain part (if nip05 not provided)',
              example: 'nostrstack.lol'
            }
          },
          additionalProperties: false
        },
        response: {
          200: {
            description: 'NIP-05 resolved successfully',
            type: 'object',
            properties: {
              pubkey: {
                type: 'string',
                description: 'Hex-encoded public key',
                example: '0000000000000000000000000000000000000000000000000000000000000001'
              },
              relays: {
                type: 'array',
                items: { type: 'string' },
                description: 'Preferred relays',
                example: ['wss://relay.damus.io']
              },
              nip05: { type: 'string', description: 'Normalized NIP-05 identifier' },
              name: { type: 'string' },
              domain: { type: 'string' },
              fetchedAt: { type: 'integer', description: 'Timestamp when this record was fetched' }
            }
          },
          400: {
            description: 'Invalid input',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' }
            }
          },
          404: {
            description: 'NIP-05 identifier not found',
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          502: {
            description: 'Upstream error (DNS/HTTP failure)',
            type: 'object',
            properties: {
              error: { type: 'string' },
              status: { type: 'integer' }
            }
          },
          504: {
            description: 'Upstream timeout',
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const query = request.query as Nip05Query;
      const parsed = parseNip05Input(query);
      if (!parsed) {
        nip05ProxyErrorCounter.labels('invalid_input').inc();
        return reply
          .status(400)
          .send({ error: 'invalid_nip05', message: 'Provide nip05 or name+domain.' });
      }

      const name = parsed.name.trim().toLowerCase();
      const domain = parsed.domain.trim().toLowerCase();
      if (!isValidName(name) || !isValidDomain(domain)) {
        nip05ProxyErrorCounter.labels('invalid_input').inc();
        return reply
          .status(400)
          .send({ error: 'invalid_nip05', message: 'Invalid NIP-05 identifier.' });
      }

      const cacheKey = `${name}@${domain}`;
      const cached = getNip05Cache(cacheKey);
      if (cached.hit) {
        nip05ProxyCacheCounter.labels(cached.value ? 'hit' : 'negative').inc();
        if (!cached.value) {
          nip05ProxyErrorCounter.labels('not_found').inc();
          return reply.status(404).send({ error: 'nip05_not_found' });
        }
        return reply.send(cached.value);
      }
      nip05ProxyCacheCounter.labels('miss').inc();

      const timeoutMs = env.NIP05_PROXY_TIMEOUT_MS;
      const maxBytes = env.NIP05_PROXY_MAX_RESPONSE_BYTES;
      const ttlMs = env.NIP05_PROXY_CACHE_TTL_SECONDS * 1000;
      const negativeTtlMs = env.NIP05_PROXY_NEGATIVE_TTL_SECONDS * 1000;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const fetchStart = Date.now();
      let fetchOutcome: 'success' | 'failure' = 'failure';

      try {
        const url = buildNip05Url(domain, name);
        if (url.protocol !== 'https:' && !isLocalhost(url.hostname)) {
          nip05ProxyErrorCounter.labels('invalid_input').inc();
          return reply
            .status(400)
            .send({ error: 'invalid_nip05', message: 'NIP-05 requires HTTPS.' });
        }

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          redirect: 'error',
          headers: {
            accept: 'application/json'
          }
        });

        if (!res.ok) {
          if (res.status === 404) {
            nip05ProxyErrorCounter.labels('not_found').inc();
            setNip05NegativeCache(cacheKey, negativeTtlMs);
            return reply.status(404).send({ error: 'nip05_not_found' });
          }
          nip05ProxyErrorCounter.labels('upstream_error').inc();
          return reply.status(502).send({ error: 'nip05_upstream_error', status: res.status });
        }

        const body = await readJsonWithLimit(res, maxBytes);
        const parsedResponse = parseNip05Response(body, name, domain);
        if (!parsedResponse) {
          nip05ProxyErrorCounter.labels('invalid_response').inc();
          return reply.status(502).send({ error: 'nip05_invalid_response' });
        }

        const record: Nip05Record = {
          ...parsedResponse,
          fetchedAt: Date.now()
        };
        setNip05Cache(cacheKey, record, ttlMs);
        fetchOutcome = 'success';
        return reply.send(record);
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            nip05ProxyErrorCounter.labels('timeout').inc();
            return reply.status(504).send({ error: 'nip05_timeout' });
          }
          if (err.message === 'nip05_response_too_large') {
            nip05ProxyErrorCounter.labels('response_too_large').inc();
            return reply.status(502).send({ error: 'nip05_response_too_large' });
          }
        }
        nip05ProxyErrorCounter.labels('proxy_failed').inc();
        request.log.warn({ err }, 'NIP-05 proxy failed');
        return reply.status(502).send({ error: 'nip05_proxy_failed' });
      } finally {
        const fetchDuration = (Date.now() - fetchStart) / 1000;
        nip05ProxyFetchDuration.labels(fetchOutcome).observe(fetchDuration);
        clearTimeout(timeout);
      }
    }
  );
}

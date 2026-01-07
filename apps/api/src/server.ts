import fs from 'node:fs';
import path from 'node:path';

import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify from 'fastify';
import type { LogFn } from 'pino';

import { env } from './env.js';
import { rawBodyPlugin } from './hooks/raw-body.js';
import { NostrClient } from './nostr/nostr-client.js';
import { prismaPlugin } from './plugins/prisma.js';
import { buildLightningProvider, LightningProviderKind } from './providers/index.js';
import { LnbitsProvider } from './providers/lnbits.js';
import { MockLightningProvider } from './providers/mock.js';
import { OpenNodeProvider } from './providers/opennode.js';
import { registerRoutes } from './routes/index.js';
import { registerTelemetryWs } from './routes/telemetry-ws.js';
import { registerWalletWs } from './routes/wallet-ws.js';
import type { LogHub } from './services/log-hub.js';
import { createLogHub } from './services/log-hub.js';
import { createPayEventHub } from './services/pay-events.js';
import { startPaymentReconciler } from './services/payment-reconciler.js';
import { setupRoutes } from './setup-routes.js';
import { metricsPlugin } from './telemetry/metrics.js';
import { requestIdHook } from './telemetry/request-id.js';
import { startTracing } from './telemetry/tracing.js';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const parseCsv = (raw?: string) =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const matchesOriginPattern = (origin: string, pattern: string) => {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (trimmed === '*') return true;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return origin === trimmed;
  }
  if (trimmed.startsWith('*.')) {
    const host = trimmed.slice(2).toLowerCase();
    const hostname = originUrl.hostname.toLowerCase();
    return hostname === host || hostname.endsWith(`.${host}`);
  }
  if (trimmed.includes(':')) {
    const [host, port] = trimmed.split(':');
    return originUrl.hostname.toLowerCase() === host.toLowerCase() && originUrl.port === port;
  }
  return originUrl.hostname.toLowerCase() === trimmed.toLowerCase();
};

const isLocalhostOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return LOCALHOST_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

export async function buildServer() {
  const httpsOpts = (() => {
    const useHttps = env.USE_HTTPS;
    const expand = (p?: string) => {
      if (!p) return [];
      if (path.isAbsolute(p)) return [p];
      return [
        path.resolve(process.cwd(), p),
        path.resolve(process.cwd(), '..', p),
        path.resolve(process.cwd(), '..', '..', p)
      ];
    };
    const defaultCerts = [
      ...expand(env.HTTPS_CERT || 'certs/dev-cert.pem'),
      path.resolve(process.cwd(), 'certs', 'dev-cert.pem'),
      path.resolve(process.cwd(), '..', 'certs', 'dev-cert.pem'),
      path.resolve(process.cwd(), '..', '..', 'certs', 'dev-cert.pem')
    ];
    const defaultKeys = [
      ...expand(env.HTTPS_KEY || 'certs/dev-key.pem'),
      path.resolve(process.cwd(), 'certs', 'dev-key.pem'),
      path.resolve(process.cwd(), '..', 'certs', 'dev-key.pem'),
      path.resolve(process.cwd(), '..', '..', 'certs', 'dev-key.pem')
    ];
    const certPath = defaultCerts.find((p) => fs.existsSync(p));
    const keyPath = defaultKeys.find((p) => fs.existsSync(p));

    if (useHttps) {
      if (!certPath || !keyPath) {
        throw new Error(
          `USE_HTTPS=true but cert/key missing (checked: ${defaultCerts.join(', ')} / ${defaultKeys.join(', ')})`
        );
      }
      if (!env.PUBLIC_ORIGIN.startsWith('https://')) {
        console.warn(`USE_HTTPS=true but PUBLIC_ORIGIN is not https: ${env.PUBLIC_ORIGIN}`);
      }
      return {
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        }
      };
    }
    return {};
  })();
  const stopTracing = startTracing(env);
  const logHub: LogHub = createLogHub({ bufferSize: 500 });

  const server = Fastify({
    ...httpsOpts,
    ajv: {
      customOptions: {
        keywords: ['example']
      }
    },
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      redact: ['req.headers.authorization'],
      hooks: {
        logMethod(inputArgs, method: LogFn & { level?: string | number; levelVal?: number }) {
          try {
            const meta = method as {
              level?: string | number;
              levelVal?: number;
              apply: LogFn['apply'];
            };
            const level = meta.level ?? meta.levelVal ?? 'info';
            const msg = inputArgs
              .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
              .join(' ');
            logHub.publish({ ts: Date.now(), level, message: msg, data: inputArgs[0] });
          } catch {
            // swallow log hook errors
          }
          return method.apply(this, inputArgs as Parameters<LogFn>);
        }
      }
    }
  });

  server.decorate('logHub', logHub);

  await server.register(sensible);
  const corsAllowlistRaw = parseCsv(env.CORS_ALLOWED_ORIGINS);
  const corsAllowAll = corsAllowlistRaw.includes('*') && env.NODE_ENV !== 'production';
  const corsAllowlist = corsAllowlistRaw.filter((entry) => entry !== '*');

  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsAllowAll) return cb(null, true);
      if (env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) return cb(null, true);
      const allowlist = corsAllowlist.length ? corsAllowlist : [env.PUBLIC_ORIGIN];
      const allowed = allowlist.some((pattern) => matchesOriginPattern(origin, pattern));
      return cb(null, allowed);
    }
  });
  await server.register(helmet, { global: true });
  await server.register(formbody);
  await server.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const host =
        (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'unknown';
      const tenant = host.split(':')[0].toLowerCase();
      const route = req.routeOptions?.url || req.raw.url || 'unknown';
      return `${tenant}:${route}`;
    }
  });
  await server.addHook('onRequest', requestIdHook);
  await server.register(metricsPlugin);
  await server.register(rawBodyPlugin);
  await server.register(prismaPlugin);

  // Lightning provider (default OpenNode). Could later be per-tenant.
  const providerKind =
    env.LIGHTNING_PROVIDER === 'lnbits'
      ? LightningProviderKind.Lnbits
      : env.LIGHTNING_PROVIDER === 'mock'
        ? LightningProviderKind.Mock
        : LightningProviderKind.OpenNode;

  server.log.info({ provider: providerKind }, 'Initializing Lightning Provider');

  const lightningProvider = buildLightningProvider(providerKind, {
    openNode: () => new OpenNodeProvider(env.OP_NODE_API_KEY, server.log),
    lnbits: () => {
      if (!env.LN_BITS_URL || !env.LN_BITS_API_KEY) {
        server.log.error('LN_BITS_URL/LN_BITS_API_KEY required for lnbits provider');
        throw new Error('LNbits config missing');
      }
      return new LnbitsProvider(
        { baseUrl: env.LN_BITS_URL, apiKey: env.LN_BITS_API_KEY },
        server.log
      );
    },
    mock: () => new MockLightningProvider()
  });
  server.decorate('lightningProvider', lightningProvider);

  server.decorate('config', {
    REGTEST_COMPOSE: process.env.REGTEST_COMPOSE,
    REGTEST_CWD: process.env.REGTEST_CWD,
    REGTEST_PAY_ENABLED: env.ENABLE_REGTEST_PAY,
    REGTEST_FUND_ENABLED: env.ENABLE_REGTEST_FUND,
    NOSTR_EVENT_CACHE_TTL_SECONDS: env.NOSTR_EVENT_CACHE_TTL_SECONDS,
    NOSTR_EVENT_CACHE_MAX_ENTRIES: env.NOSTR_EVENT_CACHE_MAX_ENTRIES,
    NOSTR_EVENT_MAX_RELAYS: env.NOSTR_EVENT_MAX_RELAYS,
    NOSTR_EVENT_FETCH_TIMEOUT_MS: env.NOSTR_EVENT_FETCH_TIMEOUT_MS,
    NOSTR_RELAY_ALLOWLIST: env.NOSTR_RELAY_ALLOWLIST,
    NOSTR_RELAY_DENYLIST: env.NOSTR_RELAY_DENYLIST,
    NIP05_PROXY_TIMEOUT_MS: env.NIP05_PROXY_TIMEOUT_MS,
    NIP05_PROXY_CACHE_TTL_SECONDS: env.NIP05_PROXY_CACHE_TTL_SECONDS,
    NIP05_PROXY_NEGATIVE_TTL_SECONDS: env.NIP05_PROXY_NEGATIVE_TTL_SECONDS,
    NIP05_PROXY_MAX_RESPONSE_BYTES: env.NIP05_PROXY_MAX_RESPONSE_BYTES,
    NIP05_PROXY_ALLOW_HTTP_LOCALHOST: env.NIP05_PROXY_ALLOW_HTTP_LOCALHOST
  });

  if (env.NOSTR_SECRET_KEY) {
    const relays = env.NOSTR_RELAYS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || ['wss://relay.damus.io'];
    server.decorate(
      'nostrClient',
      new NostrClient(env.NOSTR_SECRET_KEY, server.log.child({ scope: 'nostr' }))
    );
    server.decorate('nostrRelays', relays);
  }

  await server.register(swagger, {
    openapi: {
      info: {
        title: 'nostrstack API',
        version: '0.0.0'
      }
    }
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });

  setupRoutes(server);
  await registerRoutes(server);
  await registerTelemetryWs(server);
  await registerWalletWs(server);
  createPayEventHub(server);
  const stopReconciler = startPaymentReconciler(server);
  await ensureDefaultTenant(server);

  if (stopTracing) {
    server.addHook('onClose', async () => {
      await stopTracing();
    });
  }
  server.addHook('onClose', async () => {
    stopReconciler();
  });

  server.addHook('onSend', async (_req, reply, payload) => {
    if (!reply.getHeader('x-request-id') && reply.request.id) {
      reply.header('x-request-id', reply.request.id);
    }
    return payload;
  });

  server.setErrorHandler((err, req, reply) => {
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err, status }, 'request errored');
    } else {
      req.log.warn({ err, status }, 'request failed');
    }
    const body: Record<string, unknown> = {
      error: err.code || 'internal_error',
      message: env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
      requestId: req.id
    };
    return reply.status(status).send(body);
  });

  return server;
}

if (process.env.VITEST !== 'true') {
  buildServer()
    .then((server) => server.listen({ port: env.PORT, host: '0.0.0.0' }))
    .then((address) => {
      console.log(`API listening on ${address}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

async function ensureDefaultTenant(server: ReturnType<typeof Fastify>) {
  const domain = 'default';
  const existing = await server.prisma.tenant.findUnique({ where: { domain } });
  if (!existing) {
    await server.prisma.tenant.create({
      data: { domain, displayName: 'Default Tenant' }
    });
  }
}

import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
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
import { createLogHub } from './services/log-hub.js';
import { createPayEventHub } from './services/pay-events.js';
import { setupRoutes } from './setup-routes.js';
import { metricsPlugin } from './telemetry/metrics.js';
import { requestIdHook } from './telemetry/request-id.js';
import { startTracing } from './telemetry/tracing.js';

export async function buildServer() {
  const httpsOpts = (() => {
    const useHttps = env.USE_HTTPS;
    const certPath = env.HTTPS_CERT || path.join(process.cwd(), 'certs', 'dev-cert.pem');
    const keyPath = env.HTTPS_KEY || path.join(process.cwd(), 'certs', 'dev-key.pem');
    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);

    if (useHttps) {
      if (!certExists || !keyExists) {
        throw new Error(`USE_HTTPS=true but cert/key missing (${certPath}, ${keyPath})`);
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
  const logHub = createLogHub({ bufferSize: 500 });

  const server = Fastify({
    ...httpsOpts,
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      redact: ['req.headers.authorization'],
      hooks: {
        logMethod(inputArgs, method: LogFn & { level?: string | number; levelVal?: number }) {
          try {
            const meta = method as { level?: string | number; levelVal?: number; apply: LogFn['apply'] };
            const level = meta.level ?? meta.levelVal ?? 'info';
            const msg = inputArgs.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
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
  await server.register(cors, { origin: true });
  await server.register(helmet, { global: true });
  await server.register(formbody);
  await server.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'unknown';
      const tenant = host.split(':')[0].toLowerCase();
      return `${tenant}:${req.routerPath || req.raw.url}`;
    }
  });
  await server.addHook('onRequest', requestIdHook);
  await server.register(metricsPlugin);
  await server.register(rawBodyPlugin);
  await server.register(prismaPlugin);

   // Lightning provider (default OpenNode). Could later be per-tenant.
  const providerKind = env.LIGHTNING_PROVIDER === 'lnbits'
    ? LightningProviderKind.Lnbits
    : env.LIGHTNING_PROVIDER === 'mock'
      ? LightningProviderKind.Mock
      : LightningProviderKind.OpenNode;
  const lightningProvider = buildLightningProvider(providerKind, {
    openNode: () => new OpenNodeProvider(env.OP_NODE_API_KEY, server.log),
    lnbits: () => {
      if (!env.LN_BITS_URL || !env.LN_BITS_API_KEY) {
        server.log.error('LN_BITS_URL/LN_BITS_API_KEY required for lnbits provider');
        throw new Error('LNbits config missing');
      }
      return new LnbitsProvider({ baseUrl: env.LN_BITS_URL, apiKey: env.LN_BITS_API_KEY }, server.log);
    },
    mock: () => new MockLightningProvider()
  });
  server.decorate('lightningProvider', lightningProvider);

  if (env.NOSTR_SECRET_KEY) {
    const relays = env.NOSTR_RELAYS?.split(',').map((s) => s.trim()).filter(Boolean) || ['wss://relay.damus.io'];
    server.decorate('nostrClient', new NostrClient(env.NOSTR_SECRET_KEY, server.log.child({ scope: 'nostr' })));
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
  server.decorate('config', {
    REGTEST_COMPOSE: process.env.REGTEST_COMPOSE,
    REGTEST_CWD: process.env.REGTEST_CWD
  });
  await ensureDefaultTenant(server);

  if (stopTracing) {
    server.addHook('onClose', async () => {
      await stopTracing();
    });
  }

  server.addHook('onSend', async (_req, reply, payload) => {
    if (!reply.getHeader('x-request-id') && reply.request.id) {
      reply.header('x-request-id', reply.request.id);
    }
    return payload;
  });

  server.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request errored');
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
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

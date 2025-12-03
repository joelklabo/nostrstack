import type { FastifyInstance } from 'fastify';

import { registerAdminTenantRoutes } from './admin-tenants.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerEmbedConfigRoute } from './embed-config.js';
import { registerLnurlCallback } from './lnurlp-callback.js';
import { registerLogStreamRoute } from './log-stream.js';
import { registerPayRoutes } from './pay.js';
import { registerRegtestFundRoute } from './regtest-fund.js';
import { registerRegtestPayRoute } from './regtest-pay.js';
import { registerTenantRoutes } from './tenants.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerLnurlCallback(app);
  await registerEmbedConfigRoute(app);
  await registerTenantRoutes(app);
  await registerAdminTenantRoutes(app);
  await registerAdminUserRoutes(app);
  await registerPayRoutes(app);
  await registerRegtestFundRoute(app);
  await registerRegtestPayRoute(app);
  await registerLogStreamRoute(app);
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
    lightningProvider: import('../providers/index.js').LightningProvider;
    nostrClient?: import('../nostr/nostr-client.js').NostrClient;
    nostrRelays?: string[];
    logHub: import('../services/log-hub.js').LogHub;
    config?: {
      REGTEST_COMPOSE?: string;
      REGTEST_CWD?: string;
    };
  }
}

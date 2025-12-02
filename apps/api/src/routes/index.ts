import type { FastifyInstance } from 'fastify';

import { registerAdminTenantRoutes } from './admin-tenants.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerEmbedConfigRoute } from './embed-config.js';
import { registerLnurlCallback } from './lnurlp-callback.js';
import { registerPayRoutes } from './pay.js';
import { registerRegtestFundRoute } from './regtest-fund.js';
import { registerTenantRoutes } from './tenants.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerLnurlCallback(app);
  await registerEmbedConfigRoute(app);
  await registerTenantRoutes(app);
  await registerAdminTenantRoutes(app);
  await registerAdminUserRoutes(app);
  await registerPayRoutes(app);
  await registerRegtestFundRoute(app);
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
    lightningProvider: import('../providers/index.js').LightningProvider;
    nostrClient?: import('../nostr/nostr-client.js').NostrClient;
    nostrRelays?: string[];
  }
}

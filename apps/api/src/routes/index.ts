import type { FastifyInstance } from 'fastify';
import { registerLnurlCallback } from './lnurlp-callback.js';
import { registerTenantRoutes } from './tenants.js';
import { registerAdminTenantRoutes } from './admin-tenants.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerPayRoutes } from './pay.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerLnurlCallback(app);
  await registerTenantRoutes(app);
  await registerAdminTenantRoutes(app);
  await registerAdminUserRoutes(app);
  await registerPayRoutes(app);
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
    lightningProvider: import('../providers/index.js').LightningProvider;
    nostrClient?: import('../nostr/nostr-client.js').NostrClient;
    nostrRelays?: string[];
  }
}

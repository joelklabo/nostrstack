import type { FastifyInstance } from 'fastify';

import { registerAdminTenantRoutes } from './admin-tenants.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerEmbedConfigRoute } from './embed-config.js';
import { registerLnurlAuthRoutes } from './lnurl-auth.js';
import { registerLnurlCallback } from './lnurlp-callback.js';
import { registerLogStreamRoute } from './log-stream.js';
import { registerPayRoutes } from './pay.js';
import { registerPayWebhook } from './pay-webhook.js';
import { registerRegtestFundRoute } from './regtest-fund.js';
import { registerRegtestPayRoute } from './regtest-pay.js';
import { registerTenantRoutes } from './tenants.js';
import { registerTipRoutes } from './tips.js';
import { registerWalletRoutes } from './wallet.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerLnurlCallback(app);
  await registerLnurlAuthRoutes(app);
  await registerEmbedConfigRoute(app);
  await registerTenantRoutes(app);
  await registerAdminTenantRoutes(app);
  await registerAdminUserRoutes(app);
  await registerPayWebhook(app);
  await registerPayRoutes(app);
  await registerTipRoutes(app);
  await registerRegtestFundRoute(app);
  await registerRegtestPayRoute(app);
  await registerLogStreamRoute(app);
  await registerWalletRoutes(app);
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
      REGTEST_PAY_ENABLED?: boolean;
      REGTEST_FUND_ENABLED?: boolean;
    };
  }
}

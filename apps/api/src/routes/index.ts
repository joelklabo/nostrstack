import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { registerAdminTenantRoutes } from './admin-tenants.js';
import { registerAdminUserRoutes } from './admin-users.js';
import { registerBolt12Routes } from './bolt12.js';
import { registerEmbedConfigRoute } from './embed-config.js';
import { registerLnurlAuthRoutes } from './lnurl-auth.js';
import { registerLnurlWithdrawRoutes } from './lnurl-withdraw.js';
import { registerLnurlCallback } from './lnurlp-callback.js';
import { registerLogStreamRoute } from './log-stream.js';
import { registerNostrEventRoute } from './nostr-event.js';
import { registerNostrIdentityRoute } from './nostr-identity.js';
import { registerPayRoutes } from './pay.js';
import { registerPayWebhook } from './pay-webhook.js';
import { registerRegtestFundRoute } from './regtest-fund.js';
import { registerRegtestPayRoute } from './regtest-pay.js';
import { registerTelemetrySummaryRoute } from './telemetry-summary.js';
import { registerTenantRoutes } from './tenants.js';
import { registerTipRoutes } from './tips.js';
import { registerWalletRoutes } from './wallet.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerLnurlCallback(app);
  await registerLnurlAuthRoutes(app);
  await registerLnurlWithdrawRoutes(app);
  if (env.ENABLE_BOLT12) {
    await registerBolt12Routes(app);
  }
  await registerEmbedConfigRoute(app);
  await registerTenantRoutes(app);
  await registerAdminTenantRoutes(app);
  await registerAdminUserRoutes(app);
  await registerNostrIdentityRoute(app);
  await registerNostrEventRoute(app);
  await registerPayWebhook(app);
  await registerPayRoutes(app);
  await registerTipRoutes(app);
  await registerTelemetrySummaryRoute(app);
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
      NOSTR_EVENT_CACHE_TTL_SECONDS?: number;
      NOSTR_EVENT_CACHE_MAX_ENTRIES?: number;
      NOSTR_EVENT_MAX_RELAYS?: number;
      NOSTR_EVENT_FETCH_TIMEOUT_MS?: number;
      NIP05_PROXY_TIMEOUT_MS?: number;
      NIP05_PROXY_CACHE_TTL_SECONDS?: number;
      NIP05_PROXY_NEGATIVE_TTL_SECONDS?: number;
      NIP05_PROXY_MAX_RESPONSE_BYTES?: number;
      NIP05_PROXY_ALLOW_HTTP_LOCALHOST?: boolean;
    };
  }
}

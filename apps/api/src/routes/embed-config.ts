import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

function parseRelays(raw?: string | null): string[] {
  if (!raw) return DEFAULT_RELAYS;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function registerEmbedConfigRoute(app: FastifyInstance) {
  app.get('/embed-config', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tenant: { type: 'string' },
          themeAccent: { type: 'string' },
          themeText: { type: 'string' },
          themeSurface: { type: 'string' },
          themeBorder: { type: 'string' }
        },
        required: ['tenant'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { tenant, themeAccent, themeText, themeSurface, themeBorder } = request.query as {
      tenant: string;
      themeAccent?: string;
      themeText?: string;
      themeSurface?: string;
      themeBorder?: string;
    };

    const hostHeader = request.headers.host;
    const domain = hostHeader?.split(':')[0] || new URL(env.PUBLIC_ORIGIN).hostname;
    const lnAddress = `${tenant}@${domain}`;

    const isMock = env.DEV_MOCKS;
    const relays = isMock ? ['mock'] : parseRelays(env.NOSTR_RELAYS);

    const theme = {
      accent: themeAccent ?? env.NOSTR_THEME_ACCENT,
      text: themeText ?? env.NOSTR_THEME_TEXT,
      surface: themeSurface ?? env.NOSTR_THEME_SURFACE,
      border: themeBorder ?? env.NOSTR_THEME_BORDER
    };

    return reply.send({
      tenant,
      lnAddress,
      relays,
      embedScript: env.NOSTR_EMBED_CDN,
      apiBase: isMock ? 'mock' : env.PUBLIC_ORIGIN,
      theme,
      mock: isMock
    });
  });
}

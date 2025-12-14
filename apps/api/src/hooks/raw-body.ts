import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Lightweight raw-body capture for routes that opt in via config.rawBody = true
export const rawBodyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, _reply) => {
    if (process.env.VITEST === 'true') return;
    const wantsRaw = (request.routeOptions?.config as { rawBody?: boolean } | undefined)?.rawBody;
    if (!wantsRaw) return;

    let data = '';
    await new Promise<void>((resolve, reject) => {
      request.raw.on('data', (chunk) => {
        data += chunk;
      });
      request.raw.on('end', () => resolve());
      request.raw.on('error', reject);
    });
    request.rawBody = data;
    if (!request.body) {
      try {
        request.body = data ? JSON.parse(data) : undefined;
      } catch {
        // leave body undefined if parse fails
      }
    }
  });
});

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

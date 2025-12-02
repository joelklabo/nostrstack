import type { FastifyInstance } from 'fastify';

import type { LogEvent } from '../services/log-hub.js';

export async function registerLogStreamRoute(app: FastifyInstance) {
  app.get('/logs/stream', { logLevel: 'info' }, async (req, reply) => {
    const filterRaw = (req.query as { level?: string }).level;
    const allowed = filterRaw ? new Set(filterRaw.split(',').map((l) => l.trim()).filter(Boolean)) : null;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    });

    const send = (evt: LogEvent) => {
      if (allowed && !allowed.has(String(evt.level))) return;
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    };

    const unsubscribe = app.logHub.subscribe(send);

    const ping = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15000);

    req.raw.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });
}

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import client from 'prom-client';

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const requestCount = new client.Counter({
  name: 'http_requests_total',
  help: 'Count of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant']
});

client.collectDefaultMetrics();

export const metricsPlugin = fp(async function metricsPlugin(app: FastifyInstance) {
  app.addHook('onResponse', async (req, reply) => {
    const route = reply.contextConfig?.url || req.routerPath || 'unknown';
    const tenant = (req.headers.host || 'default').split(':')[0].toLowerCase();
    const labels = [req.method, route, String(reply.statusCode), tenant];
    requestCount.labels(...labels).inc();
    requestDuration.labels(...labels).observe(reply.getResponseTime() / 1000);
  });

  app.decorate('metricsRegistry', client.register);
});

declare module 'fastify' {
  interface FastifyInstance {
    metricsRegistry: typeof client.register;
  }
}

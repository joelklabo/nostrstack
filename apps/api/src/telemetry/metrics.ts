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

export const nostrEventCacheCounter = new client.Counter({
  name: 'nostr_event_cache_total',
  help: 'Nostr event cache hits and misses',
  labelNames: ['result']
});

export const nostrEventResolveFailureCounter = new client.Counter({
  name: 'nostr_event_resolve_failures_total',
  help: 'Nostr event resolver failures',
  labelNames: ['reason']
});

export const nostrEventRelayFetchDuration = new client.Histogram({
  name: 'nostr_event_relay_fetch_duration_seconds',
  help: 'Latency for fetching Nostr events from relays',
  labelNames: ['outcome'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10]
});

export const nip05ProxyCacheCounter = new client.Counter({
  name: 'nip05_proxy_cache_total',
  help: 'NIP-05 proxy cache hits and misses',
  labelNames: ['result']
});

export const nip05ProxyErrorCounter = new client.Counter({
  name: 'nip05_proxy_errors_total',
  help: 'NIP-05 proxy errors by reason',
  labelNames: ['reason']
});

export const nip05ProxyFetchDuration = new client.Histogram({
  name: 'nip05_proxy_fetch_duration_seconds',
  help: 'Latency for fetching NIP-05 nostr.json responses',
  labelNames: ['outcome'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5]
});

export const telemetrySummaryCounter = new client.Counter({
  name: 'telemetry_summary_requests_total',
  help: 'Telemetry summary requests by result',
  labelNames: ['result']
});

client.collectDefaultMetrics();

export const metricsPlugin = fp(async function metricsPlugin(app: FastifyInstance) {
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions?.url || 'unknown';
    const tenant = (req.headers.host || 'default').split(':')[0].toLowerCase();
    const labels = [req.method, route, String(reply.statusCode), tenant];
    requestCount.labels(...labels).inc();
    requestDuration.labels(...labels).observe(reply.elapsedTime / 1000);
  });

  app.decorate('metricsRegistry', client.register);
});

declare module 'fastify' {
  interface FastifyInstance {
    metricsRegistry: typeof client.register;
  }
}

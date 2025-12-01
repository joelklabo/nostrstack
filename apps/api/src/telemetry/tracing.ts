import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import type { Env } from '../env.js';

export function startTracing(env: Env) {
  if (!env.OTEL_ENABLED) return undefined;

  const headers = env.OTEL_EXPORTER_OTLP_HEADERS;
  const collectorOptions = {
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: headers
      ? Object.fromEntries(headers.split(',').map((kv) => {
          const [k, ...rest] = kv.split('=');
          return [k.trim(), rest.join('=').trim()];
        }))
      : undefined
  } as const;

  const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT ? new OTLPTraceExporter(collectorOptions) : undefined;

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fastify': {},
        '@opentelemetry/instrumentation-http': {},
        '@opentelemetry/instrumentation-undici': {}
      })
    ]
  });

  sdk.start();
  return () => sdk.shutdown().catch((e) => console.warn('otel shutdown failed', e));
}

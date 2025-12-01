import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';

import { rawBodyPlugin } from '../src/hooks/raw-body.js';
import { prismaPlugin } from '../src/plugins/prisma.js';
import { registerRoutes } from '../src/routes/index.js';
import { setupRoutes } from '../src/setup-routes.js';
import { metricsPlugin } from '../src/telemetry/metrics.js';

async function main() {
  const app = Fastify();
  await app.register(sensible);
  await app.register(cors, { origin: true });
  await app.register(helmet, { global: true });
  await app.register(formbody);
  await app.register(metricsPlugin);
  await app.register(rawBodyPlugin);
  await app.register(prismaPlugin);
  await app.register(swagger, {
    openapi: {
      info: { title: 'nostrstack API', version: '0.0.0' }
    }
  });

  setupRoutes(app);
  await registerRoutes(app);
  await app.ready();
  const spec = app.swagger();
  const out = resolve(process.cwd(), 'openapi.json');
  writeFileSync(out, JSON.stringify(spec, null, 2));
  console.log('OpenAPI spec written to', out);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

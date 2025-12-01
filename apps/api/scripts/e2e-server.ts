import { buildServer } from '../src/server.js';

const port = Number(process.env.PORT ?? 3301);
process.env.PRISMA_SCHEMA_FILE = process.env.PRISMA_SCHEMA_FILE ?? 'prisma/pg/schema.prisma';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://satoshis:satoshis@localhost:55432/satoshis';

async function main() {
  const server = await buildServer();
  await server.listen({ port, host: '0.0.0.0' });
  console.log(`E2E server listening on ${port}`);
}

main().catch((err) => {
  console.error('Failed to start e2e server', err);
  process.exit(1);
});

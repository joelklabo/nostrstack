import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

config();

// Resolve paths relative to the package root so DB defaults work whether run from src or dist.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const sqliteDefault = `file:${resolve(packageRoot, 'dev.db')}`;
const postgresDefault = 'postgres://nostrstack:nostrstack@localhost:5432/nostrstack';

const defaultDatabaseUrl = process.env.NODE_ENV === 'production' ? postgresDefault : sqliteDefault;

const bool = () =>
  z.preprocess(
    (val) => {
      if (typeof val === 'string') return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
      return val;
    },
    z.boolean()
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.string().default('info'),
  OP_NODE_API_KEY: z.string().default('test-key'),
  OP_NODE_WEBHOOK_SECRET: z.string().default('whsec_test'),
  LN_BITS_URL: z.string().url().optional(),
  LN_BITS_API_KEY: z.string().optional(),
  LIGHTNING_PROVIDER: z.enum(['opennode', 'lnbits', 'mock']).default('opennode'),
  LND_GRPC_ENDPOINT: z.string().optional(),
  LND_GRPC_MACAROON: z.string().optional(),
  LND_GRPC_CERT: z.string().optional(),
  DATABASE_URL: z.string().default(defaultDatabaseUrl),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3001'),
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_JWT_SECRET: z.string().optional(),
  NOSTR_SECRET_KEY: z.string().optional(),
  NOSTR_RELAYS: z.string().optional(), // comma-separated
  NOSTR_EMBED_CDN: z.string().url().default('https://unpkg.com/@nostrstack/embed/dist/index.global.js'),
  NOSTR_THEME_ACCENT: z.string().optional(),
  NOSTR_THEME_TEXT: z.string().optional(),
  NOSTR_THEME_SURFACE: z.string().optional(),
  NOSTR_THEME_BORDER: z.string().optional(),
  DEV_MOCKS: bool().default(false),
  OTEL_ENABLED: bool().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('nostrstack-api')
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

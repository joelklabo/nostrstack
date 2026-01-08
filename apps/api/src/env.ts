import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

import { parseHostAllowlist, validateTelemetryUrl } from './telemetry/url-guard.js';

// Resolve paths relative to the package root so DB defaults work whether run from src or dist.
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const envLocal = resolve(packageRoot, '.env.local');
const envDefault = resolve(packageRoot, '.env');

if (existsSync(envLocal)) {
  config({ path: envLocal });
}
if (existsSync(envDefault)) {
  config({ path: envDefault });
}

const sqliteDefault = `file:${resolve(packageRoot, 'dev.db')}`;
const postgresDefault = 'postgres://nostrstack:nostrstack@localhost:5432/nostrstack';

const defaultDatabaseUrl = process.env.NODE_ENV === 'production' ? postgresDefault : sqliteDefault;
const defaultAllowHttpLocalhost = process.env.NODE_ENV !== 'production';

const bool = () =>
  z.preprocess(
    (val) => {
      if (typeof val === 'string') return ['1', 'true', 'yes', 'on'].includes(val.toLowerCase());
      return val;
    },
    z.boolean()
  );

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.string().default('info'),
  DEV_MOCKS: bool().default(false),
  USE_HTTPS: bool().default(false),
  HTTPS_CERT: z.string().optional(),
  HTTPS_KEY: z.string().optional(),
  OP_NODE_API_KEY: z.string().default('test-key'),
  OP_NODE_WEBHOOK_SECRET: z.string().default('whsec_test'),
  LN_BITS_URL: z.string().url().optional(),
  LN_BITS_API_KEY: z.string().optional(),
  LIGHTNING_PROVIDER: z.enum(['opennode', 'lnbits', 'mock']).default('opennode'),
  BITCOIN_NETWORK: z.enum(['regtest', 'mutinynet', 'mainnet']).default('regtest'),
  TELEMETRY_PROVIDER: z.enum(['bitcoind', 'esplora', 'mock']).default('bitcoind'),
  BITCOIND_RPC_URL: z.string().url().optional(),
  TELEMETRY_ESPLORA_URL: z.string().url().optional(),
  TELEMETRY_HOST_ALLOWLIST: z.string().optional(),
  BOLT12_PROVIDER: z.enum(['cln-rest', 'mock']).optional(),
  BOLT12_REST_URL: z.string().url().optional(),
  BOLT12_REST_API_KEY: z.string().optional(),
  BOLT12_MIN_AMOUNT_MSAT: positiveInt(1000),
  BOLT12_MAX_AMOUNT_MSAT: positiveInt(100000000),
  BOLT12_MIN_EXPIRY_SECONDS: positiveInt(60),
  BOLT12_MAX_EXPIRY_SECONDS: positiveInt(86400),
  BOLT12_MAX_DESCRIPTION_CHARS: positiveInt(140),
  BOLT12_MAX_LABEL_CHARS: positiveInt(64),
  BOLT12_MAX_ISSUER_CHARS: positiveInt(64),
  BOLT12_MAX_PAYER_NOTE_CHARS: positiveInt(200),
  BOLT12_MAX_QUANTITY: positiveInt(100),
  LND_GRPC_ENDPOINT: z.string().optional(),
  LND_GRPC_MACAROON: z.string().optional(),
  LND_GRPC_CERT: z.string().optional(),
  ENABLE_REGTEST_PAY: bool().default(false),
  ENABLE_REGTEST_FUND: bool().default(false),
  ENABLE_LNURL_AUTH: bool().default(false),
  ENABLE_LIGHTNING_ADDRESS: bool().default(false),
  ENABLE_LNURL_WITHDRAW: bool().default(false),
  ENABLE_NWC: bool().default(false),
  ENABLE_BOLT12: bool().default(false),
  DATABASE_URL: z.string().default(defaultDatabaseUrl),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3001'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_JWT_SECRET: z.string().optional(),
  NOSTR_SECRET_KEY: z.string().optional(),
  NOSTR_RELAYS: z.string().optional(), // comma-separated
  NOSTR_RELAY_ALLOWLIST: z.string().optional(),
  NOSTR_RELAY_DENYLIST: z.string().optional(),
  NOSTR_EMBED_CDN: z.string().url().default('https://unpkg.com/@nostrstack/widgets/dist/index.global.js'),
  NOSTR_THEME_ACCENT: z.string().optional(),
  NOSTR_THEME_TEXT: z.string().optional(),
  NOSTR_THEME_SURFACE: z.string().optional(),
  NOSTR_THEME_BORDER: z.string().optional(),
  NOSTR_EVENT_CACHE_TTL_SECONDS: positiveInt(600),
  NOSTR_EVENT_CACHE_MAX_ENTRIES: positiveInt(2000),
  NOSTR_EVENT_MAX_RELAYS: positiveInt(8),
  NOSTR_EVENT_FETCH_TIMEOUT_MS: positiveInt(8000),
  NOSTR_EVENT_REPLY_LIMIT: positiveInt(50),
  NOSTR_EVENT_REPLY_MAX_LIMIT: positiveInt(200),
  NOSTR_EVENT_REPLY_TIMEOUT_MS: positiveInt(8000),
  NIP05_PROXY_TIMEOUT_MS: positiveInt(3000),
  NIP05_PROXY_CACHE_TTL_SECONDS: positiveInt(600),
  NIP05_PROXY_NEGATIVE_TTL_SECONDS: positiveInt(120),
  NIP05_PROXY_MAX_RESPONSE_BYTES: positiveInt(65536),
  NIP05_PROXY_ALLOW_HTTP_LOCALHOST: bool().default(defaultAllowHttpLocalhost),
  OTEL_ENABLED: bool().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('nostrstack-api')
}).superRefine((data, ctx) => {
  const telemetryAllowlist = parseHostAllowlist(data.TELEMETRY_HOST_ALLOWLIST);
  const requireHttps = data.NODE_ENV === 'production';
  const allowPrivateHosts = data.NODE_ENV !== 'production';

  if (data.TELEMETRY_PROVIDER === 'esplora' && !data.TELEMETRY_ESPLORA_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TELEMETRY_ESPLORA_URL'],
      message: 'TELEMETRY_ESPLORA_URL is required when TELEMETRY_PROVIDER=esplora'
    });
  }

  const telemetryUrlError = validateTelemetryUrl(data.TELEMETRY_ESPLORA_URL, {
    label: 'TELEMETRY_ESPLORA_URL',
    requireHttps,
    allowPrivateHosts,
    allowlist: telemetryAllowlist
  });
  if (telemetryUrlError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TELEMETRY_ESPLORA_URL'],
      message: telemetryUrlError
    });
  }

  const bitcoindUrlError = validateTelemetryUrl(data.BITCOIND_RPC_URL, {
    label: 'BITCOIND_RPC_URL',
    requireHttps,
    allowPrivateHosts,
    allowlist: telemetryAllowlist
  });
  if (bitcoindUrlError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BITCOIND_RPC_URL'],
      message: bitcoindUrlError
    });
  }

  if (!data.ENABLE_BOLT12) return;
  if (!data.BOLT12_PROVIDER) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOLT12_PROVIDER'],
      message: 'BOLT12_PROVIDER is required when ENABLE_BOLT12=true'
    });
    return;
  }
  if (data.BOLT12_PROVIDER === 'cln-rest') {
    if (!data.BOLT12_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOLT12_REST_URL'],
        message: 'BOLT12_REST_URL is required for cln-rest provider'
      });
    }
    if (!data.BOLT12_REST_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOLT12_REST_API_KEY'],
        message: 'BOLT12_REST_API_KEY is required for cln-rest provider'
      });
    }
  }
  if (data.BOLT12_MIN_AMOUNT_MSAT > data.BOLT12_MAX_AMOUNT_MSAT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOLT12_MIN_AMOUNT_MSAT'],
      message: 'BOLT12_MIN_AMOUNT_MSAT must be less than or equal to BOLT12_MAX_AMOUNT_MSAT'
    });
  }
  if (data.BOLT12_MIN_EXPIRY_SECONDS > data.BOLT12_MAX_EXPIRY_SECONDS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOLT12_MIN_EXPIRY_SECONDS'],
      message: 'BOLT12_MIN_EXPIRY_SECONDS must be less than or equal to BOLT12_MAX_EXPIRY_SECONDS'
    });
  }
  if (data.NODE_ENV === 'production' && data.BOLT12_PROVIDER === 'mock') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOLT12_PROVIDER'],
      message: 'BOLT12 mock provider is not allowed in production'
    });
  }
  if (data.NODE_ENV === 'production' && data.BOLT12_REST_URL?.startsWith('http://')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOLT12_REST_URL'],
      message: 'BOLT12_REST_URL must use https in production'
    });
  }
  if (
    data.NODE_ENV === 'production' &&
    data.CORS_ALLOWED_ORIGINS?.split(',').some((entry) => entry.trim() === '*')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ALLOWED_ORIGINS'],
      message: 'CORS_ALLOWED_ORIGINS cannot include "*" in production'
    });
  }
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

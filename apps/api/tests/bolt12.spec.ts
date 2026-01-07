import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { waitForHealth } from './utils/wait-for-health.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');

type MockServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

async function startMockBolt12Server(): Promise<MockServer> {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};

    if (req.url === '/v1/offer') {
      if (body?.description === 'fail') {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('failed');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          bolt12: 'lno1mockofferxyz',
          offer_id: 'offer123',
          label: body?.label ?? 'mock-label'
        })
      );
      return;
    }

    if (req.url === '/v1/fetchinvoice') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ invoice: 'lni1mockinvoiceabc' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Unable to start mock BOLT12 server');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
}

let api;
let stopServer: (() => Promise<void>) | null = null;
let stopBolt12: (() => Promise<void>) | null = null;

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'test-admin';
  process.env.OP_NODE_API_KEY = process.env.OP_NODE_API_KEY ?? 'test-key';
  process.env.OP_NODE_WEBHOOK_SECRET = process.env.OP_NODE_WEBHOOK_SECRET ?? 'whsec_test';
  process.env.LIGHTNING_PROVIDER = 'mock';
  process.env.ENABLE_BOLT12 = 'true';
  process.env.BOLT12_PROVIDER = 'cln-rest';
  process.env.BOLT12_REST_API_KEY = 'test-key';
  process.env.BOLT12_MAX_AMOUNT_MSAT = '100000';

  const mock = await startMockBolt12Server();
  process.env.BOLT12_REST_URL = mock.baseUrl;
  stopBolt12 = mock.close;

  const dbPath = process.env.DATABASE_URL ?? 'file:./tmp-bolt12.db';
  process.env.DATABASE_URL = dbPath;
  const schema = dbPath.startsWith('postgres') ? 'prisma/pg/schema.prisma' : 'prisma/schema.prisma';
  execSync(`pnpm exec prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
    stdio: 'inherit',
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  });

  const { buildServer } = await import('../src/server.js');
  const server = await buildServer();
  await server.listen({ port: 0, host: '127.0.0.1' });
  const port = server.server.address()?.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  stopServer = async () => server.close();

  await waitForHealth(`${baseUrl}/health`);
  api = await playwright.request.newContext({ baseURL: baseUrl });
});

test('creates offer and fetches invoice', async () => {
  const offerRes = await api.post('/api/bolt12/offers', {
    data: { description: 'Monthly updates', amountMsat: 1000 }
  });
  expect(offerRes.status()).toBe(201);
  const offer = await offerRes.json();
  expect(offer.offer).toContain('lno1');

  const invoiceRes = await api.post('/api/bolt12/invoices', {
    data: { offer: offer.offer, quantity: 1 }
  });
  expect(invoiceRes.ok()).toBeTruthy();
  const invoice = await invoiceRes.json();
  expect(invoice.invoice).toContain('lni1');
});

test('rejects amounts above configured max', async () => {
  const res = await api.post('/api/bolt12/offers', {
    data: { description: 'Too much', amountMsat: 200000 }
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('bolt12_amount_out_of_range');
});

test('returns provider failure when upstream errors', async () => {
  const res = await api.post('/api/bolt12/offers', {
    data: { description: 'fail' }
  });
  expect(res.status()).toBe(502);
  const body = await res.json();
  expect(body.error).toBe('bolt12_provider_failed');
});

test.afterAll(async () => {
  await api?.dispose();
  if (stopServer) await stopServer();
  if (stopBolt12) await stopBolt12();
});

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket, { type ClientOptions } from 'ws';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file:./tmp-tips-ws.db';

const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ws open timeout')), 2000);
    const cleanup = () => {
      clearTimeout(timer);
      ws.off('open', onOpen);
      ws.off('error', onError);
      ws.off('close', onClose);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('ws closed before open'));
    };
    ws.once('open', onOpen);
    ws.once('error', onError);
    ws.once('close', onClose);
  });

const waitForClose = (ws: WebSocket) =>
  new Promise<{ code: number; reason: string }>((resolve) => {
    ws.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });

const waitFor = async (
  predicate: () => boolean,
  { timeoutMs = 2000, intervalMs = 50, label = 'condition' } = {}
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`timeout waiting for ${label}`);
};

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import for type inference
type Server = Awaited<ReturnType<(typeof import('../server.js'))['buildServer']>>;
let server: Server;
let baseUrl: string;
let tenantAId: string;
let wsOptions: ClientOptions = {};

describe('/ws/tips', () => {
  beforeAll(async () => {
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    execSync(
      `./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      }
    );
    const { buildServer } = await import('../server.js');
    server = await buildServer();
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not start with a TCP port');
    }
    const useHttps = process.env.USE_HTTPS === 'true';
    baseUrl = `${useHttps ? 'wss' : 'ws'}://127.0.0.1:${address.port}`;
    wsOptions = useHttps ? { rejectUnauthorized: false } : {};

    const tenantA = await server.prisma.tenant.upsert({
      where: { domain: 'tenant-a.test' },
      update: {},
      create: { domain: 'tenant-a.test', displayName: 'Tenant A' }
    });
    await server.prisma.tenant.upsert({
      where: { domain: 'tenant-b.test' },
      update: {},
      create: { domain: 'tenant-b.test', displayName: 'Tenant B' }
    });
    tenantAId = tenantA.id;
  });

  afterAll(async () => {
    await server.close();
  });

  it('closes when itemId is missing', async () => {
    const ws = new WebSocket(`${baseUrl}/ws/tips`, wsOptions);
    ws.on('error', () => {});
    const closed = await waitForClose(ws);
    expect(closed.code).toBe(1008);
    expect(closed.reason).toMatch(/itemId/i);
  });

  it('filters tip events by itemId and tenant', async () => {
    const receivedA: Array<{ itemId: string; amount: number }> = [];
    const receivedB: Array<{ itemId: string; amount: number }> = [];
    const receivedC: Array<{ itemId: string; amount: number }> = [];
    let readyA = false;
    let readyB = false;
    let readyC = false;

    const handleMessage = (
      data: WebSocket.RawData,
      markReady: () => void,
      received: Array<{ itemId: string; amount: number }>
    ) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      if (msg.type === 'ready') {
        markReady();
        return;
      }
      if (msg.type !== 'tip') return;
      const itemId = typeof msg.itemId === 'string' ? msg.itemId : '';
      const amount = typeof msg.amount === 'number' ? msg.amount : Number.NaN;
      if (!itemId || !Number.isFinite(amount)) return;
      received.push({ itemId, amount });
    };

    const wsA = new WebSocket(`${baseUrl}/ws/tips?itemId=post-1&domain=tenant-a.test`, {
      ...wsOptions,
      headers: { host: 'tenant-a.test' }
    });
    const wsB = new WebSocket(`${baseUrl}/ws/tips?itemId=post-1&domain=tenant-b.test`, {
      ...wsOptions,
      headers: { host: 'tenant-b.test' }
    });
    const wsC = new WebSocket(`${baseUrl}/ws/tips?itemId=post-2&domain=tenant-a.test`, {
      ...wsOptions,
      headers: { host: 'tenant-a.test' }
    });
    wsA.on('error', () => {});
    wsB.on('error', () => {});
    wsC.on('error', () => {});
    wsA.on('message', (data) =>
      handleMessage(
        data,
        () => {
          readyA = true;
        },
        receivedA
      )
    );
    wsB.on('message', (data) =>
      handleMessage(
        data,
        () => {
          readyB = true;
        },
        receivedB
      )
    );
    wsC.on('message', (data) =>
      handleMessage(
        data,
        () => {
          readyC = true;
        },
        receivedC
      )
    );

    await Promise.all([waitForOpen(wsA), waitForOpen(wsB), waitForOpen(wsC)]);

    await waitFor(() => readyA && readyB && readyC, { label: 'ws ready', timeoutMs: 3000 });

    if (!server.payEventHub) {
      throw new Error('payEventHub not initialized');
    }

    server.payEventHub.broadcast({
      type: 'invoice-paid',
      ts: Date.now(),
      pr: 'invoice',
      providerRef: 'ref-1',
      amount: 250,
      action: 'tip',
      itemId: 'post-1',
      metadata: { note: 'hello' },
      tenantId: tenantAId,
      paymentId: 'pay-1'
    });

    await waitFor(() => receivedA.length === 1, { label: 'tip event' });

    expect(receivedA).toHaveLength(1);
    expect(receivedA[0].itemId).toBe('post-1');
    expect(receivedA[0].amount).toBe(250);
    expect(receivedB).toHaveLength(0);
    expect(receivedC).toHaveLength(0);

    wsA.close();
    wsB.close();
    wsC.close();
    await Promise.all([waitForClose(wsA), waitForClose(wsB), waitForClose(wsC)]);
  });
});

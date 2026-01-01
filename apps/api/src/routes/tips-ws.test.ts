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

type Server = Awaited<ReturnType<typeof import('../server.js')['buildServer']>>;
let server: Server;
let baseUrl: string;
let tenantAId: string;
let wsOptions: ClientOptions = {};

describe('/ws/tips', () => {
  beforeAll(async () => {
    const schema = resolve(process.cwd(), 'prisma/schema.prisma');
    execSync(`./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
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
    const wsA = new WebSocket(`${baseUrl}/ws/tips?itemId=post-1`, {
      ...wsOptions,
      headers: { host: 'tenant-a.test' }
    });
    const wsB = new WebSocket(`${baseUrl}/ws/tips?itemId=post-1`, {
      ...wsOptions,
      headers: { host: 'tenant-b.test' }
    });
    const wsC = new WebSocket(`${baseUrl}/ws/tips?itemId=post-2`, {
      ...wsOptions,
      headers: { host: 'tenant-a.test' }
    });
    wsA.on('error', () => {});
    wsB.on('error', () => {});
    wsC.on('error', () => {});

    await Promise.all([waitForOpen(wsA), waitForOpen(wsB), waitForOpen(wsC)]);

    const receivedA: Array<{ itemId: string; amount: number }> = [];
    const receivedB: Array<{ itemId: string; amount: number }> = [];
    const receivedC: Array<{ itemId: string; amount: number }> = [];

    wsA.on('message', (data) => {
      receivedA.push(JSON.parse(data.toString()) as { itemId: string; amount: number });
    });
    wsB.on('message', (data) => {
      receivedB.push(JSON.parse(data.toString()) as { itemId: string; amount: number });
    });
    wsC.on('message', (data) => {
      receivedC.push(JSON.parse(data.toString()) as { itemId: string; amount: number });
    });

    server.payEventHub?.broadcast({
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

    await new Promise((resolve) => setTimeout(resolve, 150));

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

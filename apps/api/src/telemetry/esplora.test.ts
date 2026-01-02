import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchEsploraSummary, fetchEsploraSummaryForHeight, fetchEsploraTipHeight } from './esplora.js';

const BASE_URL = 'https://esplora.test';

const json = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });
const text = (payload: string) => new Response(payload, { status: 200 });

describe('esplora telemetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds a summary from esplora endpoints', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      switch (url) {
        case `${BASE_URL}/blocks/tip/height`:
          return text('101');
        case `${BASE_URL}/blocks/tip/hash`:
          return text('abc');
        case `${BASE_URL}/block-height/101`:
          return text('abc');
        case `${BASE_URL}/block/abc`:
          return json({ timestamp: 1_700_000_100, tx_count: 2, size: 10, weight: 20 });
        case `${BASE_URL}/mempool`:
          return json({ count: 5, vsize: 50 });
        default:
          return new Response('not found', { status: 404 });
      }
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const summary = await fetchEsploraSummary({ baseUrl: BASE_URL, network: 'mutinynet', lastBlockTime: 1_700_000_000 });
    expect(summary.height).toBe(101);
    expect(summary.hash).toBe('abc');
    expect(summary.network).toBe('mutinynet');
    expect(summary.txs).toBe(2);
    expect(summary.mempoolTxs).toBe(5);
    expect(summary.mempoolBytes).toBe(50);
    expect(summary.interval).toBe(100);
    expect(summary.verificationProgress).toBe(1);
  });

  it('handles partial mempool payloads', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      switch (url) {
        case `${BASE_URL}/block-height/7`:
          return text('hash7');
        case `${BASE_URL}/block/hash7`:
          return json({ timestamp: 1_700_000_200 });
        case `${BASE_URL}/mempool`:
          return json({});
        default:
          return new Response('not found', { status: 404 });
      }
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const summary = await fetchEsploraSummaryForHeight({ baseUrl: BASE_URL, network: 'regtest', height: 7 });
    expect(summary.height).toBe(7);
    expect(summary.network).toBe('regtest');
    expect(summary.mempoolTxs).toBeUndefined();
    expect(summary.mempoolBytes).toBeUndefined();
  });

  it('throws when block JSON is invalid', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      switch (url) {
        case `${BASE_URL}/blocks/tip/height`:
          return text('12');
        case `${BASE_URL}/blocks/tip/hash`:
          return text('hash12');
        case `${BASE_URL}/block-height/12`:
          return text('hash12');
        case `${BASE_URL}/block/hash12`:
          return new Response('not-json', { status: 200 });
        case `${BASE_URL}/mempool`:
          return json({ count: 1, vsize: 2 });
        default:
          return new Response('not found', { status: 404 });
      }
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(fetchEsploraSummary({ baseUrl: BASE_URL, network: 'mutinynet' })).rejects.toThrow();
  });

  it('surfaces timeouts with a clear error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const promise = fetchEsploraTipHeight(BASE_URL, 10);
    const assertion = expect(promise).rejects.toThrow('esplora timeout after 10ms');
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
});

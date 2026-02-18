import type { FastifyBaseLogger } from 'fastify';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWalletFetcher } from './wallet-ws';

describe('wallet-ws fetcher', () => {
  const mockLog = {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  } as unknown as FastifyBaseLogger;
  const originalWalletId = process.env.LN_BITS_WALLET_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env.LN_BITS_WALLET_ID = '';
  });

  afterAll(() => {
    if (originalWalletId === undefined) {
      delete process.env.LN_BITS_WALLET_ID;
    } else {
      process.env.LN_BITS_WALLET_ID = originalWalletId;
    }
  });

  it('logs warn on third failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('connection timeout'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    await fetcher();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed'
    );
  });

  it('suppresses subsequent identical failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('503 Service Unavailable'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    // First failure - no warn (need 3+)
    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    // Second failure - no warn (need 3+)
    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalledWith(
      expect.objectContaining({ successiveFailures: 2 }),
      'wallet-ws fetch failed (suppressed)'
    );

    // Third failure - warn
    await fetcher();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });

  it('logs warn if error key changes', async () => {
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    vi.mocked(fetch).mockRejectedValue(new Error('connection timeout'));
    await fetcher();
    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValue(new Error('401 Unauthorized'));
    await fetcher();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed'
    );
  });

  it('logs warn every 12th failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('continuous fail'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 1; i <= 3; i++) {
      await fetcher();
    }

    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      expect.any(String)
    );
  });

  it('applies backoff after repeated failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('continuous fail'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    await fetcher();
    await fetcher();
    await fetcher();

    expect(mockLog.warn).toHaveBeenCalledTimes(1);

    const result = await fetcher();
    expect(result).toBeNull();
  });

  it('suppresses transport closes as recurring transient failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed: other side closed'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 0; i < 4; i++) {
      await fetcher();
    }

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed (suppressed)'
    );
  });

  it('suppresses generic fetch failed transport failures as recurring transient failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 0; i < 4; i++) {
      await fetcher();
    }

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed (suppressed)'
    );
  });

  it('suppresses fetch failed errors with connection-close cause as recurring transient failures', async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: { message: 'other side closed' }
      })
    );
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 0; i < 4; i++) {
      await fetcher();
    }

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed (suppressed)'
    );
  });

  it('suppresses UND_ERR_SOCKET transport failures as recurring transient failures', async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'UND_ERR_SOCKET' }
      })
    );
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 0; i < 4; i++) {
      await fetcher();
    }

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed (suppressed)'
    );
  });

  it('suppresses ECONNRESET transport errors as recurring transient failures', async () => {
    const connReset = Object.assign(new TypeError('fetch failed'), {
      cause: new Error('connect ECONNRESET 127.0.0.1:5000')
    });

    vi.mocked(fetch).mockRejectedValue(connReset);
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    for (let i = 0; i < 4; i++) {
      await fetcher();
    }

    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed (suppressed)'
    );
  });

  it('resets failure count on success', async () => {
    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    vi.mocked(fetch).mockRejectedValue(new Error('fail'));
    await fetcher();
    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ balance: 100 }))
    } as Response);
    await fetcher();

    vi.mocked(fetch).mockRejectedValue(new Error('fail again'));
    await fetcher();
    await fetcher();
    expect(mockLog.warn).not.toHaveBeenCalled();

    await fetcher();
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ successiveFailures: 3 }),
      'wallet-ws fetch failed'
    );
  });

  it('uses configured LN_BITS_WALLET_ID in LNbits wallet lookup', async () => {
    process.env.LN_BITS_WALLET_ID = 'wallet-abc-123';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(JSON.stringify({ id: 'wallet-abc-123', name: 'Wallet', balance: 500 }))
    } as Response);

    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    await fetcher();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/wallet?usr=wallet-abc-123',
      expect.any(Object)
    );
  });

  it('falls back to default wallet lookup when configured wallet id is not found', async () => {
    process.env.LN_BITS_WALLET_ID = 'missing-wallet';
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({ detail: 'Wallet not found.' }))
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ id: 'wallet-default', name: 'Default Wallet', balance: 250 })
        )
    } as Response);

    const { fetch: fetcher } = createWalletFetcher(mockLog, 'http://localhost:5000', 'test-key');

    const result = await fetcher();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      1,
      'http://localhost:5000/api/v1/wallet?usr=missing-wallet',
      expect.any(Object)
    );
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      2,
      'http://localhost:5000/api/v1/wallet',
      expect.any(Object)
    );
    expect(result).toMatchObject({
      type: 'wallet',
      id: 'wallet-default',
      name: 'Default Wallet',
      balance: 250
    });
  });
});

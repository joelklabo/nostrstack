import type * as nostrReact from '@nostrstack/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from './Sidebar';

const { useWalletSpy, toastSpy, logoutSpy, refreshSpy, setCurrentViewSpy } = vi.hoisted(() => ({
  useWalletSpy: vi.fn(),
  toastSpy: vi.fn(),
  logoutSpy: vi.fn(),
  refreshSpy: vi.fn(),
  setCurrentViewSpy: vi.fn()
}));

vi.mock('@nostrstack/react', async () => {
  const actual = (await vi.importActual('@nostrstack/react')) as typeof nostrReact;
  return {
    ...actual,
    useStats: () => ({ eventCount: 0 }),
    useAuth: () => ({ pubkey: null, logout: logoutSpy }),
    useBitcoinStatus: () => ({ status: null, refresh: refreshSpy }),
    useNostrstackConfig: () => ({
      apiBase: 'https://api.example.test'
    })
  };
});

vi.mock('@nostrstack/ui', async () => {
  const actual = await vi.importActual('@nostrstack/ui');
  return {
    ...actual,
    useToast: () => toastSpy
  };
});

vi.mock('../hooks/useWallet', () => ({
  useWallet: useWalletSpy
}));

describe('Sidebar wallet regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    useWalletSpy.mockReset();
    toastSpy.mockReset();
    refreshSpy.mockReset();
    logoutSpy.mockReset();
    setCurrentViewSpy.mockReset();
  });

  it('keeps wallet actions available in guest shell when wallet service is ready', async () => {
    vi.stubEnv('VITE_ENABLE_REGTEST_FUND', 'true');
    vi.stubEnv('VITE_NETWORK', 'regtest');

    useWalletSpy.mockReturnValue({
      wallet: { id: 'wallet-1', name: 'LNbits', balance: 0 },
      isConnecting: false,
      error: null,
      retry: vi.fn()
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          minedBlocks: 6,
          currentBlockHeight: 101
        }),
        { status: 200 }
      )
    );

    render(<Sidebar currentView="feed" setCurrentView={setCurrentViewSpy} isGuest={true} />);

    expect(useWalletSpy).toHaveBeenCalledWith(true);

    const walletActions = screen.getByRole('group', { name: 'Wallet actions' });
    expect(walletActions).toBeTruthy();

    const addFundsButton = screen.getByRole('button', { name: 'Add funds to regtest wallet' });
    expect(addFundsButton).toBeTruthy();
    expect((addFundsButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(addFundsButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('https://api.example.test/api/regtest/fund', {
        method: 'POST'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Funding complete. Waiting for wallet sync...')).toBeTruthy();
    });
    expect(
      (screen.getByRole('button', { name: 'Add funds to regtest wallet' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});

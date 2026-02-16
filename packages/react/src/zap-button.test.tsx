import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AuthContextType, useAuth } from './auth';
import { useNostrstackConfig } from './context';
import {
  getLnurlpInvoice,
  getLnurlpMetadata,
  type LnurlPayMetadata,
  normalizeLightningAddress,
  parseLnurlPayMetadata
} from './lnurl';
import { ZapButton } from './zap-button';

// Mocks
vi.mock('./auth');
vi.mock('./context');
vi.mock('./lnurl');
vi.mock('./telemetry', () => ({
  emitTelemetryEvent: vi.fn()
}));

const nwcMocks = vi.hoisted(() => ({
  payInvoice: vi.fn(),
  reset: vi.fn(),
  useNwcPayment: vi.fn()
}));

vi.mock('./nwc-pay', () => ({
  useNwcPayment: nwcMocks.useNwcPayment
}));

const mockEvent = {
  id: 'event1',
  pubkey: '00'.repeat(32),
  kind: 1,
  content: 'hello',
  created_at: 1000,
  tags: [],
  sig: 'sig'
};

describe('ZapButton', () => {
  const mockSignEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignEvent.mockResolvedValue({ id: 'zapreq', sig: 'sig' });

    vi.mocked(useAuth).mockReturnValue({
      pubkey: 'mypubkey',
      signEvent: mockSignEvent
    } as unknown as AuthContextType);
    vi.mocked(useNostrstackConfig).mockReturnValue({
      apiBase: 'https://api.example.com',
      relays: ['wss://relay.example.com']
    });
    vi.mocked(getLnurlpMetadata).mockResolvedValue({});
    vi.mocked(parseLnurlPayMetadata).mockReturnValue({
      callback: 'https://callback.com/lnurl',
      minSendable: 1000,
      maxSendable: 10000000,
      commentAllowed: 20
    } as unknown as LnurlPayMetadata);
    vi.mocked(getLnurlpInvoice).mockResolvedValue({
      pr: 'lnbc1testinvoice',
      successAction: null
    });
    vi.mocked(normalizeLightningAddress).mockImplementation((addr) => addr || null);

    nwcMocks.useNwcPayment.mockReturnValue({
      status: 'idle',
      enabled: false,
      payInvoice: nwcMocks.payInvoice,
      reset: nwcMocks.reset
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly', () => {
    render(<ZapButton event={mockEvent} />);
    expect(screen.getByText('⚡ ZAP 21')).toBeTruthy();
  });

  it('shows error if not logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({ pubkey: null } as unknown as AuthContextType);
    render(<ZapButton event={mockEvent} />);

    const btn = screen.getByText('⚡ ZAP 21');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/You must be logged in/)).toBeTruthy();
    });
  });

  it('auto-dismisses unauthenticated error state', async () => {
    vi.mocked(useAuth).mockReturnValue({ pubkey: null } as unknown as AuthContextType);
    render(<ZapButton event={mockEvent} />);

    const btn = screen.getByText('⚡ ZAP 21');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/You must be logged in/)).toBeTruthy();
    });

    await waitFor(
      () => {
        expect(screen.queryByText(/You must be logged in/)).toBeNull();
      },
      { timeout: 4_000 }
    );
  });

  it('resolves LNURL and requests invoice', async () => {
    const eventWithLud16 = { ...mockEvent, tags: [['lud16', 'user@domain.com']] };

    render(<ZapButton event={eventWithLud16} />);
    fireEvent.click(screen.getByText('⚡ ZAP 21'));

    await waitFor(() => {
      expect(getLnurlpMetadata).toHaveBeenCalledWith('https://domain.com/.well-known/lnurlp/user');
    });

    await waitFor(() => {
      expect(getLnurlpInvoice).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Invoice ready/)).toBeTruthy();
    });
  });

  it('handles NWC payment', async () => {
    nwcMocks.useNwcPayment.mockReturnValue({
      status: 'idle',
      enabled: true,
      payInvoice: nwcMocks.payInvoice,
      reset: nwcMocks.reset
    });
    nwcMocks.payInvoice.mockResolvedValue(true);

    const eventWithLud16 = { ...mockEvent, tags: [['lud16', 'user@domain.com']] };
    render(<ZapButton event={eventWithLud16} />);
    fireEvent.click(screen.getByText('⚡ ZAP 21'));

    await waitFor(() => {
      expect(nwcMocks.payInvoice).toHaveBeenCalled();
    });
  });

  it('falls back to WebLN payment', async () => {
    nwcMocks.useNwcPayment.mockReturnValue({
      status: 'idle',
      enabled: false,
      payInvoice: nwcMocks.payInvoice,
      reset: nwcMocks.reset
    });

    const sendPayment = vi.fn().mockResolvedValue({ preimage: 'preimage' });
    const enable = vi.fn().mockResolvedValue(undefined);
    Object.assign(window, {
      webln: { enable, sendPayment }
    });

    const eventWithLud16 = { ...mockEvent, tags: [['lud16', 'user@domain.com']] };
    render(<ZapButton event={eventWithLud16} />);
    fireEvent.click(screen.getByText('⚡ ZAP 21'));

    await waitFor(() => {
      expect(enable).toHaveBeenCalled();
      expect(sendPayment).toHaveBeenCalledWith('lnbc1testinvoice');
    });

    // Cleanup window.webln
    delete (window as Window & { webln?: unknown }).webln;
  });
});

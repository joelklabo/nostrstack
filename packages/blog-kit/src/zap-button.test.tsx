import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from './auth';
import { useNostrstackConfig } from './context';
import {
  getLnurlpInvoice,
  getLnurlpMetadata,
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
  tags: []
};

describe('ZapButton', () => {
  const mockSignEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignEvent.mockResolvedValue({ id: 'zapreq', sig: 'sig' });

    (useAuth as any).mockReturnValue({
      pubkey: 'mypubkey',
      signEvent: mockSignEvent
    });
    (useNostrstackConfig as any).mockReturnValue({
      apiBase: 'https://api.example.com',
      relays: ['wss://relay.example.com']
    });
    (getLnurlpMetadata as any).mockResolvedValue({});
    (parseLnurlPayMetadata as any).mockReturnValue({
      callback: 'https://callback.com/lnurl',
      minSendable: 1000,
      maxSendable: 10000000,
      commentAllowed: 20
    });
    (getLnurlpInvoice as any).mockResolvedValue({
      pr: 'lnbc1testinvoice',
      successAction: null
    });
    (normalizeLightningAddress as any).mockImplementation((addr: string) => addr);

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
    (useAuth as any).mockReturnValue({ pubkey: null });
    render(<ZapButton event={mockEvent} />);

    const btn = screen.getByText('⚡ ZAP 21');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/You must be logged in/)).toBeTruthy();
    });
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
    delete (window as any).webln;
  });
});

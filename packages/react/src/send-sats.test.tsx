import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { getLnurlpInvoice, getLnurlpMetadata } from './lnurl';
import { SendSats } from './send-sats';

const mockUseAuth = vi.fn();
const mockUseConfig = vi.fn();

vi.mock('./auth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('./context', () => ({
  useNostrstackConfig: () => mockUseConfig(),
  NostrstackProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('./lnurl', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vi.importOriginal requires inline import() syntax
  const mod = await importOriginal<typeof import('./lnurl')>();
  return {
    ...mod,
    getLnurlpMetadata: vi.fn(),
    getLnurlpInvoice: vi.fn()
  };
});

const mockApiBaseConfig = {
  raw: 'http://localhost:3001',
  baseUrl: 'http://localhost:3001',
  isConfigured: true,
  isMock: false,
  isRelative: false
};
const recipientPubkey = 'a'.repeat(64);
const senderPubkey = 'b'.repeat(64);

const mockedGetLnurlpMetadata = getLnurlpMetadata as unknown as Mock;
const mockedGetLnurlpInvoice = getLnurlpInvoice as unknown as Mock;

function renderSendSats() {
  return render(
    <SendSats
      pubkey={recipientPubkey}
      lightningAddress="alice@example.com"
      defaultAmountSats={500}
      presetAmountsSats={[21, 100, 500]}
    />
  );
}

describe('SendSats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      pubkey: senderPubkey,
      signEvent: vi.fn(async (event) => ({
        ...event,
        id: 'signed',
        sig: 'sig',
        pubkey: senderPubkey
      }))
    });
    mockUseConfig.mockReturnValue({
      apiBase: 'http://localhost:3001',
      baseUrl: 'http://localhost:3001',
      apiBaseConfig: mockApiBaseConfig,
      relays: ['wss://relay.example'],
      enableRegtestPay: false,
      nwcUri: undefined,
      nwcRelays: undefined,
      nwcMaxSats: undefined
    });
  });

  it('updates amount from preset buttons', () => {
    renderSendSats();
    const input = screen.getByLabelText('Amount in satoshis') as HTMLInputElement;
    expect(input.value).toBe('500');

    fireEvent.click(screen.getByRole('button', { name: /Set amount to 21 sats/i }));
    expect(input.value).toBe('21');
  });

  it('requests an invoice and shows the modal', async () => {
    mockedGetLnurlpMetadata.mockResolvedValue({
      tag: 'payRequest',
      callback: 'https://example.com/lnurl/callback',
      minSendable: 1000,
      maxSendable: 500000,
      metadata: '[]',
      commentAllowed: 120
    });
    mockedGetLnurlpInvoice.mockResolvedValue({ pr: 'lnbc123' });

    renderSendSats();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send 500/i }));
    });

    expect(mockedGetLnurlpMetadata).toHaveBeenCalledWith(
      'https://example.com/.well-known/lnurlp/alice'
    );

    expect(await screen.findByText(/invoice ready/i)).toBeInTheDocument();
    expect(screen.getByText('lnbc123')).toBeInTheDocument();
  });

  it('shows an error state when lnurl metadata fails', async () => {
    mockedGetLnurlpMetadata.mockRejectedValue(new Error('Metadata error'));

    renderSendSats();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send 500/i }));
    });

    const errors = await screen.findAllByText(/Error: Metadata error/);
    expect(errors.length).toBeGreaterThan(0);
    expect(mockedGetLnurlpInvoice).not.toHaveBeenCalled();
  });

  it('shows auth guidance when invoice request is denied', async () => {
    mockedGetLnurlpMetadata.mockResolvedValue({
      tag: 'payRequest',
      callback: 'https://example.com/lnurl/callback',
      minSendable: 1000,
      maxSendable: 500000,
      metadata: '[]',
      commentAllowed: 120
    });
    mockedGetLnurlpInvoice.mockRejectedValue(new Error('ACCESS_DENIED'));

    renderSendSats();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send 500/i }));
    });

    const authErrors = await screen.findAllByText((content) =>
      content.includes('Authentication required. Please sign in to continue.')
    );
    expect(authErrors.length).toBeGreaterThan(0);
  });

  it('shows error in modal when user is not logged in', () => {
    mockUseAuth.mockReturnValue({
      pubkey: null,
      signEvent: vi.fn()
    });

    renderSendSats();

    const sendButton = screen.getByRole('button', { name: /send 500/i });
    fireEvent.click(sendButton);

    expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
  });
});

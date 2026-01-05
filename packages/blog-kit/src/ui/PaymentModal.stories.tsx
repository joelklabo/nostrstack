import type { Meta, StoryObj } from '@storybook/react';

import { PaymentModal } from './PaymentModal';

const meta = {
  title: 'Payment/PaymentModal',
  component: PaymentModal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof PaymentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Idle state
export const Idle: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 21',
    subtitle: 'npub1alice...',
    statusItems: [
      { text: 'Ready to zap', tone: 'neutral' },
    ],
  },
};

// Loading state - fetching invoice
export const LoadingInvoice: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 100',
    subtitle: 'npub1bob...',
    statusItems: [
      { text: 'Fetching Lightning address...', tone: 'neutral', spinner: true },
    ],
  },
};

// Invoice ready with QR code
export const InvoiceReady: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 500',
    subtitle: 'alice@getalby.com',
    statusItems: [
      { text: 'Invoice ready', tone: 'success' },
    ],
    invoice: {
      value: 'lnbc5000n1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'idle',
      onCopy: fn(),
      onOpenWallet: fn(),
    },
  },
};

// Invoice copied
export const InvoiceCopied: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 1000',
    subtitle: 'bob@strike.me',
    statusItems: [
      { text: 'Invoice ready', tone: 'success' },
    ],
    invoice: {
      value: 'lnbc10000n1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'copied',
      onCopy: fn(),
      onOpenWallet: fn(),
    },
  },
};

// Waiting for payment
export const WaitingPayment: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 210',
    subtitle: 'charlie@ln.tips',
    statusItems: [
      { text: 'Waiting for payment...', tone: 'neutral', spinner: true },
    ],
    invoice: {
      value: 'lnbc2100n1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'idle',
      onCopy: fn(),
      onOpenWallet: fn(),
    },
  },
};

// Payment successful
export const PaymentSuccess: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 1000',
    subtitle: 'alice@wallet.satoshis.tech',
    statusItems: [],
    success: true,
    successMessage: 'Payment sent! ⚡',
  },
};

// Payment successful with action
export const SuccessWithAction: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 5000',
    subtitle: 'creator@voltage.cloud',
    statusItems: [],
    success: true,
    successMessage: 'Zap sent successfully! ⚡',
    successAction: {
      title: 'Check your zap receipt',
      body: 'Your payment of 5000 sats has been recorded on Nostr',
      url: 'https://example.com/receipt/abc123',
      label: 'View Receipt',
    },
  },
};

// Error state - LNURL fetch failed
export const ErrorLnurlFailed: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 100',
    subtitle: 'invalid@address.com',
    statusItems: [
      { text: 'Failed to fetch Lightning address', tone: 'error' },
    ],
    error: true,
  },
};

// Error state - Invoice generation failed
export const ErrorInvoiceFailed: Story = {
  args: {
    open: true,
    title: 'SEND ⚡ 10000',
    subtitle: 'recipient@ln.address',
    statusItems: [
      { text: 'Failed to generate invoice', tone: 'error' },
      { text: 'Amount exceeds maximum (5000 sats)', tone: 'error' },
    ],
    error: true,
  },
};

// Error state - Payment timeout
export const ErrorPaymentTimeout: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 500',
    subtitle: 'timeout@example.com',
    statusItems: [
      { text: 'Payment verification timed out', tone: 'error' },
    ],
    error: true,
  },
};

// With regtest controls
export const WithRegtestControls: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 42',
    subtitle: 'test@regtest.local',
    statusItems: [
      { text: 'Invoice ready (regtest)', tone: 'success' },
    ],
    invoice: {
      value: 'lnbcrt420n1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'idle',
      regtestAvailable: true,
      regtestPaying: false,
      onCopy: fn(),
      onOpenWallet: fn(),
      onRegtestPay: fn(),
    },
  },
};

// Regtest payment in progress
export const RegtestPaymentInProgress: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 21',
    subtitle: 'regtest@localhost',
    statusItems: [
      { text: 'Regtest payment in progress...', tone: 'neutral', spinner: true },
    ],
    invoice: {
      value: 'lnbcrt210n1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'idle',
      regtestAvailable: true,
      regtestPaying: true,
      onCopy: fn(),
      onOpenWallet: fn(),
      onRegtestPay: fn(),
    },
  },
};

// With disclaimer
export const WithDisclaimer: Story = {
  args: {
    open: true,
    title: 'ZAP ⚡ 100000',
    subtitle: 'mainnet@real.wallet',
    statusItems: [
      { text: 'Invoice ready', tone: 'success' },
    ],
    invoice: {
      value: 'lnbc1m1pj9x2zzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
      copyStatus: 'idle',
      onCopy: fn(),
      onOpenWallet: fn(),
    },
    disclaimer: '⚠️ MAINNET: Real Bitcoin. Double-check the amount before paying.',
  },
};

// Multiple status items
export const MultipleStatusItems: Story = {
  args: {
    open: true,
    title: 'SEND ⚡ 1000',
    subtitle: 'alice@example.com',
    statusItems: [
      { text: 'Connected to Lightning address', tone: 'success' },
      { text: 'Generating invoice...', tone: 'neutral', spinner: true },
      { text: 'Amount: 1000 sats', tone: 'neutral' },
    ],
  },
};

/**
 * Shared type definitions for embed widgets
 */

export interface NostrEvent {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

export type TipWidgetOptions = {
  username: string;
  amountMsat?: number;
  text?: string;
  baseURL?: string;
  host?: string;
  onInvoice?: (pr: string) => void;
};

export type TipWidgetV2Options = {
  username: string;
  itemId: string;
  presetAmountsSats?: number[];
  defaultAmountSats?: number;
  allowCustomAmount?: boolean;
  showFeed?: boolean;
  text?: string;
  baseURL?: string;
  host?: string;
  metadata?: Record<string, unknown>;
  size?: 'full' | 'compact';
  onInvoice?: (info: { pr: string; providerRef: string | null; amountSats: number }) => void;
  onPaid?: (info: {
    pr: string;
    providerRef: string | null;
    amountSats: number;
    itemId: string;
    metadata?: unknown;
  }) => void;
};

export type TipFeedOptions = {
  itemId: string;
  maxItems?: number;
  baseURL?: string;
  host?: string;
};

export type PayToActionOptions = {
  username: string;
  amountMsat?: number;
  text?: string;
  baseURL?: string;
  host?: string;
  verifyPayment?: (pr: string) => Promise<boolean>;
  onUnlock?: () => void;
  onInvoice?: (pr: string) => void;
};

export type CommentWidgetOptions = {
  threadId?: string;
  relays?: string[];
  placeholder?: string;
  headerText?: string;
  maxItems?: number;
  maxAgeDays?: number;
  lazyConnect?: boolean;
  validateEvents?: boolean;
  onEvent?: (event: NostrEvent, relay?: string) => void;
  onRelayInfo?: (info: { relays: string[]; mode: 'real' }) => void;
};

export type CommentTipWidgetOptions = TipWidgetV2Options &
  CommentWidgetOptions & {
    layout?: 'full' | 'compact';
  };

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: NostrEvent) => Promise<NostrEvent>;
    };
    NostrTools?: {
      relayInit?: (url: string) => unknown;
      verifySignature?: (event: NostrEvent) => boolean;
      validateEvent?: (event: NostrEvent) => boolean;
    };
  }
}

export type PaymentFlow = 'zap' | 'send-sats';
export type PaymentStage = 'invoice_requested' | 'invoice_ready' | 'payment_sent' | 'payment_failed';
export type PaymentMethod = 'nwc' | 'webln' | 'manual' | 'regtest';
export type PaymentFailureReason = 'lnurl' | 'nwc' | 'webln' | 'manual' | 'regtest' | 'validation' | 'unknown';

export type PaymentTelemetryEvent = {
  type: 'payment';
  flow: PaymentFlow;
  stage: PaymentStage;
  method?: PaymentMethod;
  amountSats?: number;
  reason?: PaymentFailureReason;
  timestamp: number;
};

export type SearchStage = 'start' | 'success' | 'failure';
export type SearchSource = 'npub' | 'nprofile' | 'hex' | 'nip05';
export type SearchTelemetryEvent = {
  type: 'search';
  stage: SearchStage;
  query: string;
  source?: SearchSource;
  pubkey?: string;
  reason?: string;
  timestamp: number;
};

export type ClientTelemetryEvent = PaymentTelemetryEvent | SearchTelemetryEvent;
export type ClientTelemetryEventInput =
  | Omit<PaymentTelemetryEvent, 'timestamp'>
  | Omit<SearchTelemetryEvent, 'timestamp'>;

export const TELEMETRY_EVENT_NAME = 'nostrstack:telemetry';

export function emitTelemetryEvent(event: ClientTelemetryEventInput & { timestamp?: number }) {
  if (typeof window === 'undefined') return;
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const detail: ClientTelemetryEvent = {
    ...event,
    timestamp
  };
  window.dispatchEvent(new CustomEvent(TELEMETRY_EVENT_NAME, { detail }));
}

export function subscribeTelemetry(listener: (event: ClientTelemetryEvent) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (raw: Event) => {
    if (!(raw instanceof CustomEvent)) return;
    const detail = raw.detail as ClientTelemetryEvent | undefined;
    if (!detail || typeof detail !== 'object') return;
    if (detail.type !== 'payment' && detail.type !== 'search') return;
    listener(detail);
  };
  window.addEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);
}

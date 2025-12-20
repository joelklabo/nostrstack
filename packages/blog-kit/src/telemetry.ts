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

export type ClientTelemetryEvent = PaymentTelemetryEvent;

export const TELEMETRY_EVENT_NAME = 'nostrstack:telemetry';

export function emitTelemetryEvent(event: Omit<ClientTelemetryEvent, 'timestamp'> & { timestamp?: number }) {
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
    if (detail.type !== 'payment') return;
    listener(detail);
  };
  window.addEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);
}

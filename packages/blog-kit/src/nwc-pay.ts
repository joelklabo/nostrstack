import { useCallback, useState } from 'react';

import { NwcClient } from './nwc';

const NWC_PAYMENT_KEY = 'nostrstack.nwc.lastPayment';

type NwcPaymentPayload = {
  status: 'success' | 'error';
  message: string;
  ts: number;
};

type NwcPaymentResult = {
  status: 'idle' | 'paying' | 'paid' | 'error';
  message: string | null;
  enabled: boolean;
  payInvoice: (invoice: string, amountMsat: number) => Promise<boolean>;
  reset: () => void;
};

type NwcPaymentOptions = {
  uri?: string | null;
  relays?: string[];
  maxAmountMsat?: number;
};

type NwcMock = {
  payInvoice?: (invoice: string, amountMsat: number) => Promise<void>;
};

export function useNwcPayment(options: NwcPaymentOptions): NwcPaymentResult {
  const { uri, relays, maxAmountMsat } = options;
  const [status, setStatus] = useState<'idle' | 'paying' | 'paid' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const enabled = Boolean(uri);

  const persist = useCallback((payload: NwcPaymentPayload) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(NWC_PAYMENT_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-payment', { detail: payload }));
    } catch {
      // ignore storage errors
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setMessage(null);
  }, []);

  const payInvoice = useCallback(async (invoice: string, amountMsat: number) => {
    if (!uri) return false;
    setStatus('paying');
    setMessage('Paying via NWC…');
    let client: NwcClient | null = null;
    try {
      const mock = typeof window !== 'undefined'
        ? (window as { __NOSTRSTACK_NWC_MOCK__?: NwcMock }).__NOSTRSTACK_NWC_MOCK__
        : null;
      if (mock?.payInvoice) {
        await mock.payInvoice(invoice, amountMsat);
      } else {
        client = new NwcClient({ uri, relays, maxAmountMsat });
        await client.payInvoice(invoice, amountMsat);
      }
      const successMessage = 'NWC payment sent.';
      setStatus('paid');
      setMessage(successMessage);
      persist({ status: 'success', message: successMessage, ts: Date.now() });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'NWC payment failed.';
      setStatus('error');
      setMessage(errorMessage);
      persist({ status: 'error', message: errorMessage, ts: Date.now() });
      return false;
    } finally {
      client?.close();
    }
  }, [uri, relays, maxAmountMsat, persist]);

  return {
    status,
    message,
    enabled,
    payInvoice,
    reset
  };
}

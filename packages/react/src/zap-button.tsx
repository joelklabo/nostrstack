import { type Event, type EventTemplate, nip19, SimplePool } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBase } from './api-base';
import { useAuth } from './auth';
import { useNostrstackConfig } from './context';
import {
  deriveLnurlStatusUrl,
  encodeLnurl,
  getLnurlpInvoice,
  getLnurlpMetadata,
  isPaidStatus,
  type LnurlSuccessAction,
  normalizeLightningAddress,
  parseLnurlPayMetadata,
  sanitizeSuccessAction
} from './lnurl';
import { useNwcPayment } from './nwc-pay';
import {
  emitTelemetryEvent,
  type PaymentFailureReason,
  type PaymentMethod,
  type PaymentStage
} from './telemetry';
import { PaymentModal, type PaymentStatusItem, type PaymentSuccessAction } from './ui/PaymentModal';

interface WebLN {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage: string }>;
}

declare global {
  interface Window {
    webln?: WebLN;
  }
}

interface ZapButtonProps {
  event: Event; // The event to zap
  amountSats?: number;
  message?: string;
  apiBase?: string;
  host?: string;
  authorLightningAddress?: string;
  relays?: string[];
  enableRegtestPay?: boolean;
  onZapSuccess?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];

function extractLightningAddressFromProfile(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.lud16 === 'string' && rec.lud16.trim()) return rec.lud16.trim();
  if (typeof rec.lud06 === 'string' && rec.lud06.trim()) return rec.lud06.trim();
  return null;
}

function extractLightningAddressFromEvent(event: Event): string | null {
  const lud16Tag = event.tags.find((tag) => tag[0] === 'lud16');
  if (lud16Tag && lud16Tag[1]) return lud16Tag[1];

  const lud06Tag = event.tags.find((tag) => tag[0] === 'lud06');
  if (lud06Tag && lud06Tag[1]) return lud06Tag[1];

  if (event.kind === 0 && event.content) {
    try {
      const profile = JSON.parse(event.content) as unknown;
      return extractLightningAddressFromProfile(profile);
    } catch {
      // ignore
    }
  }
  return null;
}

export function ZapButton({
  event,
  amountSats = 21,
  message = 'Zap!',
  apiBase,
  authorLightningAddress,
  relays,
  enableRegtestPay,
  onZapSuccess,
  className,
  style
}: ZapButtonProps) {
  const { pubkey, signEvent } = useAuth();
  const cfg = useNostrstackConfig();
  const [zapState, setZapState] = useState<
    'idle' | 'pending-lnurl' | 'pending-invoice' | 'waiting-payment' | 'paid' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<LnurlSuccessAction | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);
  const [regtestError, setRegtestError] = useState<string | null>(null);
  const [regtestPaying, setRegtestPaying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const amountSnapshotRef = useRef(amountSats);
  const telemetryStateRef = useRef({
    invoiceRequested: false,
    invoiceReady: false,
    paymentSuccess: false,
    paymentFailures: new Set<string>()
  });

  // Use ref to avoid infinite loops when parent doesn't memoize onZapSuccess
  const onZapSuccessRef = useRef(onZapSuccess);
  useEffect(() => {
    onZapSuccessRef.current = onZapSuccess;
  });

  useEffect(() => {
    if (zapState === 'paid') {
      onZapSuccessRef.current?.();
    }
  }, [zapState]);

  const authorPubkey = event.pubkey;
  const authorNpub = useMemo(() => nip19.npubEncode(authorPubkey), [authorPubkey]);
  const apiBaseRaw = apiBase ?? cfg.apiBase ?? cfg.baseUrl ?? '';
  const apiBaseConfig = useMemo(
    () => cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw),
    [cfg.apiBaseConfig, apiBaseRaw]
  );
  const resolvedApiBase = apiBaseConfig.baseUrl;
  const regtestEnabled = enableRegtestPay ?? cfg.enableRegtestPay ?? false;
  const regtestAvailable = regtestEnabled && apiBaseConfig.isConfigured;
  const regtestUnavailableReason =
    regtestEnabled && !apiBaseConfig.isConfigured
      ? 'Regtest pay unavailable (API base not configured).'
      : null;
  const effectiveRegtestError = regtestError ?? regtestUnavailableReason;
  const nwcUri = cfg.nwcUri?.trim();
  const nwcRelays = cfg.nwcRelays;
  const nwcMaxSats = cfg.nwcMaxSats;
  const nwcMaxMsat = typeof nwcMaxSats === 'number' ? nwcMaxSats * 1000 : undefined;
  const {
    status: nwcPayStatus,
    message: nwcPayMessage,
    enabled: nwcEnabled,
    payInvoice: payInvoiceViaNwc,
    reset: resetNwcPayment
  } = useNwcPayment({ uri: nwcUri, relays: nwcRelays, maxAmountMsat: nwcMaxMsat });

  const relayTargets = useMemo(() => {
    const base = relays ?? cfg.relays ?? RELAYS;
    const cleaned = base.map((relay) => relay.trim()).filter(Boolean);
    return cleaned.length ? cleaned : RELAYS;
  }, [relays, cfg.relays]);

  const eventLightningAddress = useMemo(() => extractLightningAddressFromEvent(event), [event]);

  const resetTelemetry = useCallback(() => {
    telemetryStateRef.current = {
      invoiceRequested: false,
      invoiceReady: false,
      paymentSuccess: false,
      paymentFailures: new Set<string>()
    };
  }, []);

  const emitPaymentTelemetry = useCallback(
    (
      stage: PaymentStage,
      options: { method?: PaymentMethod; reason?: PaymentFailureReason } = {}
    ) => {
      const state = telemetryStateRef.current;
      if (stage === 'invoice_requested') {
        if (state.invoiceRequested) return;
        state.invoiceRequested = true;
      } else if (stage === 'invoice_ready') {
        if (state.invoiceReady) return;
        state.invoiceReady = true;
      } else if (stage === 'payment_sent') {
        if (state.paymentSuccess) return;
        state.paymentSuccess = true;
      } else if (stage === 'payment_failed') {
        if (state.paymentSuccess) return;
        const failureKey = options.method ?? options.reason ?? 'unknown';
        if (state.paymentFailures.has(failureKey)) return;
        state.paymentFailures.add(failureKey);
      }
      emitTelemetryEvent({
        type: 'payment',
        flow: 'zap',
        stage,
        method: options.method,
        reason: options.reason,
        amountSats: amountSnapshotRef.current
      });
    },
    []
  );

  const resolveLightningAddress = useCallback(async () => {
    const globalOverride =
      typeof window !== 'undefined'
        ? (window as { __NOSTRSTACK_ZAP_ADDRESS__?: string }).__NOSTRSTACK_ZAP_ADDRESS__
        : undefined;
    const override = normalizeLightningAddress(authorLightningAddress ?? globalOverride);
    if (override) return override;

    const configAddress = normalizeLightningAddress(cfg.lnAddress);
    if (configAddress) return configAddress;

    const fromEvent = normalizeLightningAddress(eventLightningAddress);
    if (fromEvent) return fromEvent;

    if (!relayTargets.length) return null;
    const pool = new SimplePool();
    try {
      const metaEvents = await pool.querySync(relayTargets, {
        kinds: [0],
        authors: [authorPubkey],
        limit: 10
      });
      const sorted = [...metaEvents].sort((a, b) => b.created_at - a.created_at);
      for (const meta of sorted) {
        if (!meta?.content) continue;
        try {
          const candidate = extractLightningAddressFromProfile(JSON.parse(meta.content) as unknown);
          const normalized = normalizeLightningAddress(candidate);
          if (normalized) return normalized;
        } catch {
          // ignore invalid metadata
        }
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch author metadata for lightning address', err);
      return null;
    } finally {
      try {
        pool.close(relayTargets);
      } catch {
        // ignore close errors
      }
    }
  }, [authorLightningAddress, cfg.lnAddress, eventLightningAddress, authorPubkey, relayTargets]);

  const handleZap = useCallback(async () => {
    if (!pubkey) {
      setErrorMessage('Error: You must be logged in to send a zap.');
      setZapState('error');
      return;
    }

    setZapState('pending-lnurl');
    setErrorMessage(null);
    setRegtestError(null);
    setInvoice(null);
    setSuccessAction(null);
    setStatusUrl(null);
    resetNwcPayment();
    setCopyStatus('idle');
    amountSnapshotRef.current = amountSats;
    resetTelemetry();
    emitPaymentTelemetry('invoice_requested');

    try {
      const resolvedAddress = await resolveLightningAddress();
      if (!resolvedAddress) {
        setErrorMessage('Error: Author does not have a Lightning Address/LNURL.');
        setZapState('error');
        return;
      }

      // 1. Fetch LNURL-pay metadata
      const lnurlp = resolvedAddress.includes('@')
        ? `https://${resolvedAddress.split('@')[1]}/.well-known/lnurlp/${resolvedAddress.split('@')[0]}`
        : resolvedAddress;
      const lnurlMetadataRaw = await getLnurlpMetadata(lnurlp);
      const allowHttp =
        typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(window.location.hostname);
      const lnurlMetadata = parseLnurlPayMetadata(lnurlMetadataRaw, { allowHttp });
      const minSendable = lnurlMetadata.minSendable;
      const maxSendable = lnurlMetadata.maxSendable;
      const amountMsat = amountSats * 1000;
      if (amountMsat < minSendable || amountMsat > maxSendable) {
        throw new Error(
          `Zap amount must be between ${Math.ceil(minSendable / 1000)} and ${Math.floor(maxSendable / 1000)} sats.`
        );
      }
      const commentAllowed = lnurlMetadata.commentAllowed;
      const zapMessage =
        typeof commentAllowed === 'number' ? message.slice(0, commentAllowed) : message;

      // 2. Create a NIP-57 Zap Request Event
      const lnurlTag = lnurlMetadata.encoded
        ? String(lnurlMetadata.encoded).toUpperCase()
        : encodeLnurl(lnurlp) ?? resolvedAddress;

      const zapRequestEventTemplate: EventTemplate = {
        kind: 9734, // Zap Request
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relays', ...relayTargets], // Global relays or specific ones
          ['amount', String(amountMsat)], // msat
          ['lnurl', lnurlTag], // NIP-57 encoded LNURL
          ['p', authorPubkey],
          ['e', event.id],
          ['content', zapMessage],
          ['p', pubkey] // My pubkey as sender
        ],
        content: zapMessage
      };

      const signedZapRequest = await signEvent(zapRequestEventTemplate);

      // 3. Get invoice from callback URL
      setZapState('pending-invoice');
      const invoiceData = await getLnurlpInvoice(
        lnurlMetadata.callback,
        amountMsat,
        lnurlTag ?? null,
        signedZapRequest
      );
      const pr = invoiceData.pr;
      if (typeof pr !== 'string' || !pr) {
        throw new Error('Invoice response missing payment request.');
      }
      const nextProviderRef =
        invoiceData?.provider_ref && typeof invoiceData.provider_ref === 'string'
          ? invoiceData.provider_ref
          : null;
      let nextStatusUrl = nextProviderRef
        ? deriveLnurlStatusUrl(lnurlMetadata.callback, nextProviderRef)
        : null;
      if (nextStatusUrl && resolvedApiBase) {
        try {
          const expectedOrigin = new URL(resolvedApiBase).origin;
          const statusOrigin = new URL(nextStatusUrl).origin;
          if (expectedOrigin !== statusOrigin) {
            nextStatusUrl = null;
          }
        } catch {
          nextStatusUrl = null;
        }
      }
      const nextSuccessAction = sanitizeSuccessAction(invoiceData?.successAction);
      setInvoice(pr);
      setSuccessAction(nextSuccessAction);
      setStatusUrl(nextStatusUrl);
      setZapState('waiting-payment');
      emitPaymentTelemetry('invoice_ready');

      if (nwcEnabled) {
        const paidViaNwc = await payInvoiceViaNwc(pr, amountMsat);
        if (paidViaNwc) {
          emitPaymentTelemetry('payment_sent', { method: 'nwc' });
          setZapState('paid');
          return;
        }
        emitPaymentTelemetry('payment_failed', { method: 'nwc', reason: 'nwc' });
      }

      // Attempt WebLN payment
      if (typeof window !== 'undefined' && window.webln) {
        try {
          await window.webln.enable();
          await window.webln.sendPayment(pr);
          emitPaymentTelemetry('payment_sent', { method: 'webln' });
          setZapState('paid');
        } catch (weblnErr) {
          console.warn('WebLN payment failed, falling back to QR:', weblnErr);
          emitPaymentTelemetry('payment_failed', { method: 'webln', reason: 'webln' });
        }
      }

      // (Optional) Poll for payment status
      timerRef.current = window.setTimeout(
        () => {
          // Show timeout notification instead of silently closing
          setTimedOut(true);
          emitPaymentTelemetry('payment_failed', { reason: 'timeout' as PaymentFailureReason });
        },
        5 * 60 * 1000
      ); // 5 minutes to pay
    } catch (err: unknown) {
      setErrorMessage(`Error: ${(err as Error).message || String(err)}`);
      setZapState('error');
      emitPaymentTelemetry('payment_failed', { reason: 'lnurl' });
    }
  }, [
    pubkey,
    signEvent,
    resolveLightningAddress,
    authorPubkey,
    event,
    amountSats,
    message,
    relayTargets,
    payInvoiceViaNwc,
    nwcEnabled,
    resolvedApiBase,
    resetNwcPayment,
    emitPaymentTelemetry,
    resetTelemetry
  ]);

  const handleCopyInvoice = useCallback(async () => {
    if (!invoice) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(invoice);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    } finally {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
    }
  }, [invoice]);

  const handleRegtestPay = useCallback(async () => {
    if (!invoice) return;
    if (!regtestEnabled) {
      setRegtestError('Regtest pay disabled.');
      return;
    }
    if (!apiBaseConfig.isConfigured) {
      setRegtestError('Regtest pay unavailable (API base not configured).');
      return;
    }
    setRegtestPaying(true);
    setRegtestError(null);
    try {
      const url = resolvedApiBase ? `${resolvedApiBase}/api/regtest/pay` : '/api/regtest/pay';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice })
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }
      emitPaymentTelemetry('payment_sent', { method: 'regtest' });
      setZapState('paid');
    } catch (err: unknown) {
      setRegtestError(err instanceof Error ? err.message : 'Regtest pay failed.');
      emitPaymentTelemetry('payment_failed', { method: 'regtest', reason: 'regtest' });
    } finally {
      setRegtestPaying(false);
    }
  }, [invoice, regtestEnabled, apiBaseConfig.isConfigured, resolvedApiBase, emitPaymentTelemetry]);

  const handleCloseZap = useCallback(() => {
    if (zapState === 'waiting-payment' && invoice) {
      emitPaymentTelemetry('payment_failed', { method: 'manual', reason: 'manual' });
    }
    setZapState('idle');
    setErrorMessage(null);
    setRegtestError(null);
    setInvoice(null);
    setSuccessAction(null);
    setStatusUrl(null);
    resetNwcPayment();
    setCopyStatus('idle');
    setTimedOut(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    triggerRef.current?.focus();
  }, [resetNwcPayment, zapState, invoice, emitPaymentTelemetry]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (zapState !== 'waiting-payment' || !statusUrl) return;
    let active = true;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const res = await fetch(statusUrl);
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (!active) return;
        if (isPaidStatus(data.status)) {
          emitPaymentTelemetry('payment_sent', { method: 'manual' });
          setZapState('paid');
          return;
        }
      } catch {
        // ignore polling errors
      }
      if (!active) return;
      timer = window.setTimeout(poll, 4000);
    };

    poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emitPaymentTelemetry is stable
  }, [zapState, statusUrl]);

  const nip57Disclaimer =
    'NIP-57 receipts show intent and are not proof of payment. Confirm settlement in your wallet.';

  const nwcStatusItem = useMemo<PaymentStatusItem | null>(() => {
    if (nwcPayStatus === 'idle') return null;
    if (nwcPayStatus === 'paying') {
      return { text: nwcPayMessage ?? 'Paying via NWC...', tone: 'neutral', spinner: true };
    }
    if (nwcPayStatus === 'paid') {
      return { text: nwcPayMessage ?? 'NWC payment sent.', tone: 'success' };
    }
    return { text: nwcPayMessage ?? 'NWC payment failed.', tone: 'error' };
  }, [nwcPayStatus, nwcPayMessage]);

  const statusItems = useMemo<PaymentStatusItem[]>(() => {
    const items: PaymentStatusItem[] = [];
    const awaitingPayment = zapState === 'waiting-payment' && Boolean(invoice);

    switch (zapState) {
      case 'pending-lnurl':
        items.push({ text: `Resolving LNURL for ${authorNpub}...`, spinner: true });
        break;
      case 'pending-invoice':
        items.push({ text: 'Requesting invoice...', spinner: true });
        break;
      case 'waiting-payment':
        if (invoice) {
          items.push({ text: 'Invoice ready. Scan the QR or open your wallet to pay.' });
        } else {
          items.push({ text: 'Awaiting invoice...', spinner: true });
        }
        break;
      case 'paid':
        items.push({ text: 'Payment sent.', tone: 'success' });
        break;
      case 'error':
        items.push({ text: errorMessage ?? 'Zap failed.', tone: 'error' });
        break;
      default:
        break;
    }

    if (nwcStatusItem) items.push(nwcStatusItem);
    if (awaitingPayment && !timedOut) {
      items.push({ text: 'Awaiting payment confirmation...', spinner: true });
    }
    if (timedOut) {
      items.push({ text: 'Payment timed out. Please try again.', tone: 'error' });
    }
    if (effectiveRegtestError) {
      items.push({ text: effectiveRegtestError, tone: 'error' });
    }

    return items;
  }, [zapState, authorNpub, invoice, errorMessage, nwcStatusItem, timedOut, effectiveRegtestError]);

  const successActionDisplay = useMemo<PaymentSuccessAction | null>(() => {
    if (!successAction) return null;
    const tag = successAction.tag?.toLowerCase();
    if (tag === 'message' && successAction.message) {
      return { title: 'MESSAGE', body: successAction.message };
    }
    if (tag === 'url' && successAction.url) {
      return {
        title: 'OPEN_LINK',
        url: successAction.url,
        label: successAction.description ?? successAction.url
      };
    }
    if (tag === 'aes') {
      return {
        title: successAction.description ?? 'ENCRYPTED_MESSAGE',
        body: 'Open your wallet to view the encrypted message.'
      };
    }
    return null;
  }, [successAction]);

  const invoicePayload = useMemo(() => {
    if (zapState !== 'waiting-payment' || !invoice) return null;
    return {
      value: invoice,
      copyStatus,
      regtestAvailable,
      regtestPaying,
      onCopy: handleCopyInvoice,
      onOpenWallet: () => window.open(`lightning:${invoice}`, '_blank'),
      onRegtestPay: regtestAvailable ? handleRegtestPay : undefined
    };
  }, [
    zapState,
    invoice,
    copyStatus,
    regtestAvailable,
    regtestPaying,
    handleCopyInvoice,
    handleRegtestPay
  ]);

  return (
    <>
      <button
        ref={triggerRef}
        className={`action-btn zap-btn ${className ?? ''}`}
        style={style}
        onClick={handleZap}
        disabled={zapState !== 'idle'}
        aria-label={
          zapState === 'idle'
            ? `Send ${amountSats} sats as zap`
            : zapState === 'paid'
              ? 'Zap sent successfully'
              : 'Sending zap'
        }
        aria-busy={zapState !== 'idle' && zapState !== 'paid' && zapState !== 'error'}
        aria-disabled={zapState !== 'idle'}
      >
        ⚡ ZAP {amountSats}
      </button>

      <PaymentModal
        open={zapState !== 'idle'}
        title={`ZAP ⚡ ${amountSats}`}
        subtitle={authorNpub}
        statusItems={statusItems}
        invoice={invoicePayload}
        success={zapState === 'paid'}
        successMessage="Payment sent."
        successAction={successActionDisplay}
        error={zapState === 'error' || timedOut}
        disclaimer={nip57Disclaimer}
        onClose={handleCloseZap}
        titleId="zap-title"
        statusId="zap-status"
      />
    </>
  );
}

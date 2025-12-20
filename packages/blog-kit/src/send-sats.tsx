import type { EventTemplate } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { QRCodeSVG } from 'qrcode.react';
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
import { emitTelemetryEvent, type PaymentFailureReason, type PaymentMethod, type PaymentStage } from './telemetry';

interface WebLN {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage: string }>;
}

declare global {
  interface Window {
    webln?: WebLN;
  }
}

type SendSatsProps = {
  pubkey: string;
  lightningAddress?: string | null;
  defaultAmountSats?: number;
  presetAmountsSats?: number[];
  notePlaceholder?: string;
  apiBase?: string;
  relays?: string[];
  enableRegtestPay?: boolean;
};

type SendLimits = {
  minSats?: number;
  maxSats?: number;
  commentAllowed?: number;
};

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

export function SendSats({
  pubkey,
  lightningAddress,
  defaultAmountSats = 500,
  presetAmountsSats = [21, 100, 500],
  notePlaceholder = 'Add a note…',
  apiBase,
  relays,
  enableRegtestPay
}: SendSatsProps) {
  const { pubkey: senderPubkey, signEvent } = useAuth();
  const cfg = useNostrstackConfig();

  const [amountSats, setAmountSats] = useState(defaultAmountSats);
  const [note, setNote] = useState('');
  const [limits, setLimits] = useState<SendLimits | null>(null);
  const [sendState, setSendState] = useState<'idle' | 'pending-lnurl' | 'pending-invoice' | 'waiting-payment' | 'paid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<LnurlSuccessAction | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);
  const [regtestError, setRegtestError] = useState<string | null>(null);
  const [regtestPaying, setRegtestPaying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const amountSnapshotRef = useRef(defaultAmountSats);
  const telemetryStateRef = useRef({
    invoiceRequested: false,
    invoiceReady: false,
    paymentSuccess: false,
    paymentFailures: new Set<string>()
  });

  const apiBaseRaw = apiBase ?? cfg.apiBase ?? cfg.baseUrl ?? '';
  const apiBaseConfig = useMemo(
    () => cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw),
    [cfg.apiBaseConfig, apiBaseRaw]
  );
  const resolvedApiBase = apiBaseConfig.baseUrl;
  const regtestEnabled = enableRegtestPay ?? cfg.enableRegtestPay ?? false;
  const regtestAvailable = regtestEnabled && apiBaseConfig.isConfigured;
  const regtestUnavailableReason =
    regtestEnabled && !apiBaseConfig.isConfigured ? 'Regtest pay unavailable (API base not configured).' : null;
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

  const normalizedAddress = useMemo(() => normalizeLightningAddress(lightningAddress ?? null), [lightningAddress]);
  const recipientNpub = useMemo(() => nip19.npubEncode(pubkey), [pubkey]);

  const resetTelemetry = useCallback(() => {
    telemetryStateRef.current = {
      invoiceRequested: false,
      invoiceReady: false,
      paymentSuccess: false,
      paymentFailures: new Set<string>()
    };
  }, []);

  const emitPaymentTelemetry = useCallback((
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
      flow: 'send-sats',
      stage,
      method: options.method,
      reason: options.reason,
      amountSats: amountSnapshotRef.current
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!senderPubkey) {
      setErrorMessage('ERROR: You must be logged in to send sats.');
      setSendState('error');
      return;
    }

    setSendState('pending-lnurl');
    setErrorMessage(null);
    setInvoice(null);
    setSuccessAction(null);
    setStatusUrl(null);
    setRegtestError(null);
    resetNwcPayment();
    setCopyStatus('idle');
    amountSnapshotRef.current = amountSats;
    resetTelemetry();
    emitPaymentTelemetry('invoice_requested');

    try {
      if (!normalizedAddress) {
        throw new Error('Recipient does not have a Lightning Address/LNURL.');
      }
      const lnurlp = normalizedAddress.includes('@')
        ? `https://${normalizedAddress.split('@')[1]}/.well-known/lnurlp/${normalizedAddress.split('@')[0]}`
        : normalizedAddress;

      const lnurlMetadataRaw = await getLnurlpMetadata(lnurlp);
      const allowHttp =
        typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(window.location.hostname);
      const lnurlMetadata = parseLnurlPayMetadata(lnurlMetadataRaw, { allowHttp });
      const minSats = Math.ceil(lnurlMetadata.minSendable / 1000);
      const maxSats = Math.floor(lnurlMetadata.maxSendable / 1000);
      setLimits({ minSats, maxSats, commentAllowed: lnurlMetadata.commentAllowed });

      const amountMsat = amountSats * 1000;
      if (amountMsat < lnurlMetadata.minSendable || amountMsat > lnurlMetadata.maxSendable) {
        throw new Error(`Amount must be between ${minSats} and ${maxSats} sats.`);
      }

      const noteContent = typeof lnurlMetadata.commentAllowed === 'number'
        ? note.slice(0, lnurlMetadata.commentAllowed)
        : note;

      const lnurlTag = lnurlMetadata.encoded
        ? String(lnurlMetadata.encoded).toUpperCase()
        : encodeLnurl(lnurlp) ?? normalizedAddress;

      const zapRequestEventTemplate: EventTemplate = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relays', ...relayTargets],
          ['amount', String(amountMsat)],
          ['lnurl', lnurlTag],
          ['p', pubkey],
          ['content', noteContent]
        ],
        content: noteContent
      };

      const signedZapRequest = await signEvent(zapRequestEventTemplate);

      setSendState('pending-invoice');
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
      setSendState('waiting-payment');
      emitPaymentTelemetry('invoice_ready');

      if (nwcEnabled) {
        const paidViaNwc = await payInvoiceViaNwc(pr, amountMsat);
        if (paidViaNwc) {
          emitPaymentTelemetry('payment_sent', { method: 'nwc' });
          setSendState('paid');
          return;
        }
        emitPaymentTelemetry('payment_failed', { method: 'nwc', reason: 'nwc' });
      }

      if (typeof window !== 'undefined' && window.webln) {
        try {
          await window.webln.enable();
          await window.webln.sendPayment(pr);
          emitPaymentTelemetry('payment_sent', { method: 'webln' });
          setSendState('paid');
        } catch (weblnErr) {
          console.warn('WebLN payment failed, falling back to QR:', weblnErr);
          emitPaymentTelemetry('payment_failed', { method: 'webln', reason: 'webln' });
        }
      }

      timerRef.current = window.setTimeout(() => {
        setSendState('idle');
        setInvoice(null);
      }, 5 * 60 * 1000);
    } catch (err: unknown) {
      setErrorMessage(`ERROR: ${(err as Error).message || String(err)}`);
      setSendState('error');
      emitPaymentTelemetry('payment_failed', { reason: 'lnurl' });
    }
  }, [
    senderPubkey,
    amountSats,
    note,
    normalizedAddress,
    pubkey,
    relayTargets,
    signEvent,
    resetNwcPayment,
    nwcEnabled,
    payInvoiceViaNwc,
    resolvedApiBase,
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
      setSendState('paid');
    } catch (err: unknown) {
      setRegtestError(err instanceof Error ? err.message : 'Regtest pay failed.');
      emitPaymentTelemetry('payment_failed', { method: 'regtest', reason: 'regtest' });
    } finally {
      setRegtestPaying(false);
    }
  }, [invoice, regtestEnabled, apiBaseConfig.isConfigured, resolvedApiBase, emitPaymentTelemetry]);

  const handleClose = useCallback(() => {
    if (sendState === 'waiting-payment' && invoice) {
      emitPaymentTelemetry('payment_failed', { method: 'manual', reason: 'manual' });
    }
    setSendState('idle');
    setErrorMessage(null);
    setRegtestError(null);
    setInvoice(null);
    setSuccessAction(null);
    setStatusUrl(null);
    resetNwcPayment();
    setCopyStatus('idle');
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    triggerRef.current?.focus();
  }, [resetNwcPayment, sendState, invoice, emitPaymentTelemetry]);

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
    if (sendState === 'idle' || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sendState]);

  useEffect(() => {
    if (sendState === 'idle') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable ?? modal).focus();
  }, [sendState]);

  useEffect(() => {
    if (sendState === 'idle') return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || active === modal) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [sendState, handleClose]);

  useEffect(() => {
    if (sendState !== 'waiting-payment' || !statusUrl) return;
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
          setSendState('paid');
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
  }, [sendState, statusUrl]);

  const statusConfig = useMemo(() => {
    switch (sendState) {
      case 'pending-lnurl':
        return { text: `Resolving LNURL for ${recipientNpub}...`, tone: 'neutral', spinner: true };
      case 'pending-invoice':
        return { text: 'Requesting invoice...', tone: 'neutral', spinner: true };
      case 'waiting-payment':
        return {
          text: invoice ? 'Invoice ready. Scan the QR or pay with your wallet.' : 'Waiting for invoice...',
          tone: 'neutral',
          spinner: !invoice
        };
      case 'paid':
        return { text: 'Payment successful!', tone: 'success', spinner: false };
      case 'error':
        return { text: errorMessage ?? 'Send failed.', tone: 'error', spinner: false };
      default:
        return { text: '', tone: 'neutral', spinner: false };
    }
  }, [sendState, recipientNpub, invoice, errorMessage]);

  const nwcStatusDisplay = useMemo(() => {
    if (nwcPayStatus === 'idle') return null;
    if (nwcPayStatus === 'paying') {
      return { text: nwcPayMessage ?? 'Paying via NWC…', tone: 'neutral', spinner: true };
    }
    if (nwcPayStatus === 'paid') {
      return { text: nwcPayMessage ?? 'NWC payment sent.', tone: 'success', spinner: false };
    }
    return { text: nwcPayMessage ?? 'NWC payment failed.', tone: 'error', spinner: false };
  }, [nwcPayStatus, nwcPayMessage]);

  const successActionDisplay = useMemo(() => {
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

  const showInvoice = sendState === 'waiting-payment' && Boolean(invoice);
  const hasError = Boolean(errorMessage);
  const minSats = limits?.minSats;
  const maxSats = limits?.maxSats;
  const commentAllowed = limits?.commentAllowed;

  return (
    <div className="send-sats-card">
      <div className="send-sats-header">SEND_SATS</div>
      <div className="send-sats-amount">
        <label htmlFor="send-sats-amount-input">AMOUNT_SATS</label>
        <input
          id="send-sats-amount-input"
          className="nostrstack-input"
          type="number"
          min={minSats}
          max={maxSats}
          value={amountSats}
          onChange={(event) => setAmountSats(Number(event.target.value))}
        />
      </div>
      <div className="send-sats-presets">
        {presetAmountsSats.map((preset) => (
          <button
            key={preset}
            type="button"
            className="action-btn"
            onClick={() => setAmountSats(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="send-sats-note">
        <label htmlFor="send-sats-note-input">NOTE</label>
        <textarea
          id="send-sats-note-input"
          className="nostrstack-textarea"
          placeholder={notePlaceholder}
          value={note}
          maxLength={typeof commentAllowed === 'number' ? commentAllowed : undefined}
          onChange={(event) => setNote(event.target.value)}
          disabled={commentAllowed === 0}
        />
      </div>
      {(minSats || maxSats) && (
        <div className="send-sats-status">
          Limits: {minSats ?? '—'} - {maxSats ?? '—'} sats
        </div>
      )}
      {hasError && <div className="send-sats-status send-sats-status--error">{errorMessage}</div>}
      <button
        ref={triggerRef}
        className="action-btn"
        type="button"
        onClick={handleSend}
        disabled={sendState !== 'idle' || !normalizedAddress}
      >
        SEND {amountSats}
      </button>

      {sendState !== 'idle' && (
        <div className="zap-overlay" onClick={handleClose} role="presentation">
          <div
            className="zap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-sats-title"
            aria-describedby="send-sats-status"
            tabIndex={-1}
            ref={modalRef}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="zap-header">
              <div>
                <div className="zap-title" id="send-sats-title">
                  SEND ⚡ {amountSats}
                </div>
                <div className="zap-subtitle">{recipientNpub}</div>
              </div>
              <button className="zap-close" type="button" aria-label="Close send sats dialog" onClick={handleClose}>
                ×
              </button>
            </header>
            <div className="zap-body">
              <div
                className={`zap-status ${
                  statusConfig.tone === 'success'
                    ? 'zap-status--success'
                    : statusConfig.tone === 'error'
                      ? 'zap-status--error'
                      : ''
                }`}
                id="send-sats-status"
                aria-live="polite"
              >
                {statusConfig.spinner && <span className="zap-spinner" aria-hidden="true" />}
                <span>{statusConfig.text}</span>
              </div>
              {nwcStatusDisplay && (
                <div
                  className={`zap-status ${
                    nwcStatusDisplay.tone === 'success'
                      ? 'zap-status--success'
                      : nwcStatusDisplay.tone === 'error'
                        ? 'zap-status--error'
                        : ''
                  }`}
                >
                  {nwcStatusDisplay.spinner && <span className="zap-spinner" aria-hidden="true" />}
                  <span>{nwcStatusDisplay.text}</span>
                </div>
              )}
              {effectiveRegtestError && <div className="zap-status zap-status--error">{effectiveRegtestError}</div>}

              {showInvoice && invoice && (
                <div className="zap-grid">
                  <div className="zap-qr">
                    <QRCodeSVG value={invoice} size={240} bgColor="#ffffff" fgColor="#0f172a" level="L" />
                  </div>
                  <div className="zap-panel">
                    <div className="zap-panel-header">
                      <div className="zap-panel-title">INVOICE</div>
                      {regtestAvailable && <div className="zap-panel-badge">REGTEST</div>}
                    </div>
                    <div className="zap-invoice-box">
                      <code>{invoice}</code>
                    </div>
                    <div className="zap-actions">
                      <button className="zap-action" type="button" onClick={handleCopyInvoice} disabled={!invoice}>
                        {copyStatus === 'copied'
                          ? 'COPIED'
                          : copyStatus === 'error'
                            ? 'COPY_FAILED'
                            : 'COPY_INVOICE'}
                      </button>
                      <button
                        className="zap-action zap-action-primary"
                        type="button"
                        onClick={() => window.open(`lightning:${invoice}`, '_blank')}
                      >
                        OPEN_WALLET
                      </button>
                      {regtestAvailable && (
                        <button
                          className="zap-action zap-action-warning"
                          type="button"
                          onClick={handleRegtestPay}
                          disabled={regtestPaying}
                        >
                          {regtestPaying ? 'PAYING_REGTEST...' : 'PAY_REGTEST'}
                        </button>
                      )}
                      <button className="zap-action" type="button" onClick={handleClose}>
                        CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {sendState === 'paid' && (
                <div className="zap-success">
                  <div className="zap-success-icon">✓</div>
                  <div>Payment confirmed.</div>
                  {successActionDisplay && (
                    <div className="zap-success-action">
                      <div className="zap-success-action-title">{successActionDisplay.title}</div>
                      {successActionDisplay.url ? (
                        <a href={successActionDisplay.url} target="_blank" rel="noopener noreferrer">
                          {successActionDisplay.label}
                        </a>
                      ) : (
                        <div>{successActionDisplay.body}</div>
                      )}
                    </div>
                  )}
                  <button className="zap-action zap-action-primary" type="button" onClick={handleClose}>
                    CLOSE
                  </button>
                </div>
              )}

              {sendState === 'error' && (
                <div className="zap-actions">
                  <button className="zap-action" type="button" onClick={handleClose}>
                    CLOSE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

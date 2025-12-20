import { bech32 } from '@scure/base';
import { Buffer } from 'buffer';
import { type Event, type EventTemplate, nip19, SimplePool } from 'nostr-tools';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBase } from './api-base';
import { useAuth } from './auth';
import { useNostrstackConfig } from './context';

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
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

function decodeLnurl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('lnurl')) {
    try {
      const { words } = bech32.decode(lower, 1000);
      const data = bech32.fromWords(words);
      return new TextDecoder().decode(data);
    } catch {
      // ignore invalid bech32
    }
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.toLowerCase().startsWith('http')) return decoded;
  } catch {
    // ignore invalid base64
  }
  return null;
}

function extractLightningAddressFromProfile(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.lud16 === 'string' && rec.lud16.trim()) return rec.lud16.trim();
  if (typeof rec.lud06 === 'string' && rec.lud06.trim()) return rec.lud06.trim();
  return null;
}

function extractLightningAddressFromEvent(event: Event): string | null {
  const lud16Tag = event.tags.find(tag => tag[0] === 'lud16');
  if (lud16Tag && lud16Tag[1]) return lud16Tag[1];

  const lud06Tag = event.tags.find(tag => tag[0] === 'lud06');
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

function normalizeLightningAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('@')) return trimmed;
  return decodeLnurl(trimmed);
}

function encodeLnurl(url: string): string | null {
  try {
    const normalized = new URL(url).toString();
    const words = bech32.toWords(new TextEncoder().encode(normalized));
    return bech32.encode('lnurl', words, 1000).toUpperCase();
  } catch {
    return null;
  }
}

// Minimal LNURL-pay client, just enough for zaps.
// In a real scenario, use @nostrstack/sdk or similar for robust client.
async function getLnurlpMetadata(lnurl: string) {
  const url = new URL(lnurl);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

async function getLnurlpInvoice(callback: string, amountMsat: number, lnurlMetadata: string, event: EventTemplate) {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMsat));
  url.searchParams.set('nostr', JSON.stringify(event)); // NIP-57 specific
  url.searchParams.set('lnurl', lnurlMetadata); // NIP-57 specific
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json(); // { pr: string }
}

export function ZapButton({
  event,
  amountSats = 21,
  message = 'Zap!',
  apiBase,
  authorLightningAddress,
  relays,
  enableRegtestPay
}: ZapButtonProps) {
  const { pubkey, signEvent } = useAuth();
  const cfg = useNostrstackConfig();
  const [zapState, setZapState] = useState<'idle' | 'pending-lnurl' | 'pending-invoice' | 'waiting-payment' | 'paid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [regtestError, setRegtestError] = useState<string | null>(null);
  const [regtestPaying, setRegtestPaying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

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
    regtestEnabled && !apiBaseConfig.isConfigured ? 'Regtest pay unavailable (API base not configured).' : null;
  const effectiveRegtestError = regtestError ?? regtestUnavailableReason;

  const relayTargets = useMemo(() => {
    const base = relays ?? cfg.relays ?? RELAYS;
    const cleaned = base.map((relay) => relay.trim()).filter(Boolean);
    return cleaned.length ? cleaned : RELAYS;
  }, [relays, cfg.relays]);

  const eventLightningAddress = useMemo(() => extractLightningAddressFromEvent(event), [event]);

  const resolveLightningAddress = useCallback(async () => {
    const override = normalizeLightningAddress(authorLightningAddress);
    if (override) return override;

    const fromEvent = normalizeLightningAddress(eventLightningAddress);
    if (fromEvent) return fromEvent;

    if (!relayTargets.length) return null;
    const pool = new SimplePool();
    try {
      const metaEvents = await pool.querySync(relayTargets, { kinds: [0], authors: [authorPubkey], limit: 10 });
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
  }, [authorLightningAddress, eventLightningAddress, authorPubkey, relayTargets]);

  const handleZap = useCallback(async () => {
    if (!pubkey) {
      setErrorMessage('ERROR: You must be logged in to send a zap.');
      setZapState('error');
      return;
    }

    setZapState('pending-lnurl');
    setErrorMessage(null);
    setRegtestError(null);
    setInvoice(null);
    setCopyStatus('idle');

    try {
      const resolvedAddress = await resolveLightningAddress();
      if (!resolvedAddress) {
        setErrorMessage('ERROR: Author does not have a Lightning Address/LNURL.');
        setZapState('error');
        return;
      }

      // 1. Fetch LNURL-pay metadata
      const lnurlp = resolvedAddress.includes('@')
        ? `https://${resolvedAddress.split('@')[1]}/.well-known/lnurlp/${resolvedAddress.split('@')[0]}`
        : resolvedAddress;
      const lnurlMetadata = await getLnurlpMetadata(lnurlp);
      if (!lnurlMetadata || typeof lnurlMetadata !== 'object') {
        throw new Error('LNURL metadata is invalid.');
      }

      if (lnurlMetadata.tag !== 'payRequest') {
        throw new Error('LNURL does not support payRequest (NIP-57).');
      }
      const minSendable = Number(lnurlMetadata.minSendable);
      const maxSendable = Number(lnurlMetadata.maxSendable);
      if (!Number.isFinite(minSendable) || !Number.isFinite(maxSendable)) {
        throw new Error('LNURL metadata missing sendable limits.');
      }
      const amountMsat = amountSats * 1000;
      if (amountMsat < minSendable || amountMsat > maxSendable) {
        throw new Error(`Zap amount must be between ${Math.ceil(minSendable / 1000)} and ${Math.floor(maxSendable / 1000)} sats.`);
      }
      if (typeof lnurlMetadata.callback !== 'string' || !lnurlMetadata.callback) {
        throw new Error('LNURL metadata missing callback URL.');
      }
      if (typeof lnurlMetadata.metadata !== 'string' || !lnurlMetadata.metadata) {
        throw new Error('LNURL metadata missing metadata string.');
      }

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
          ['content', message],
          ['p', pubkey] // My pubkey as sender
        ],
        content: message,
      };
      
      const signedZapRequest = await signEvent(zapRequestEventTemplate);
      
      // 3. Get invoice from callback URL
      setZapState('pending-invoice');
      const invoiceData = await getLnurlpInvoice(
        lnurlMetadata.callback,
        amountMsat,
        lnurlMetadata.metadata,
        signedZapRequest
      );
      const pr = invoiceData.pr;
      setInvoice(pr);
      setZapState('waiting-payment');

      // Attempt WebLN payment
      if (typeof window !== 'undefined' && window.webln) {
        try {
          await window.webln.enable();
          await window.webln.sendPayment(pr);
          setZapState('paid');
        } catch (weblnErr) {
          console.warn('WebLN payment failed, falling back to QR:', weblnErr);
        }
      }

      // (Optional) Poll for payment status
      timerRef.current = window.setTimeout(() => {
        setZapState('idle');
        setInvoice(null);
      }, 5 * 60 * 1000); // 5 minutes to pay
      
    } catch (err: unknown) {
      setErrorMessage(`ERROR: ${(err as Error).message || String(err)}`);
      setZapState('error');
    }
  }, [pubkey, signEvent, resolveLightningAddress, authorPubkey, event, amountSats, message, relayTargets]);

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
      setZapState('paid');
    } catch (err: unknown) {
      setRegtestError(err instanceof Error ? err.message : 'Regtest pay failed.');
    } finally {
      setRegtestPaying(false);
    }
  }, [invoice, regtestEnabled, apiBaseConfig.isConfigured, resolvedApiBase]);

  const handleCloseZap = useCallback(() => {
    setZapState('idle');
    setErrorMessage(null);
    setRegtestError(null);
    setInvoice(null);
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
  }, []);

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
    if (zapState === 'idle' || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [zapState]);

  useEffect(() => {
    if (zapState === 'idle') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable ?? modal).focus();
  }, [zapState]);

  useEffect(() => {
    if (zapState === 'idle') return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseZap();
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
  }, [zapState, handleCloseZap]);

  const statusConfig = useMemo(() => {
    switch (zapState) {
      case 'pending-lnurl':
        return { text: `Resolving LNURL for ${authorNpub}...`, tone: 'neutral', spinner: true };
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
        return { text: errorMessage ?? 'Zap failed.', tone: 'error', spinner: false };
      default:
        return { text: '', tone: 'neutral', spinner: false };
    }
  }, [zapState, authorNpub, invoice, errorMessage]);

  const showInvoice = zapState === 'waiting-payment' && Boolean(invoice);

  return (
    <>
      <button ref={triggerRef} className="action-btn zap-btn" onClick={handleZap} disabled={zapState !== 'idle'}>
        ⚡ ZAP {amountSats}
      </button>

      {zapState !== 'idle' && (
        <div className="zap-overlay" onClick={handleCloseZap} role="presentation">
          <div
            className="zap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zap-title"
            aria-describedby="zap-status"
            tabIndex={-1}
            ref={modalRef}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="zap-header">
              <div>
                <div className="zap-title" id="zap-title">
                  ZAP ⚡ {amountSats}
                </div>
                <div className="zap-subtitle">{authorNpub}</div>
              </div>
              <button className="zap-close" type="button" aria-label="Close zap dialog" onClick={handleCloseZap}>
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
                id="zap-status"
                aria-live="polite"
              >
                {statusConfig.spinner && <span className="zap-spinner" aria-hidden="true" />}
                <span>{statusConfig.text}</span>
              </div>
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
                      <button className="zap-action" type="button" onClick={handleCloseZap}>
                        CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {zapState === 'paid' && (
                <div className="zap-success">
                  <div className="zap-success-icon">✓</div>
                  <div>Payment confirmed.</div>
                  <button className="zap-action zap-action-primary" type="button" onClick={handleCloseZap}>
                    CLOSE
                  </button>
                </div>
              )}

              {zapState === 'error' && (
                <div className="zap-actions">
                  <button className="zap-action" type="button" onClick={handleCloseZap}>
                    CLOSE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { Buffer } from 'buffer';
import { type Event, type EventTemplate, SimplePool, nip19 } from 'nostr-tools';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth';

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
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];

function decodeLnurl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('lnurl')) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.toLowerCase().startsWith('lnurl')) return decoded;
  } catch {
    // ignore invalid base64
  }
  return null;
}

function extractLightningAddressFromProfile(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.lud16 === 'string' && rec.lud16.trim()) return rec.lud16.trim();
  if (typeof rec.lud06 === 'string' && rec.lud06.trim()) return decodeLnurl(rec.lud06) ?? null;
  return null;
}

function extractLightningAddressFromEvent(event: Event): string | null {
  const lud16Tag = event.tags.find(tag => tag[0] === 'lud16');
  if (lud16Tag && lud16Tag[1]) return lud16Tag[1];

  const lud06Tag = event.tags.find(tag => tag[0] === 'lud06');
  if (lud06Tag && lud06Tag[1]) return decodeLnurl(lud06Tag[1]);

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

export function ZapButton({ event, amountSats = 21, message = 'Zap!' }: ZapButtonProps) {
  const { pubkey, signEvent } = useAuth();
  const [zapState, setZapState] = useState<'idle' | 'pending-lnurl' | 'pending-invoice' | 'waiting-payment' | 'paid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const authorPubkey = event.pubkey;
  const authorNpub = useMemo(() => nip19.npubEncode(authorPubkey), [authorPubkey]);

  const authorLightningAddress = useMemo(() => extractLightningAddressFromEvent(event), [event]);

  const resolveLightningAddress = useCallback(async () => {
    if (authorLightningAddress) return authorLightningAddress;
    const pool = new SimplePool();
    try {
      const meta = await pool.get(RELAYS, { kinds: [0], authors: [authorPubkey] });
      if (!meta?.content) return null;
      return extractLightningAddressFromProfile(JSON.parse(meta.content) as unknown);
    } catch (err) {
      console.warn('Failed to fetch author metadata for lightning address', err);
      return null;
    } finally {
      pool.close(RELAYS);
    }
  }, [authorLightningAddress, authorPubkey]);

  const handleZap = useCallback(async () => {
    if (!pubkey) {
      setErrorMessage('ERROR: You must be logged in to send a zap.');
      setZapState('error');
      return;
    }

    setZapState('pending-lnurl');
    setErrorMessage(null);
    setInvoice(null);

    try {
      const resolvedAddress = await resolveLightningAddress();
      if (!resolvedAddress) {
        setErrorMessage('ERROR: Author does not have a Lightning Address/LNURL.');
        setZapState('error');
        return;
      }

      // 1. Fetch LNURL-pay metadata
      const lnurlp = resolvedAddress.startsWith('lnurl')
        ? resolvedAddress
        : `https://${resolvedAddress.split('@')[1]}/.well-known/lnurlp/${resolvedAddress.split('@')[0]}`;
      const metadata = await getLnurlpMetadata(lnurlp);

      if (metadata.tag !== 'payRequest') {
        throw new Error('LNURL does not support payRequest (NIP-57).');
      }

      // 2. Create a NIP-57 Zap Request Event
      const zapRequestEventTemplate: EventTemplate = {
        kind: 9734, // Zap Request
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relays', ...RELAYS], // Global relays or specific ones
          ['amount', String(amountSats * 1000)], // msat
          ['lnurl', metadata.encoded ? metadata.encoded.toUpperCase() : resolvedAddress], // NIP-57 encoded LNURL
          ['p', authorPubkey],
          ['e', event.id],
          ['content', message],
          ['p', pubkey] // My pubkey as sender
        ],
        content: message,
      };
      
      const signedZapRequest = await signEvent(zapRequestEventTemplate);
      
      // 3. Get invoice from callback URL
      const invoiceData = await getLnurlpInvoice(metadata.callback, amountSats * 1000, metadata.metadata, signedZapRequest);
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
  }, [pubkey, signEvent, resolveLightningAddress, authorPubkey, event, amountSats, message, authorNpub]);

  const handleCloseZap = useCallback(() => {
    setZapState('idle');
    setErrorMessage(null);
    setInvoice(null);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <>
      <button className="action-btn zap-btn" onClick={handleZap} disabled={zapState !== 'idle'}>
        ⚡ ZAP {amountSats}
      </button>

      {zapState !== 'idle' && (
        <div className="zap-modal">
          <div className="zap-modal-content">
            <div className="terminal-header">
              <span className="terminal-dot red"></span>
              <span className="terminal-dot yellow"></span>
              <span className="terminal-dot green"></span>
              <span className="terminal-title">ZAP_INITIATE</span>
            </div>
            <div className="terminal-body">
              {zapState === 'error' && <div className="error-msg">{errorMessage}</div>}
              {zapState === 'pending-lnurl' && <p>STATUS: Resolving LNURL for {authorNpub}...</p>}
              {zapState === 'pending-invoice' && <p>STATUS: Requesting invoice...</p>}
              {zapState === 'paid' && <div className="success-msg">STATUS: PAYMENT SUCCESSFUL!</div>}
              {zapState === 'waiting-payment' && invoice && (
                <div>
                  <p>STATUS: Invoice generated. Scan QR or click to pay:</p>
                  <div className="qr-code">
                    <QRCodeSVG value={invoice} size={256} bgColor="#000" fgColor="#00ff41" level="L" />
                  </div>
                  <p className="invoice-code">{invoice}</p>
                  <div className="form-actions">
                    <button className="auth-btn" onClick={() => window.open(`lightning:${invoice}`, '_blank')}>
                      OPEN_WALLET
                    </button>
                    <button className="text-btn" onClick={handleCloseZap}>CANCEL</button>
                  </div>
                </div>
              )}
              {zapState === 'waiting-payment' && !invoice && (
                 <p>STATUS: Waiting for invoice...</p>
              )}
              {zapState === 'error' && (
                <div className="form-actions">
                  <button className="text-btn" onClick={handleCloseZap}>CLOSE</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

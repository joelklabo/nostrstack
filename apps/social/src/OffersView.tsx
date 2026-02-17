import { OfferWidget, useNostrstackConfig } from '@nostrstack/react';
import { useToast } from '@nostrstack/ui';
import { useMemo, useState } from 'react';

import { resolveGalleryApiBase } from './utils/api-base';

type OfferEntry = {
  id: string;
  description: string;
  createdAt: number;
  amountMsat?: number;
  label?: string;
  issuer?: string;
  expiresIn?: number;
  offer: string;
  offerId?: string;
  invoice?: string;
  invoiceStatus: 'idle' | 'loading' | 'ready' | 'error';
  invoiceError?: string;
  invoiceAmountMsatInput?: string;
  invoiceQuantityInput?: string;
  invoicePayerNote?: string;
};

const numberFormat = new Intl.NumberFormat('en-US');
const OFFER_CREATE_TIMEOUT_MS = 15_000;
const OFFER_CREATE_TIMEOUT_MESSAGE = 'Offer creation timed out. Please try again.';
const MAX_DESCRIPTION_CHARS = 140;

function formatMsat(value?: number) {
  if (!value) return 'Any amount';
  return `${numberFormat.format(value)} msat`;
}

function parseOptionalInt(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function parseOfferErrorMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (typeof parsed.message === 'string') {
        return parsed.message;
      }
      if (typeof parsed.error === 'string') {
        return parsed.error;
      }
    }
  } catch {
    // Not JSON; return raw text below.
  }

  return trimmed;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function OffersView() {
  const cfg = useNostrstackConfig();
  const toast = useToast();
  const apiBaseConfig = resolveGalleryApiBase(cfg);
  const apiBase = apiBaseConfig.baseUrl;
  const bolt12Enabled =
    String(import.meta.env.VITE_ENABLE_BOLT12 ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  const [description, setDescription] = useState('');
  const [amountMsat, setAmountMsat] = useState('');
  const [label, setLabel] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading'>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferEntry[]>([]);

  const baseUrl = useMemo(
    () => (apiBaseConfig.isConfigured ? apiBase : ''),
    [apiBaseConfig.isConfigured, apiBase]
  );

  const updateOffer = (id: string, patch: Partial<OfferEntry>) => {
    setOffers((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const handleCopy = async (value: string, labelText: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ message: `${labelText} copied.`, tone: 'success' });
    } catch {
      toast({ message: `Unable to copy ${labelText}.`, tone: 'danger' });
    }
  };

  const handleCreateOffer = async () => {
    if (!description.trim()) {
      setCreateError('Description is required.');
      setCreateStatus('idle');
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_CHARS) {
      setCreateError(`Description must be ${MAX_DESCRIPTION_CHARS} characters or fewer.`);
      setCreateStatus('idle');
      return;
    }
    if (!apiBaseConfig.isConfigured) {
      setCreateError('API base is not configured.');
      setCreateStatus('idle');
      return;
    }

    setCreateStatus('loading');
    setCreateError(null);

    const payload: Record<string, unknown> = { description: description.trim() };
    const parsedAmount = parseOptionalInt(amountMsat);
    if (parsedAmount) payload.amountMsat = parsedAmount;
    if (label.trim()) payload.label = label.trim();
    if (issuer.trim()) payload.issuer = issuer.trim();
    const parsedExpires = parseOptionalInt(expiresIn);
    if (parsedExpires) payload.expiresIn = parsedExpires;

    const controller = new AbortController();
    const timeoutError = new Error(OFFER_CREATE_TIMEOUT_MESSAGE);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(timeoutError);
      }, OFFER_CREATE_TIMEOUT_MS);
    });
    const withTimeout = <T,>(promise: Promise<T>): Promise<T> => Promise.race([promise, timeout]);

    try {
      const res = await withTimeout(
        fetch(`${baseUrl}/api/bolt12/offers`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        })
      );
      const responseText = await withTimeout(res.text());
      if (!res.ok) {
        const message = parseOfferErrorMessage(responseText) || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const data = JSON.parse(responseText) as { offer: string; offerId?: string; label?: string };
      const entry: OfferEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: description.trim(),
        createdAt: Date.now(),
        amountMsat: parsedAmount,
        label: label.trim() || undefined,
        issuer: issuer.trim() || undefined,
        expiresIn: parsedExpires,
        offer: data.offer,
        offerId: data.offerId,
        invoiceStatus: 'idle'
      };
      setOffers((prev) => [entry, ...prev]);
      setDescription('');
      setAmountMsat('');
      setLabel('');
      setIssuer('');
      setExpiresIn('');
      toast({ message: 'Offer created.', tone: 'success' });
      setCreateStatus('idle');
    } catch (err) {
      const message =
        err === timeoutError
          ? OFFER_CREATE_TIMEOUT_MESSAGE
          : err instanceof DOMException && err.name === 'AbortError'
            ? OFFER_CREATE_TIMEOUT_MESSAGE
            : err instanceof Error
              ? err.message
              : 'Offer creation failed.';
      setCreateError(message);
      setCreateStatus('idle');
      toast({ message, tone: 'danger' });
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      controller.abort();
    }
  };

  const handleRequestInvoice = async (entry: OfferEntry) => {
    if (!apiBaseConfig.isConfigured) {
      toast({ message: 'API base is not configured.', tone: 'danger' });
      return;
    }

    updateOffer(entry.id, { invoiceStatus: 'loading', invoiceError: undefined });
    const payload: Record<string, unknown> = { offer: entry.offer };
    const parsedAmount = parseOptionalInt(entry.invoiceAmountMsatInput);
    if (parsedAmount) payload.amountMsat = parsedAmount;
    const parsedQty = parseOptionalInt(entry.invoiceQuantityInput);
    if (parsedQty) payload.quantity = parsedQty;
    if (entry.invoicePayerNote?.trim()) payload.payerNote = entry.invoicePayerNote.trim();

    try {
      const res = await fetch(`${baseUrl}/api/bolt12/invoices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(bodyText || `HTTP ${res.status}`);
      }
      const data = JSON.parse(bodyText) as { invoice: string };
      updateOffer(entry.id, { invoice: data.invoice, invoiceStatus: 'ready' });
      toast({ message: 'Invoice ready.', tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invoice request failed.';
      updateOffer(entry.id, { invoiceStatus: 'error', invoiceError: message });
    }
  };

  if (!bolt12Enabled) {
    return (
      <div className="offers-view">
        <div className="offer-empty">
          <h3>BOLT12 offers are disabled</h3>
          <p>Enable VITE_ENABLE_BOLT12 to access offers and subscriptions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="offers-view">
      <div className="offers-header">
        <div>
          <div className="offers-title">BOLT12 Offers</div>
          <div className="offers-subtitle">Create offers, copy QR codes, and request invoices.</div>
        </div>
        <div className="offers-status">
          {apiBaseConfig.isConfigured ? 'API ready' : 'API base missing'}
        </div>
      </div>

      <section className="offer-create-card" aria-labelledby="create-offer-title">
        <div className="offer-card-header">
          <div>
            <div id="create-offer-title" className="offer-card-title">
              Create a new offer
            </div>
            <div className="offer-card-meta">
              <span>{formatMsat(parseOptionalInt(amountMsat))}</span>
              {expiresIn.trim() && <span>Expires in {expiresIn.trim()}s</span>}
            </div>
          </div>
          <span className={`offer-pill ${createStatus === 'loading' ? 'busy' : ''}`}>
            {createStatus === 'loading' ? 'CREATING' : 'READY'}
          </span>
        </div>

        <div className="offer-form">
          <label className="offer-field">
            <span>Description</span>
            <input
              className="offer-input"
              name="offer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Monthly update newsletter"
            />
            <span
              className={`offer-field-meta ${
                description.length > MAX_DESCRIPTION_CHARS
                  ? 'error'
                  : description.length > MAX_DESCRIPTION_CHARS - 20
                    ? 'warning'
                    : ''
              }`}
            >
              {description.length}/{MAX_DESCRIPTION_CHARS}
            </span>
          </label>
          <label className="offer-field">
            <span>Amount (msat)</span>
            <input
              className="offer-input"
              name="offer-amount-msat"
              value={amountMsat}
              onChange={(e) => setAmountMsat(e.target.value)}
              placeholder="Leave blank for variable amount"
            />
          </label>
          <label className="offer-field">
            <span>Label</span>
            <input
              className="offer-input"
              name="offer-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="subscription-tier-1"
            />
          </label>
          <label className="offer-field">
            <span>Issuer</span>
            <input
              className="offer-input"
              name="offer-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="nostrstack.io"
            />
          </label>
          <label className="offer-field">
            <span>Expires in (seconds)</span>
            <input
              className="offer-input"
              name="offer-expires"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="3600"
            />
          </label>
        </div>

        <div className="offer-actions" role="group" aria-label="Offer creation actions">
          <button
            type="button"
            className="offer-primary-btn"
            onClick={handleCreateOffer}
            disabled={createStatus === 'loading'}
            aria-busy={createStatus === 'loading'}
            aria-label={
              createStatus === 'loading' ? 'Creating BOLT12 offer' : 'Create new BOLT12 offer'
            }
          >
            {createStatus === 'loading' ? 'Creating...' : 'Create Offer'}
          </button>
          {createError && (
            <div className="offer-error" role="alert" aria-live="assertive">
              {createError}
            </div>
          )}
        </div>
      </section>

      <section className="offer-list" aria-label="Created offers">
        {offers.length === 0 && (
          <div className="offer-empty">
            <h3>No offers yet</h3>
            <p>Create an offer above to generate the QR and start accepting subscriptions.</p>
          </div>
        )}

        {offers.map((entry) => (
          <article className="offer-card" key={entry.id}>
            <div className="offer-card-header">
              <div>
                <div className="offer-card-title">{entry.description}</div>
                <div className="offer-card-meta">
                  <span className="offer-tag">{formatMsat(entry.amountMsat)}</span>
                  {entry.label && <span className="offer-tag">{entry.label}</span>}
                  {entry.issuer && <span className="offer-tag">{entry.issuer}</span>}
                  {entry.offerId && (
                    <span className="offer-tag">ID {entry.offerId.slice(0, 8)}</span>
                  )}
                </div>
              </div>
              <div className="offer-card-time">Created {formatTime(entry.createdAt)}</div>
            </div>

            <div className="offer-grid">
              <OfferWidget
                title="Offer"
                subtitle="Scan or copy to share"
                value={entry.offer}
                status={entry.amountMsat ? 'FIXED' : 'FLEX'}
                onCopy={() => handleCopy(entry.offer, 'Offer')}
              />

              <div className="offer-invoice-column">
                {entry.invoice ? (
                  <OfferWidget
                    title="Invoice"
                    subtitle="Pay once or paste into wallet"
                    value={entry.invoice}
                    status="READY"
                    onCopy={() => handleCopy(entry.invoice ?? '', 'Invoice')}
                  />
                ) : (
                  <div className="offer-invoice-placeholder">
                    <div className="offer-invoice-title">Invoice</div>
                    <p>
                      Request an invoice for this offer. Use amount & quantity for subscriptions.
                    </p>
                  </div>
                )}

                <div className="offer-invoice-controls">
                  <div className="offer-form compact">
                    <label className="offer-field">
                      <span>Amount (msat)</span>
                      <input
                        className="offer-input"
                        name={`invoice-amount-msat-${entry.id}`}
                        value={entry.invoiceAmountMsatInput ?? ''}
                        onChange={(e) =>
                          updateOffer(entry.id, { invoiceAmountMsatInput: e.target.value })
                        }
                        placeholder={entry.amountMsat ? String(entry.amountMsat) : 'Optional'}
                      />
                    </label>
                    <label className="offer-field">
                      <span>Quantity</span>
                      <input
                        className="offer-input"
                        name={`invoice-quantity-${entry.id}`}
                        value={entry.invoiceQuantityInput ?? ''}
                        onChange={(e) =>
                          updateOffer(entry.id, { invoiceQuantityInput: e.target.value })
                        }
                        placeholder="1"
                      />
                    </label>
                    <label className="offer-field span-2">
                      <span>Payer note</span>
                      <input
                        className="offer-input"
                        name={`invoice-payer-note-${entry.id}`}
                        value={entry.invoicePayerNote ?? ''}
                        onChange={(e) =>
                          updateOffer(entry.id, { invoicePayerNote: e.target.value })
                        }
                        placeholder="Optional note for the invoice"
                      />
                    </label>
                  </div>
                  <div className="offer-actions" role="group" aria-label="Invoice request actions">
                    <button
                      type="button"
                      className="offer-secondary-btn"
                      onClick={() => handleRequestInvoice(entry)}
                      disabled={entry.invoiceStatus === 'loading'}
                      aria-busy={entry.invoiceStatus === 'loading'}
                      aria-label={
                        entry.invoiceStatus === 'loading'
                          ? `Requesting invoice for ${entry.description}`
                          : `Request invoice for ${entry.description}`
                      }
                    >
                      {entry.invoiceStatus === 'loading' ? 'Requesting...' : 'Request Invoice'}
                    </button>
                    {entry.invoiceStatus === 'error' && entry.invoiceError && (
                      <div className="offer-error" role="alert" aria-live="assertive">
                        {entry.invoiceError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

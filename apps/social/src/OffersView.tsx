import { OfferWidget, useNostrstackConfig } from '@nostrstack/react';
import { useToast } from '@nostrstack/ui';
import { type FormEvent, useMemo, useState } from 'react';

import { copyToClipboard } from './ui/clipboard';
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
const MAX_LABEL_CHARS = 64;
const MAX_ISSUER_CHARS = 64;

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

function pickMessageFromErrorPayload(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = pickMessageFromErrorPayload(entry);
      if (extracted) {
        return extracted;
      }
      if (entry && typeof entry === 'object' && 'message' in entry) {
        const nested = pickMessageFromErrorPayload((entry as { message?: unknown }).message);
        if (nested) {
          return nested;
        }
      }
    }
  }

  if (value && typeof value === 'object' && 'message' in value) {
    const nested = pickMessageFromErrorPayload((value as { message?: unknown }).message);
    return nested ?? undefined;
  }

  return undefined;
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
      const message = pickMessageFromErrorPayload(parsed.message);
      if (message) {
        return message;
      }
      const errorCode = pickMessageFromErrorPayload(parsed.error);
      if (errorCode) {
        return errorCode;
      }
      if (Array.isArray(parsed.details)) {
        const detailMessage = pickMessageFromErrorPayload(parsed.details);
        if (detailMessage) {
          return detailMessage;
        }
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

type CreateOfferResponse = {
  offer: string;
  offerId?: string;
  label?: string;
};

function parseCreateOfferResponse(text: string): CreateOfferResponse {
  if (!text.trim()) {
    throw new Error('Offer creation response was empty.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Offer creation response was not valid JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Offer creation response shape is invalid.');
  }
  const asRecord = raw as Record<string, unknown>;
  const offer = typeof asRecord.offer === 'string' ? asRecord.offer.trim() : '';
  if (!offer) {
    throw new Error('Offer creation response missing offer value.');
  }

  const offerId =
    typeof asRecord.offerId === 'string' && asRecord.offerId.trim()
      ? asRecord.offerId.trim()
      : undefined;
  const normalizedLabel =
    typeof asRecord.label === 'string' && asRecord.label.trim() ? asRecord.label.trim() : undefined;

  return { offer, offerId, label: normalizedLabel };
}

async function withRequestTimeout<T>(
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request(controller.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && controller.signal.aborted) {
      throw new Error(OFFER_CREATE_TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
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
      await copyToClipboard(value);
      toast({ message: `${labelText} copied.`, tone: 'success' });
    } catch {
      toast({ message: `Unable to copy ${labelText}.`, tone: 'danger' });
    }
  };

  const handleCreateOffer = async () => {
    const failCreate = (message: string) => {
      setCreateError(message);
      setCreateSuccess(null);
      setCreateStatus('error');
      toast({ message, tone: 'danger' });
    };

    if (!description.trim()) {
      failCreate('Description is required.');
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_CHARS) {
      failCreate(`Description must be ${MAX_DESCRIPTION_CHARS} characters or fewer.`);
      return;
    }
    if (label.trim().length > MAX_LABEL_CHARS) {
      failCreate(`Label must be ${MAX_LABEL_CHARS} characters or fewer.`);
      return;
    }
    if (issuer.trim().length > MAX_ISSUER_CHARS) {
      failCreate(`Issuer must be ${MAX_ISSUER_CHARS} characters or fewer.`);
      return;
    }
    if (!apiBaseConfig.isConfigured) {
      failCreate('API base is not configured.');
      return;
    }

    setCreateStatus('loading');
    setCreateError(null);
    setCreateSuccess(null);

    const payload: Record<string, unknown> = { description: description.trim() };
    const parsedAmount = parseOptionalInt(amountMsat);
    if (parsedAmount) payload.amountMsat = parsedAmount;
    if (label.trim()) payload.label = label.trim();
    if (issuer.trim()) payload.issuer = issuer.trim();
    const parsedExpires = parseOptionalInt(expiresIn);
    if (parsedExpires) payload.expiresIn = parsedExpires;

    try {
      const { res, responseText } = await withRequestTimeout(
        OFFER_CREATE_TIMEOUT_MS,
        async (signal) => {
          const response = await fetch(`${baseUrl}/api/bolt12/offers`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal
          });
          return {
            res: response,
            responseText: await response.text()
          };
        }
      );
      if (!res.ok) {
        const message = parseOfferErrorMessage(responseText) || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const data = parseCreateOfferResponse(responseText);
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
      setCreateSuccess('Offer created.');
      toast({ message: 'Offer created.', tone: 'success' });
      setCreateStatus('success');
    } catch (err) {
      const message =
        err instanceof Error && err.message === OFFER_CREATE_TIMEOUT_MESSAGE
          ? OFFER_CREATE_TIMEOUT_MESSAGE
          : err instanceof DOMException && err.name === 'AbortError'
            ? OFFER_CREATE_TIMEOUT_MESSAGE
            : err instanceof Error
              ? err.message
              : 'Offer creation failed.';
      failCreate(message);
    }
  };

  const handleCreateOfferSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleCreateOffer();
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
        const message = parseOfferErrorMessage(bodyText) || `HTTP ${res.status}`;
        throw new Error(message);
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
            {createStatus === 'loading'
              ? 'CREATING'
              : createStatus === 'error'
                ? 'ERROR'
                : createStatus === 'success'
                  ? 'CREATED'
                  : 'READY'}
          </span>
        </div>

        <form onSubmit={handleCreateOfferSubmit}>
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
              <span
                className={`offer-field-meta ${
                  label.length > MAX_LABEL_CHARS
                    ? 'error'
                    : label.length > MAX_LABEL_CHARS - 10
                      ? 'warning'
                      : ''
                }`}
              >
                {label.length}/{MAX_LABEL_CHARS}
              </span>
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
              <span
                className={`offer-field-meta ${
                  issuer.length > MAX_ISSUER_CHARS
                    ? 'error'
                    : issuer.length > MAX_ISSUER_CHARS - 10
                      ? 'warning'
                      : ''
                }`}
              >
                {issuer.length}/{MAX_ISSUER_CHARS}
              </span>
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
              type="submit"
              className="offer-primary-btn"
              disabled={createStatus === 'loading'}
              aria-busy={createStatus === 'loading'}
              aria-label={
                createStatus === 'loading' ? 'Creating BOLT12 offer' : 'Create new BOLT12 offer'
              }
            >
              {createStatus === 'loading' ? 'Creating...' : 'Create Offer'}
            </button>
          </div>
        </form>
        <div className="offer-actions" role="group" aria-label="Offer creation actions">
          {createStatus === 'loading' && (
            <div className="offer-pending ns-alert ns-alert--info" role="status" aria-live="polite">
              Creating BOLT12 offer...
            </div>
          )}
          {createError && (
            <div
              className="offer-error ns-alert ns-alert--danger"
              role="alert"
              aria-live="assertive"
            >
              {createError}
            </div>
          )}
          {createSuccess && (
            <div
              className="offer-success ns-alert ns-alert--success"
              role="status"
              aria-live="polite"
            >
              {createSuccess}
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

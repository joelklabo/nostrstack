import { OfferWidget, useNostrstackConfig } from '@nostrstack/blog-kit';
import { useMemo, useState } from 'react';

import { useToast } from './ui/toast';
import { resolveApiBase } from './utils/api-base';

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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function OffersView() {
  const cfg = useNostrstackConfig();
  const toast = useToast();
  const apiBaseRaw = cfg.apiBase ?? cfg.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const apiBaseConfig = cfg.apiBaseConfig ?? resolveApiBase(apiBaseRaw);
  const apiBase = apiBaseConfig.baseUrl;
  const bolt12Enabled =
    String(import.meta.env.VITE_ENABLE_BOLT12 ?? '').toLowerCase() === 'true' || import.meta.env.DEV;

  const [description, setDescription] = useState('');
  const [amountMsat, setAmountMsat] = useState('');
  const [label, setLabel] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferEntry[]>([]);

  const baseUrl = useMemo(() => (apiBaseConfig.isConfigured ? apiBase : ''), [apiBaseConfig.isConfigured, apiBase]);

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
      setCreateStatus('error');
      return;
    }
    if (!apiBaseConfig.isConfigured) {
      setCreateError('API base is not configured.');
      setCreateStatus('error');
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

    try {
      const res = await fetch(`${baseUrl}/api/bolt12/offers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(bodyText || `HTTP ${res.status}`);
      }
      const data = JSON.parse(bodyText) as { offer: string; offerId?: string; label?: string };
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
      const message = err instanceof Error ? err.message : 'Offer creation failed.';
      setCreateError(message);
      setCreateStatus('error');
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

      <section className="offer-create-card">
        <div className="offer-card-header">
          <div>
            <div className="offer-card-title">Create a new offer</div>
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

        <div className="offer-actions">
          <button
            type="button"
            className="offer-primary-btn"
            onClick={handleCreateOffer}
            disabled={createStatus === 'loading'}
          >
            {createStatus === 'loading' ? 'CREATING…' : 'CREATE_OFFER'}
          </button>
          {createError && <div className="offer-error">{createError}</div>}
        </div>
      </section>

      <section className="offer-list">
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
                  {entry.offerId && <span className="offer-tag">ID {entry.offerId.slice(0, 8)}</span>}
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
                    <p>Request an invoice for this offer. Use amount & quantity for subscriptions.</p>
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
                  <div className="offer-actions">
                    <button
                      type="button"
                      className="offer-secondary-btn"
                      onClick={() => handleRequestInvoice(entry)}
                      disabled={entry.invoiceStatus === 'loading'}
                    >
                      {entry.invoiceStatus === 'loading' ? 'REQUESTING…' : 'REQUEST_INVOICE'}
                    </button>
                    {entry.invoiceStatus === 'error' && entry.invoiceError && (
                      <div className="offer-error">{entry.invoiceError}</div>
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

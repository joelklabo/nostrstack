import './ZapModal.css';

import { QRCodeSVG } from 'qrcode.react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

interface ZapModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName?: string;
  recipientPubkey?: string;
  lnurl?: string;
  onZap: (amount: number, message: string) => Promise<string>;
}

type ZapState = 'idle' | 'resolving' | 'ready' | 'paid' | 'error';

export const ZapModal: React.FC<ZapModalProps> = ({
  isOpen,
  onClose,
  recipientName = 'User',
  onZap
}) => {
  const [amount, setAmount] = useState<number>(50);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<ZapState>('idle');
  const [invoice, setInvoice] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const PRESETS = [21, 50, 100, 500, 1000, 5000];

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setState('idle');
      setInvoice('');
      setMessage('');
      setError('');
      setCopyStatus('idle');
    }
  }, [isOpen]);

  // Store trigger element and focus first focusable element
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before modal opened
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
    }

    // Return focus to trigger when modal closes
    return () => {
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleZap = async () => {
    try {
      setState('resolving');
      setError('');
      const pr = await onZap(amount, message);
      setInvoice(pr);
      setState('ready');
      // In a real app, here we would start polling for payment success
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Failed to generate invoice');
      }
      setState('error');
    }
  };

  const copyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      // Clipboard write failed, do nothing
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="zap-modal-overlay"
      role="button"
      tabIndex={0}
      aria-label="Close zap dialog"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="zap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <p id={descriptionId} className="sr-only">
          Send a Lightning payment to {recipientName}. Choose an amount and generate an invoice.
        </p>
        {/* Header */}
        <div className="zap-header">
          <h2 id={titleId}>Zap {recipientName}</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close zap dialog"
          >
            &times;
          </button>
        </div>

        <div className="zap-content-grid">
          {/* Left Column: Controls */}
          <div className="zap-controls">
            <div className="amount-presets">
              {PRESETS.map((val) => (
                <button
                  type="button"
                  key={val}
                  className={`preset-btn ${amount === val ? 'active' : ''}`}
                  onClick={() => setAmount(val)}
                  aria-pressed={amount === val}
                  aria-label={`Select ${val} sats`}
                >
                  ⚡ {val}
                </button>
              ))}
            </div>

            <div className="input-group">
              <label htmlFor="zap-amount">Custom Amount (sats)</label>
              <input
                id="zap-amount"
                name="zap-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="1"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>

            <div className="input-group">
              <label htmlFor="zap-message">Message (optional)</label>
              <input
                id="zap-message"
                name="zap-message"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Great post!"
                autoComplete="off"
              />
            </div>

            {state === 'error' && (
              <div className="error-msg" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="zap-confirm-btn"
              disabled={state === 'resolving' || state === 'paid'}
              onClick={handleZap}
              aria-busy={state === 'resolving'}
            >
              {state === 'resolving' ? 'Generating...' : 'Zap Now ⚡'}
            </button>
          </div>

          {/* Right Column: Invoice / QR */}
          <div className="zap-qr-panel">
            {state === 'idle' || state === 'resolving' || state === 'error' ? (
              <div className="qr-placeholder" role="status" aria-live="polite">
                <span className="lightning-icon" aria-hidden="true">
                  ⚡
                </span>
                <p>Select amount to generate invoice</p>
              </div>
            ) : state === 'ready' ? (
              <div className="qr-container">
                <div className="qr-code-wrapper" style={{ width: 200, height: 200 }}>
                  <QRCodeSVG
                    value={invoice}
                    size={200}
                    level="L"
                    includeMargin
                    role="img"
                    aria-label="Lightning invoice QR code"
                  />
                </div>
                <div className="invoice-actions">
                  <button
                    type="button"
                    onClick={copyInvoice}
                    className={copyStatus === 'copied' ? 'copy-success' : ''}
                    aria-label={
                      copyStatus === 'copied' ? 'Invoice copied' : 'Copy invoice to clipboard'
                    }
                  >
                    {copyStatus === 'copied' ? (
                      <>
                        <span aria-hidden="true">✓</span> Copied!
                      </>
                    ) : (
                      'Copy Invoice'
                    )}
                  </button>
                  <a href={`lightning:${invoice}`} className="open-wallet-btn">
                    Open Wallet
                  </a>
                </div>
              </div>
            ) : state === 'paid' ? (
              <div className="success-state" role="status" aria-live="polite">
                <span className="check-icon" aria-hidden="true">
                  ✅
                </span>
                <p>Payment Received!</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

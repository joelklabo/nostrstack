import '../styles/components/support-card.css';

import { SendSats } from '@nostrstack/react';
import { useEffect, useRef, useState } from 'react';

import { supportConfig } from '../config/payments';

export function SupportCard() {
  const [dismissed, setDismissed] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const supportModalRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!showSupport) return;

    const dialog = supportModalRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      setShowSupport(false);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        setShowSupport(false);
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [showSupport]);

  const isDev = import.meta.env.DEV;

  if (dismissed || (!supportConfig.enabled && !isDev)) {
    return null;
  }

  if (isDev && !supportConfig.enabled) {
    const handleCopyEnv = async () => {
      const text = `# Add to your .env to enable SupportCard
VITE_NOSTRSTACK_TIP_PUBKEY=your-npub-here
VITE_NOSTRSTACK_TIP_LNADDR=your@lightning.address`;
      await navigator.clipboard.writeText(text);
    };
    return (
      <section className="support-card support-card--dev" aria-label="Support Nostrstack">
        <div className="support-card__content">
          <div className="support-card__icon" aria-hidden="true">
            ⚡
          </div>
          <div className="support-card__title">Support Nostrstack</div>
          <div className="support-card__subtitle">
            Set VITE_NOSTRSTACK_TIP_PUBKEY or VITE_NOSTRSTACK_TIP_LNADDR in .env to enable tips
          </div>
        </div>
        <div className="support-card__actions">
          <button
            className="support-card__action ns-btn ns-btn--ghost"
            type="button"
            onClick={handleCopyEnv}
            aria-label="Copy env template to clipboard"
          >
            Copy env template
          </button>
        </div>
      </section>
    );
  }

  const regtestFundEnabled =
    String(import.meta.env.VITE_ENABLE_REGTEST_FUND ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  if (showSupport) {
    return (
      <dialog open className="support-card-modal" aria-modal="true" ref={supportModalRef}>
        <div className="support-card-modal-inner">
          <h3>Support Nostrstack</h3>
          <p>Help keep Nostrstack running!</p>
          <SendSats
            pubkey={supportConfig.tipPubkey || ''}
            lightningAddress={supportConfig.tipLnaddr || undefined}
            defaultAmountSats={500}
            presetAmountsSats={[100, 500, 1000, 5000]}
            notePlaceholder="Say thanks (optional)"
            enableRegtestPay={regtestFundEnabled}
          />
          <button
            type="button"
            className="support-card-modal-close ns-btn ns-btn--ghost"
            onClick={() => setShowSupport(false)}
          >
            Close
          </button>
        </div>
      </dialog>
    );
  }

  return (
    <section className="support-card" aria-label="Support Nostrstack">
      <div className="support-card__content">
        <div className="support-card__icon" aria-hidden="true">
          ⚡
        </div>
        <div className="support-card__title">Support Nostrstack</div>
        <div className="support-card__subtitle">
          Help keep Nostrstack running! Your support helps cover hosting costs.
        </div>
      </div>
      <div className="support-card__actions">
        <button
          className="support-card__action ns-btn ns-btn--primary"
          type="button"
          onClick={() => setShowSupport(true)}
          aria-label="Support Nostrstack with a zap"
        >
          Send sats
        </button>
        <button
          className="support-card__dismiss"
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </section>
  );
}

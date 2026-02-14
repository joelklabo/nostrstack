import '../styles/support-card.css';

import { SendSats } from '@nostrstack/react';
import { useState } from 'react';

import { supportConfig } from '../config/payments';

export function SupportCard() {
  const [dismissed, setDismissed] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const isDev = import.meta.env.DEV;

  if (dismissed || (!supportConfig.enabled && !isDev)) {
    return null;
  }

  if (isDev && !supportConfig.enabled) {
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
      </section>
    );
  }

  const regtestFundEnabled =
    String(import.meta.env.VITE_ENABLE_REGTEST_FUND ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  if (showSupport) {
    return (
      <dialog open className="support-card-modal">
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

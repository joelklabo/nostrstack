import { renderPayToAction } from '@nostrstack/embed';
import { useCallback, useState } from 'react';

interface PaywalledContentProps {
  itemId: string;
  amountSats: number;
  unlockedContent: React.ReactNode;
  lockedContent: React.ReactNode;
  apiBase?: string;
  host?: string;
}

export function PaywalledContent({ 
  // itemId, // Unused, removed
  amountSats, 
  unlockedContent, 
  lockedContent, 
  apiBase, 
  host 
}: PaywalledContentProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const handleUnlock = useCallback(() => {
    setIsUnlocked(true);
    setShowPayment(false);
  }, []);

  const mountPayWidget = useCallback((node: HTMLDivElement | null) => {
    if (!node || isUnlocked) return;

    // The embed's renderPayToAction expects a DOM element to render into.
    // It's a vanilla JS component, so we integrate it imperatively.
    const widget = renderPayToAction(node, {
      username: 'paywall-system', // A generic username for the payment action
      amountMsat: amountSats * 1000,
      baseURL: apiBase,
      host: host,
      onUnlock: handleUnlock,
      // You could add onInvoice to display the invoice somewhere else
      // or verifyPayment if you wanted to poll a local endpoint.
    });

    return () => {
      widget.destroy();
    };
  }, [amountSats, apiBase, host, handleUnlock, isUnlocked]);

  if (isUnlocked) {
    return <>{unlockedContent}</>;
  }

  return (
    <div className="paywall-container">
      <div className="paywall-locked-content">
        {lockedContent}
      </div>
      <div className="paywall-overlay">
        <button className="auth-btn" onClick={() => setShowPayment(true)}>
          UNLOCK_CONTENT ({amountSats} SATS)
        </button>
        {showPayment && (
          <div className="paywall-payment-modal">
            <div className="paywall-payment-modal-content">
              <div className="terminal-header">
                <span className="terminal-dot red"></span>
                <span className="terminal-dot yellow"></span>
                <span className="terminal-dot green"></span>
                <span className="terminal-title">PAYWALL_ACCESS</span>
              </div>
              <div className="terminal-body">
                <p>PAY {amountSats} SATS TO ACCESS CONTENT:</p>
                <div ref={mountPayWidget} className="paywall-widget-host">
                  {/* The embed widget will render here */}
                </div>
                <div className="form-actions">
                  <button className="text-btn" onClick={() => setShowPayment(false)}>CANCEL</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

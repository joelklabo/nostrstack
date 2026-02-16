import { memo } from 'react';

import { useTopZaps } from '../hooks/useTopZaps';
import { ProfileLink } from './ProfileLink';

interface TopZapsProps {
  eventId: string;
  /** Only show if there are zaps */
  hideEmpty?: boolean;
}

/**
 * Displays the top zappers for an event with their amounts.
 * Inspired by Primal's zap display at the bottom of posts.
 */
export const TopZaps = memo(function TopZaps({ eventId, hideEmpty = true }: TopZapsProps) {
  const { zaps, totalAmountSats, loading } = useTopZaps({
    eventId,
    limit: 3,
    enabled: true
  });

  // Show loading state briefly while top zaps are being fetched
  if (loading && zaps.length === 0) {
    return (
      <div className="top-zaps top-zaps--loading" role="status" aria-label="Loading top zap data">
        <span className="top-zaps__skeleton" aria-hidden="true" />
      </div>
    );
  }

  if (hideEmpty && zaps.length === 0) {
    return <div className="top-zaps top-zaps--empty" aria-hidden="true" role="presentation" />;
  }

  if (zaps.length === 0) {
    return <div className="top-zaps top-zaps--empty" aria-hidden="true" />;
  }

  // Format amount for display
  const formatAmount = (sats: number): string => {
    if (sats >= 1_000_000) {
      return `${(sats / 1_000_000).toFixed(1)}M`;
    }
    if (sats >= 1_000) {
      return `${(sats / 1_000).toFixed(1)}k`;
    }
    return sats.toLocaleString();
  };

  return (
    <div
      className="top-zaps"
      role="region"
      aria-label={`${zaps.length} zaps totaling ${totalAmountSats} sats`}
    >
      <div className="top-zaps__icon" aria-hidden="true">
        ⚡
      </div>
      <div className="top-zaps__zappers">
        {zaps.map((zap, index) => (
          <div key={zap.event.id} className="top-zaps__zapper" title={zap.message || undefined}>
            <ProfileLink
              pubkey={zap.senderPubkey}
              showAvatar
              avatarOnly
              avatarSize="xs"
              className="top-zaps__avatar"
            />
            {index === 0 && zap.message && (
              <span className="top-zaps__message">{zap.message.slice(0, 30)}</span>
            )}
          </div>
        ))}
      </div>
      <div className="top-zaps__total">
        <span className="top-zaps__amount">{formatAmount(totalAmountSats)}</span>
        <span className="top-zaps__unit">sats</span>
      </div>
    </div>
  );
});

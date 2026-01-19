import { SendSats, useAuth, useFeed, useNostrQuery, useProfile } from '@nostrstack/react';
import { Alert, PostSkeleton, Skeleton } from '@nostrstack/ui';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { paymentConfig } from './config/payments';
import { useContactList } from './hooks/useContactList';
import { useMuteList } from './hooks/useMuteList';
import { useRelays } from './hooks/useRelays';
import { Image } from './ui/Image';
import { NostrEventCard } from './ui/NostrEventCard';

const FALLBACK_AVATAR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' rx='60' fill='#21292e'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='48' fill='#ffffff'>N</text></svg>";
const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(FALLBACK_AVATAR_SVG)}`;

interface ProfileMetadata {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
}

interface ProfileViewProps {
  pubkey: string;
  onNavigateToSettings?: () => void;
}

export function ProfileView({ pubkey, onNavigateToSettings }: ProfileViewProps) {
  const { relays: relayList, isLoading: relaysLoading } = useRelays();
  // const [retryCount, setRetryCount] = useState(0);
  const [lightningQr, setLightningQr] = useState<string | null>(null);
  const [lightningCopyStatus, setLightningCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );

  const { isFollowing, follow, unfollow, loading: contactsLoading } = useContactList();
  const { isMuted, mute, unmute, loading: muteLoading } = useMuteList();
  const { pubkey: myPubkey } = useAuth();
  const isMe = myPubkey === pubkey;
  const following = isFollowing(pubkey);
  const muted = isMuted(pubkey);

  const handleFollowToggle = async () => {
    try {
      if (following) {
        await unfollow(pubkey);
      } else {
        await follow(pubkey);
      }
    } catch (err) {
      console.error('Failed to toggle follow', err);
    }
  };

  const handleMuteToggle = async () => {
    try {
      if (muted) {
        await unmute(pubkey);
      } else {
        await mute(pubkey);
      }
    } catch (err) {
      console.error('Failed to toggle mute', err);
    }
  };

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;

  // 1. Fetch Profile Metadata
  const {
    profile: profileEvent,
    loading: profileLoading,
    error: profileError
  } = useProfile(pubkey, {
    relays: relayList,
    enabled: !relaysLoading
  });

  const profile = useMemo<ProfileMetadata | null>(() => {
    if (!profileEvent) return null;
    try {
      return JSON.parse(profileEvent.content) as ProfileMetadata;
    } catch (e) {
      console.error('Failed to parse profile metadata', e);
      return null;
    }
  }, [profileEvent]);

  // 2. Fetch User Events
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    hasMore,
    loadMore
  } = useFeed({
    authors: [pubkey],
    kinds: [1],
    limit: 20,
    relays: relayList,
    enabled: !relaysLoading
  });

  // 3. Fetch Following Count (Kind 3)
  const { events: contactEvents } = useNostrQuery([{ kinds: [3], authors: [pubkey], limit: 1 }], {
    relays: relayList,
    enabled: !relaysLoading,
    limit: 1
  });

  const followingCount = useMemo(() => {
    if (contactEvents.length === 0) return null;
    return contactEvents[0].tags.filter((t) => t[0] === 'p').length;
  }, [contactEvents]);

  const npub = useMemo(() => nip19.npubEncode(pubkey), [pubkey]);
  const lightningAddress = profile?.lud16 ?? profile?.lud06;
  const lightningLabel = profile?.lud16 ? 'LIGHTNING_ADDRESS' : 'LNURL';
  const lightningUri = useMemo(() => {
    if (!lightningAddress) return null;
    const trimmed = lightningAddress.trim();
    if (!trimmed) return null;
    return `lightning:${trimmed}`;
  }, [lightningAddress]);

  useEffect(() => {
    if (!lightningUri) {
      setLightningQr(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(lightningUri, { width: 160, margin: 1 })
      .then((url) => {
        if (active) setLightningQr(url);
      })
      .catch(() => {
        if (active) setLightningQr(null);
      });
    return () => {
      active = false;
    };
  }, [lightningUri]);

  const handleCopyLightning = useCallback(async () => {
    if (!lightningAddress) return;
    try {
      await navigator.clipboard.writeText(lightningAddress);
      setLightningCopyStatus('copied');
    } catch {
      setLightningCopyStatus('error');
    }
    window.setTimeout(() => setLightningCopyStatus('idle'), 1500);
  }, [lightningAddress]);

  const handleOpenWallet = useCallback(() => {
    if (!lightningUri) return;
    window.open(lightningUri, '_blank');
  }, [lightningUri]);

  const showLightningAddress = Boolean(lightningAddress);
  const showSendSats = paymentConfig.enableProfilePay && showLightningAddress;
  const showLightningCallout = !profileLoading && !showLightningAddress;
  const tipAmount = paymentConfig.defaultSendSats ?? 500;
  const lightningBadgeLabel = showLightningAddress ? 'Lightning ready' : 'Lightning missing';
  const error = profileError || eventsError;

  return (
    <div className="profile-view">
      {error && (
        <Alert tone="danger" title="Profile Error">
          {error}
        </Alert>
      )}
      {profileLoading ? (
        <div style={{ padding: '0' }}>
          <div className="profile-header">
            <Skeleton
              variant="circular"
              width={120}
              height={120}
              className="profile-picture"
              style={{ border: 'none' }}
            />
            <div className="profile-info" style={{ width: '100%', maxWidth: '600px' }}>
              <div className="profile-title-row">
                <Skeleton variant="text" width={200} height={32} />
              </div>
              <Skeleton variant="text" width={300} height={20} style={{ marginTop: '0.5rem' }} />
              <div
                style={{
                  marginTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="60%" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="profile-header">
            <Image
              src={profile?.picture || FALLBACK_AVATAR}
              alt={`${profile?.display_name || profile?.name || 'User'}'s profile picture`}
              className="profile-picture"
              fallback={FALLBACK_AVATAR}
            />
            <div className="profile-info">
              <div className="profile-title-row">
                <h2 className="profile-name">
                  {profile?.display_name || profile?.name || 'UNKNOWN_USER'}
                </h2>
                <div className="profile-badges">
                  {profile?.nip05 && (
                    <span className="profile-badge profile-badge--verified">NIP-05 verified</span>
                  )}
                  <span
                    className={`profile-badge ${
                      showLightningAddress ? 'profile-badge--success' : 'profile-badge--muted'
                    }`}
                  >
                    {showLightningAddress ? '[OK] ' : '[--] '}
                    {lightningBadgeLabel}
                  </span>
                  {followingCount != null && (
                    <span className="profile-badge profile-badge--muted">
                      Following: {followingCount}
                    </span>
                  )}
                </div>
              </div>
              <code className="profile-pubkey">{npub}</code>
              {profile?.nip05 && <p className="profile-nip05">NIP-05: {profile.nip05}</p>}
              {profile?.about && <p className="profile-about">{profile.about}</p>}
              {profile?.website && (
                <p className="profile-website">
                  Web:{' '}
                  <a href={profile.website} target="_blank" rel="noopener noreferrer">
                    {profile.website}
                  </a>
                </p>
              )}
              {isMe && onNavigateToSettings && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    width: '100%',
                    marginTop: '1rem'
                  }}
                >
                  <button
                    className="action-btn"
                    style={{
                      borderColor: 'var(--ns-color-accent-default)',
                      color: 'var(--ns-color-accent-default)'
                    }}
                    onClick={onNavigateToSettings}
                    aria-label="Edit your profile"
                  >
                    [✎] EDIT PROFILE
                  </button>
                </div>
              )}
              {!isMe && myPubkey && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    width: '100%',
                    marginTop: '1rem'
                  }}
                  role="group"
                  aria-label="Profile actions"
                >
                  <button
                    className="action-btn"
                    style={{
                      borderColor: following
                        ? 'var(--ns-color-danger-default)'
                        : 'var(--ns-color-accent-default)',
                      color: following
                        ? 'var(--ns-color-danger-default)'
                        : 'var(--ns-color-accent-default)'
                    }}
                    onClick={handleFollowToggle}
                    disabled={contactsLoading}
                    aria-pressed={following}
                    aria-label={following ? 'Unfollow this user' : 'Follow this user'}
                    aria-busy={contactsLoading}
                  >
                    {contactsLoading ? 'UPDATING...' : following ? '[-] UNFOLLOW' : '[+] FOLLOW'}
                  </button>
                  <button
                    className="action-btn"
                    style={{
                      borderColor: muted
                        ? 'var(--ns-color-border-default)'
                        : 'var(--ns-color-border-default)',
                      color: muted
                        ? 'var(--ns-color-text-muted)'
                        : 'var(--ns-color-danger-default)',
                      fontSize: '0.75rem'
                    }}
                    onClick={handleMuteToggle}
                    disabled={muteLoading}
                    aria-pressed={muted}
                    aria-label={muted ? 'Unmute this user' : 'Mute this user'}
                    aria-busy={muteLoading}
                  >
                    {muteLoading ? '...' : muted ? 'UNMUTE' : 'MUTE USER'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {(showLightningAddress || showLightningCallout || showSendSats) && (
            <section className="profile-tip">
              <div className="profile-tip-header">
                <div>
                  <div className="profile-tip-eyebrow">Tip</div>
                  <h3 className="profile-tip-title">Tip {tipAmount} sats</h3>
                  <p className="profile-tip-subtitle">
                    Send a quick boost or pick an amount below.
                  </p>
                </div>
                {profile?.nip05 && (
                  <div className="profile-tip-meta">
                    <span className="profile-tip-meta-label">NIP-05</span>
                    <span className="profile-tip-meta-value">{profile.nip05}</span>
                  </div>
                )}
              </div>

              {showLightningAddress ? (
                <div className="profile-tip-grid">
                  <div className="profile-tip-column">
                    <div className="lightning-card">
                      <div className="lightning-card-header">
                        <div className="lightning-card-title">{lightningLabel}</div>
                        {lightningCopyStatus === 'error' && (
                          <span className="lightning-card-hint">COPY_FAILED</span>
                        )}
                      </div>
                      <div className="lightning-card-body">
                        <div className="lightning-card-qr">
                          {lightningQr ? (
                            <img src={lightningQr} alt="Lightning QR" width={160} height={160} />
                          ) : (
                            <div className="lightning-card-qr-fallback">QR</div>
                          )}
                        </div>
                        <div className="lightning-card-details">
                          <code className="lightning-card-value">{lightningAddress}</code>
                          <div className="lightning-card-actions">
                            <button
                              className="action-btn"
                              onClick={handleCopyLightning}
                              aria-label="Copy lightning address"
                            >
                              {lightningCopyStatus === 'copied' ? 'COPIED' : 'COPY'}
                            </button>
                            <button
                              className="action-btn"
                              onClick={handleOpenWallet}
                              disabled={!lightningUri}
                              aria-label="Open lightning wallet"
                            >
                              OPEN_WALLET
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {showSendSats && (
                    <div className="profile-tip-column">
                      <SendSats
                        pubkey={pubkey}
                        lightningAddress={lightningAddress ?? undefined}
                        defaultAmountSats={paymentConfig.defaultSendSats}
                        presetAmountsSats={paymentConfig.presetSendSats}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="profile-tip-empty">
                  <div className="profile-tip-empty-title">Tipping is currently unavailable</div>
                  <div className="profile-tip-empty-body">
                    This user hasn&apos;t linked a Lightning address to their profile yet. Once they
                    do, you&apos;ll be able to send them sats and zaps directly!
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <h3>USER_ACTIVITY</h3>
      <div className="user-events">
        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map((i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="profile-empty" role="status" aria-live="polite">
            <p>No posts yet. Check back soon.</p>
            {!isMe && !following && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--ns-color-text-muted)' }}>
                Follow them to see their posts in your feed.
              </p>
            )}
          </div>
        ) : (
          <>
            {events.map((event) => (
              <NostrEventCard
                key={event.id}
                event={event}
                authorLightningAddress={profile?.lud16 ?? profile?.lud06}
                apiBase={apiBase}
                enableRegtestPay={enableRegtestPay}
              />
            ))}

            {hasMore && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <button
                  className="auth-btn"
                  onClick={loadMore}
                  disabled={eventsLoading}
                  style={{ width: 'auto', minWidth: '200px' }}
                  aria-label="Load more posts"
                >
                  {eventsLoading ? (
                    <>
                      <span
                        className="ns-spinner"
                        style={{ marginRight: '0.5rem' }}
                        aria-hidden="true"
                      />
                      LOADING...
                    </>
                  ) : (
                    'LOAD MORE'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

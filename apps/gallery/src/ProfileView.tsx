import './styles/lightning-card.css';
import './styles/profile-tip.css';

import { SendSats } from '@nostrstack/blog-kit';
import { type Event, nip19, SimplePool } from 'nostr-tools';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { paymentConfig } from './config/payments';
import { PostItem } from './FeedView'; // Re-use PostItem from FeedView
import { Alert } from './ui/Alert';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];
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

export function ProfileView({ pubkey }: { pubkey: string }) {
  const [profile, setProfile] = useState<ProfileMetadata | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightningQr, setLightningQr] = useState<string | null>(null);
  const [lightningCopyStatus, setLightningCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' || import.meta.env.DEV;

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setError(null);
    const pool = new SimplePool();
    const filter = { kinds: [0, 3], authors: [pubkey] };
    try {
      const sub = pool.subscribeMany(DEFAULT_RELAYS, filter, {
        onevent: (event) => {
          if (event.kind === 0) {
            try {
              const metadata = JSON.parse(event.content) as ProfileMetadata;
              setProfile(metadata);
            } catch (e) {
              console.error('Failed to parse profile metadata', e);
            }
          } else if (event.kind === 3) {
            const count = event.tags.filter(t => t[0] === 'p').length;
            setFollowingCount(count);
          }
        },
        oneose: () => {
          setProfileLoading(false);
        }
      });
      
      return () => {
        try { sub.close(); } catch { /* ignore */ }
        try { pool.close(DEFAULT_RELAYS); } catch { /* ignore */ }
      };
    } catch (e) {
      console.error('Failed to fetch profile', e);
      setError('Failed to fetch profile data.');
      setProfileLoading(false);
      try { pool.close(DEFAULT_RELAYS); } catch { /* ignore */ }
    }
  }, [pubkey]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    const pool = new SimplePool();
    const filter = { kinds: [1], authors: [pubkey], limit: 20 };
    try {
      const sub = pool.subscribeMany(DEFAULT_RELAYS, filter, {
        onevent: (event) => {
          setEvents((prev) => {
            if (prev.some((existing) => existing.id === event.id)) return prev;
            return [...prev, event].sort((a, b) => b.created_at - a.created_at);
          });
        },
        oneose: () => {
          setEventsLoading(false);
        }
      });
      return () => {
        try { sub.close(); } catch { /* ignore */ }
        try { pool.close(DEFAULT_RELAYS); } catch { /* ignore */ }
      };
    } catch (e) {
      console.error('Failed to fetch events', e);
      setError('Failed to fetch user events.');
      setEventsLoading(false);
      try { pool.close(DEFAULT_RELAYS); } catch { /* ignore */ }
    }
  }, [pubkey]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || events.length === 0) return;
    setIsLoadingMore(true);
    const lastEvent = events[events.length - 1];
    const until = lastEvent.created_at - 1;
    const pool = new SimplePool();
    const filter = { kinds: [1], authors: [pubkey], until, limit: 20 };
    
    try {
      const olderEvents = await pool.querySync(DEFAULT_RELAYS, filter);
      const uniqueOlder = olderEvents.filter(p => !events.some(e => e.id === p.id));
      
      setEvents(prev => {
        const next = [...prev, ...uniqueOlder].sort((a, b) => b.created_at - a.created_at);
        return next;
      });
    } catch (err) {
      console.error('Failed to load more profile events', err);
    } finally {
      setIsLoadingMore(false);
      try { pool.close(DEFAULT_RELAYS); } catch { /* ignore */ }
    }
  }, [isLoadingMore, events, pubkey]);

  useEffect(() => {
    let cleanupProfile: (() => void) | undefined;
    let cleanupEvents: (() => void) | undefined;

    fetchProfile().then(cleanup => { cleanupProfile = cleanup; });
    fetchEvents().then(cleanup => { cleanupEvents = cleanup; });

    return () => {
      cleanupProfile?.();
      cleanupEvents?.();
    };
  }, [fetchProfile, fetchEvents]);

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

  return (
    <div className="profile-view">
      {error && (
        <Alert tone="danger" title="Profile Error">
          {error}
        </Alert>
      )}
      {profileLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }} role="status">
          <span className="nostrstack-spinner" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
          LOADING PROFILE...
        </div>
      ) : (
        <>
          <div className="profile-header">
            <img src={profile?.picture || FALLBACK_AVATAR} alt="Profile" className="profile-picture" />
            <div className="profile-info">
              <div className="profile-title-row">
                <h2 className="profile-name">{profile?.display_name || profile?.name || 'UNKNOWN_USER'}</h2>
                <div className="profile-badges">
                  {profile?.nip05 && <span className="profile-badge profile-badge--verified">NIP-05 verified</span>}
                  <span
                    className={`profile-badge ${
                      showLightningAddress ? 'profile-badge--success' : 'profile-badge--muted'
                    }`}
                  >
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
              <button
                className="action-btn"
                style={{ marginTop: '1rem', borderColor: 'var(--terminal-accent)', color: 'var(--terminal-accent)' }}
              >
                [+] FOLLOW_USER
              </button>
            </div>
          </div>

          {(showLightningAddress || showLightningCallout || showSendSats) && (
            <section className="profile-tip">
              <div className="profile-tip-header">
                <div>
                  <div className="profile-tip-eyebrow">Tip</div>
                  <h3 className="profile-tip-title">Tip {tipAmount} sats</h3>
                  <p className="profile-tip-subtitle">Send a quick boost or pick an amount below.</p>
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
                            <img src={lightningQr} alt="Lightning QR" />
                          ) : (
                            <div className="lightning-card-qr-fallback">QR</div>
                          )}
                        </div>
                        <div className="lightning-card-details">
                          <code className="lightning-card-value">{lightningAddress}</code>
                          <div className="lightning-card-actions">
                            <button className="action-btn" onClick={handleCopyLightning}>
                              {lightningCopyStatus === 'copied' ? 'COPIED' : 'COPY'}
                            </button>
                            <button className="action-btn" onClick={handleOpenWallet} disabled={!lightningUri}>
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
                    This user hasn't linked a Lightning address to their profile yet. Once they do, you'll be able to send them sats and zaps directly!
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
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }} role="status">
            <span className="nostrstack-spinner" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
            LOADING EVENTS...
          </div>
        ) : events.length === 0 ? (
          <p className="profile-empty">No posts yet. Check back soon.</p>
        ) : (
          <>
            {events.map((event) => (
              <PostItem 
                key={event.id} 
                post={event} 
                authorLightningAddress={profile?.lud16 ?? profile?.lud06} 
                apiBase={apiBase}
                enableRegtestPay={enableRegtestPay}
              />
            ))}
            
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <button 
                className="auth-btn" 
                onClick={loadMore} 
                disabled={isLoadingMore}
                style={{ width: 'auto', minWidth: '200px' }}
              >
                {isLoadingMore ? (
                  <>
                    <span className="nostrstack-spinner" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
                    LOADING...
                  </>
                ) : (
                  'LOAD MORE'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

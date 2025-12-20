import './styles/lightning-card.css';

import { type Event, nip19, Relay } from 'nostr-tools';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PostItem } from './FeedView'; // Re-use PostItem from FeedView

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

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
  const [profileLoading, setProfileLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightningQr, setLightningQr] = useState<string | null>(null);
  const [lightningCopyStatus, setLightningCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setError(null);
    try {
      const relay = await Relay.connect(DEFAULT_RELAYS[0]); // Connect to one relay for metadata
      let closed = false;
      let closeRelay = () => {};
      const sub = relay.subscribe([{ kinds: [0], authors: [pubkey] }], {
        onevent: (event) => {
          try {
            const metadata = JSON.parse(event.content) as ProfileMetadata;
            setProfile(metadata);
          } catch (e) {
            console.error('Failed to parse profile metadata', e);
          }
        },
        oneose: () => {
          setProfileLoading(false);
        }
      });
      closeRelay = () => {
        if (closed) return;
        closed = true;
        try { sub.close(); } catch { /* ignore */ }
        try { relay.close(); } catch { /* ignore */ }
      };
      // Cleanup subscription on unmount
      return () => {
        closeRelay();
      };
    } catch (e) {
      console.error('Failed to fetch profile', e);
      setError('Failed to fetch profile data.');
      setProfileLoading(false);
    }
  }, [pubkey]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const relay = await Relay.connect(DEFAULT_RELAYS[0]);
      let closed = false;
      let closeRelay = () => {};
      const sub = relay.subscribe([{ kinds: [1], authors: [pubkey], limit: 20 }], {
        onevent: (event) => {
          setEvents(prev => [...prev, event].sort((a, b) => b.created_at - a.created_at));
        },
        oneose: () => {
          setEventsLoading(false);
        }
      });
      closeRelay = () => {
        if (closed) return;
        closed = true;
        try { sub.close(); } catch { /* ignore */ }
        try { relay.close(); } catch { /* ignore */ }
      };
      return () => {
        closeRelay();
      };
    } catch (e) {
      console.error('Failed to fetch events', e);
      setError('Failed to fetch user events.');
      setEventsLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    const cleanupProfile = fetchProfile();
    const cleanupEvents = fetchEvents();
    return () => {
      cleanupProfile.then(cleanup => cleanup?.());
      cleanupEvents.then(cleanup => cleanup?.());
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

  return (
    <div className="profile-view">
      {error && <div className="error-msg">{error}</div>}
      {profileLoading ? <p>LOADING PROFILE...</p> : (
        <div className="profile-header">
          <img src={profile?.picture || 'https://via.placeholder.com/64'} alt="Profile" className="profile-picture" />
          <div className="profile-info">
            <h2 className="profile-name">{profile?.display_name || profile?.name || 'UNKNOWN_USER'}</h2>
            <code className="profile-pubkey">{npub}</code>
            {profile?.nip05 && <p className="profile-nip05">NIP-05: {profile.nip05}</p>}
            {profile?.about && <p className="profile-about">{profile.about}</p>}
            {lightningAddress && (
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
            )}
            {profile?.website && <p className="profile-website">Web: <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a></p>}
            <button className="action-btn" style={{ marginTop: '1rem', borderColor: 'var(--terminal-accent)', color: 'var(--terminal-accent)' }}>
              [+] FOLLOW_USER
            </button>
          </div>
        </div>
      )}

      <h3>USER_ACTIVITY</h3>
      {eventsLoading ? <p>LOADING EVENTS...</p> : (
        <div className="user-events">
          {events.length === 0 ? <p>NO EVENTS FOUND.</p> : (
            events.map(event => (
              <PostItem key={event.id} post={event} authorLightningAddress={profile?.lud16 ?? profile?.lud06} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

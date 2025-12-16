import { useState, useEffect, useCallback, useMemo } from 'react';
import { type Event, nip19, Relay } from 'nostr-tools';
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

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setError(null);
    try {
      const relay = await Relay.connect(DEFAULT_RELAYS[0]); // Connect to one relay for metadata
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
          try { relay.close(); } catch {}
          setProfileLoading(false);
        }
      });
      // Cleanup subscription on unmount
      return () => {
        try { sub.close(); } catch {}
        try { relay.close(); } catch {}
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
      const sub = relay.subscribe([{ kinds: [1], authors: [pubkey], limit: 20 }], {
        onevent: (event) => {
          setEvents(prev => [...prev, event].sort((a, b) => b.created_at - a.created_at));
        },
        oneose: () => {
          try { relay.close(); } catch {}
          setEventsLoading(false);
        }
      });
      return () => {
        try { sub.close(); } catch {}
        try { relay.close(); } catch {}
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
            {profile?.lud16 && <p className="profile-lud16">Lightning: {profile.lud16}</p>}
            {profile?.lud06 && <p className="profile-lud06">LNURL: {profile.lud06}</p>}
            {profile?.website && <p className="profile-website">Web: <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a></p>}
          </div>
        </div>
      )}

      <h3>USER_ACTIVITY</h3>
      {eventsLoading ? <p>LOADING EVENTS...</p> : (
        <div className="user-events">
          {events.length === 0 ? <p>NO EVENTS FOUND.</p> : (
            events.map(event => (
              <PostItem key={event.id} post={event} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

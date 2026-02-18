import '../styles/components/nwc.css';

import { NwcClient, useAuth, useProfile } from '@nostrstack/react';
import { useToast } from '@nostrstack/ui';
import { type NsBrandPreset, nsBrandPresets } from '@nostrstack/widgets';
import { SimplePool } from 'nostr-tools';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { usePushNotifications } from '../hooks/usePushNotifications';
import { useRelays } from '../hooks/useRelays';
import { CelebrationSettings } from '../ui/CelebrationSettings';

const NWC_STORAGE_KEY = 'nostrstack.nwc';
const NWC_PAYMENT_KEY = 'nostrstack.nwc.lastPayment';
const DEV_NETWORK_KEY = 'nostrstack.dev.network';
const NWC_REMEMBER_KEY = 'nostrstack.nwc.remember';

type NwcLastPayment = {
  status: 'success' | 'error';
  message: string;
  ts: number;
};

function readLastPayment(): NwcLastPayment | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(NWC_PAYMENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NwcLastPayment;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.message || !parsed.ts || !parsed.status) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface SettingsScreenProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  brandPreset: NsBrandPreset;
  setBrandPreset: (p: NsBrandPreset) => void;
}

export function SettingsScreen({
  theme,
  setTheme,
  brandPreset,
  setBrandPreset
}: SettingsScreenProps) {
  const toast = useToast();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const { pubkey, signEvent } = useAuth();
  const { relays: relayList } = useRelays();
  const { profile: profileEvent } = useProfile(pubkey ?? '', { enabled: !!pubkey });

  const [profileName, setProfileName] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [profileBanner, setProfileBanner] = useState('');
  const [profileAbout, setProfileAbout] = useState('');
  const [profileNip05, setProfileNip05] = useState('');
  const [profileLud16, setProfileLud16] = useState('');
  const [profileWebsite, setProfileWebsite] = useState('');
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle'
  );
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleThemeToggle = useCallback(() => {
    setTheme(nextTheme);
    toast({
      message: `Theme set to ${nextTheme}.`,
      tone: 'success'
    });
  }, [nextTheme, setTheme, toast]);

  const handleBrandPresetSelect = useCallback(
    (nextBrandPreset: NsBrandPreset) => {
      setBrandPreset(nextBrandPreset);
      toast({
        message: `Brand theme set to ${nextBrandPreset}.`,
        tone: 'success'
      });
    },
    [setBrandPreset, toast]
  );

  useEffect(() => {
    if (profileEvent?.content) {
      try {
        const content = JSON.parse(profileEvent.content);
        setProfileName(content.name ?? '');
        setProfileDisplayName(content.display_name ?? '');
        setProfilePicture(content.picture ?? '');
        setProfileBanner(content.banner ?? '');
        setProfileAbout(content.about ?? '');
        setProfileNip05(content.nip05 ?? '');
        setProfileLud16(content.lud16 ?? '');
        setProfileWebsite(content.website ?? '');
      } catch {
        // ignore parse errors
      }
    }
  }, [profileEvent]);

  const handlePublishProfile = useCallback(async () => {
    if (!pubkey || !signEvent) {
      setProfileError('Not authenticated');
      setProfileStatus('error');
      return;
    }

    setProfileStatus('saving');
    setProfileError(null);

    try {
      const content = {
        name: profileName || undefined,
        display_name: profileDisplayName || undefined,
        picture: profilePicture || undefined,
        banner: profileBanner || undefined,
        about: profileAbout || undefined,
        nip05: profileNip05 || undefined,
        lud16: profileLud16 || undefined,
        website: profileWebsite || undefined
      };

      const template = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(content)
      };

      const signedEvent = await signEvent(template);

      const relays = relayList?.length
        ? relayList
        : ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];

      const pool = new SimplePool();
      try {
        await Promise.any(pool.publish(relays, signedEvent));
      } catch {
        console.warn('[Settings] Failed to publish profile to all relays');
      }
      pool.close(relays);

      setProfileStatus('success');
      window.setTimeout(() => setProfileStatus('idle'), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to publish profile');
      setProfileStatus('error');
    }
  }, [
    pubkey,
    signEvent,
    relayList,
    profileName,
    profileDisplayName,
    profilePicture,
    profileBanner,
    profileAbout,
    profileNip05,
    profileLud16,
    profileWebsite
  ]);

  const [nwcUri, setNwcUri] = useState('');
  const [nwcRelays, setNwcRelays] = useState('');
  const [nwcMaxSats, setNwcMaxSats] = useState('');
  const [persistNwc, setPersistNwc] = useState(false);
  const [nwcMessage, setNwcMessage] = useState<string | null>(null);
  const [nwcCheckStatus, setNwcCheckStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>(
    'idle'
  );
  const [nwcCheckMessage, setNwcCheckMessage] = useState<string | null>(null);
  const [nwcBalanceMsat, setNwcBalanceMsat] = useState<number | null>(null);
  const [nwcLastPayment, setNwcLastPayment] = useState<NwcLastPayment | null>(null);
  const [devNetworkOverride, setDevNetworkOverride] = useState('');
  const nwcUriTrimmed = nwcUri.trim();

  const { permission, requestPermission, sendLocalNotification } = usePushNotifications();

  const hydrateNwcFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(NWC_STORAGE_KEY);
    const rememberRaw = window.localStorage.getItem(NWC_REMEMBER_KEY);
    const hasRememberPreference = rememberRaw !== null;
    const rememberFromStorage = rememberRaw === '1';
    if (!raw) {
      setPersistNwc(hasRememberPreference ? rememberFromStorage : false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { uri?: string; relays?: string[]; maxSats?: number };
      if (parsed?.uri) setNwcUri(parsed.uri);
      if (parsed?.relays?.length) setNwcRelays(parsed.relays.join(', '));
      if (typeof parsed?.maxSats === 'number' && Number.isFinite(parsed.maxSats)) {
        setNwcMaxSats(String(parsed.maxSats));
      }
      setPersistNwc(hasRememberPreference ? rememberFromStorage : true);
    } catch {
      setPersistNwc(hasRememberPreference ? rememberFromStorage : false);
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    hydrateNwcFromStorage();
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NWC_STORAGE_KEY || event.key === NWC_REMEMBER_KEY || event.key === null) {
        hydrateNwcFromStorage();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [hydrateNwcFromStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => {
      setNwcLastPayment(readLastPayment());
    };
    refresh();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NWC_PAYMENT_KEY) refresh();
    };
    const handleCustom = () => refresh();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nostrstack:nwc-payment', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:nwc-payment', handleCustom as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const readOverride = () => {
      const raw = window.localStorage.getItem(DEV_NETWORK_KEY);
      setDevNetworkOverride(raw ?? '');
    };
    readOverride();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEV_NETWORK_KEY) readOverride();
    };
    const handleCustom = () => readOverride();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nostrstack:dev-network', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:dev-network', handleCustom as EventListener);
    };
  }, []);

  const nwcUriError = useMemo(() => {
    if (!nwcUriTrimmed) return null;
    if (!nwcUriTrimmed.startsWith('nostr+walletconnect://')) {
      return 'NWC URI must start with nostr+walletconnect://';
    }
    try {
      const parsed = new URL(nwcUriTrimmed);
      if (!parsed.hostname) return 'NWC URI missing public key';
      if (!parsed.searchParams.get('secret')) return 'NWC URI missing secret';
      return null;
    } catch {
      return 'Invalid NWC URI';
    }
  }, [nwcUriTrimmed]);

  const nwcMaxSatsValue = useMemo(() => {
    if (!nwcMaxSats.trim()) return null;
    const value = Number(nwcMaxSats);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor(value);
  }, [nwcMaxSats]);

  const nwcLimitError = useMemo(() => {
    if (!nwcMaxSats.trim()) return null;
    const value = Number(nwcMaxSats);
    if (!Number.isFinite(value)) return 'Max sats must be a number.';
    if (value <= 0) return 'Max sats must be greater than zero.';
    return null;
  }, [nwcMaxSats]);

  const parsedRelays = useMemo(
    () =>
      nwcRelays
        .split(/[\s,]+/g)
        .map((relay) => relay.trim())
        .filter(Boolean),
    [nwcRelays]
  );

  const hasNwcConfig = Boolean(nwcUriTrimmed);

  const nwcStatusLabel = useMemo(() => {
    if (!hasNwcConfig) return 'DISCONNECTED';
    if (nwcCheckStatus === 'checking') return 'CHECKING';
    if (nwcCheckStatus === 'connected') return 'CONNECTED';
    if (nwcCheckStatus === 'error') return 'ERROR';
    return 'CONFIGURED';
  }, [hasNwcConfig, nwcCheckStatus]);

  const nwcStatusTone = useMemo(() => {
    if (!hasNwcConfig) return 'neutral';
    if (nwcCheckStatus === 'connected') return 'success';
    if (nwcCheckStatus === 'error') return 'error';
    if (nwcCheckStatus === 'checking') return 'pending';
    return 'neutral';
  }, [hasNwcConfig, nwcCheckStatus]);

  const balanceSats = useMemo(() => {
    if (nwcBalanceMsat === null) return null;
    return Math.floor(nwcBalanceMsat / 1000);
  }, [nwcBalanceMsat]);

  useEffect(() => {
    setNwcCheckStatus('idle');
    setNwcCheckMessage(null);
    setNwcBalanceMsat(null);
  }, [nwcUriTrimmed, nwcRelays]);

  const handleSaveNwc = () => {
    if (nwcUriError || nwcLimitError) return;
    const payload = {
      uri: nwcUriTrimmed || undefined,
      relays: parsedRelays.length ? parsedRelays : undefined,
      maxSats: nwcMaxSatsValue ?? undefined
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NWC_REMEMBER_KEY, persistNwc ? '1' : '0');
      if (persistNwc) {
        window.localStorage.setItem(NWC_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(NWC_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: payload }));
    }
    toast({
      message: persistNwc
        ? 'NWC settings saved and remembered on this device.'
        : 'NWC settings saved without persistence.',
      tone: 'success'
    });
    setNwcMessage('Saved');
    window.setTimeout(() => setNwcMessage(null), 1500);
  };

  const handleClearNwc = () => {
    setNwcUri('');
    setNwcRelays('');
    setNwcMaxSats('');
    setPersistNwc(false);
    setNwcCheckStatus('idle');
    setNwcCheckMessage(null);
    setNwcBalanceMsat(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(NWC_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: null }));
    }
    toast({ message: 'NWC wallet settings disconnected.', tone: 'success' });
    setNwcMessage('Disconnected');
    window.setTimeout(() => setNwcMessage(null), 1500);
  };

  const handlePersistPreferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setPersistNwc(next);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NWC_REMEMBER_KEY, next ? '1' : '0');
    if (!next) {
      window.localStorage.removeItem(NWC_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: null }));
      toast({ message: 'Wallet persistence disabled on this device.', tone: 'success' });
      return;
    }

    if (hasNwcConfig) {
      const payload = {
        uri: nwcUriTrimmed || undefined,
        relays: parsedRelays.length ? parsedRelays : undefined,
        maxSats: nwcMaxSatsValue ?? undefined
      };
      window.localStorage.setItem(NWC_STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: payload }));
    }

    toast({
      message: hasNwcConfig
        ? 'Wallet persistence enabled and current config saved.'
        : 'Wallet persistence enabled. Connect to persist this wallet config.',
      tone: 'success'
    });
  };

  const handleCheckNwc = async () => {
    if (nwcUriError || nwcLimitError || !nwcUriTrimmed) {
      setNwcCheckStatus('error');
      setNwcCheckMessage(nwcUriError ?? nwcLimitError ?? 'Enter a valid NWC URI to connect.');
      setNwcBalanceMsat(null);
      return;
    }
    setNwcCheckStatus('checking');
    setNwcCheckMessage('Checking wallet connection…');
    let client: NwcClient | null = null;
    try {
      const mock =
        typeof window !== 'undefined'
          ? (
              window as {
                __NOSTRSTACK_NWC_MOCK__?: { getBalance?: () => Promise<{ balance: number }> };
              }
            ).__NOSTRSTACK_NWC_MOCK__
          : null;
      if (mock?.getBalance) {
        const result = await mock.getBalance();
        setNwcBalanceMsat(result.balance);
        setNwcCheckStatus('connected');
        setNwcCheckMessage('Wallet connected.');
        return;
      }
      client = new NwcClient({
        uri: nwcUriTrimmed,
        relays: parsedRelays.length ? parsedRelays : undefined
      });
      const result = await client.getBalance();
      setNwcBalanceMsat(result.balance);
      setNwcCheckStatus('connected');
      setNwcCheckMessage('Wallet connected.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach wallet.';
      setNwcCheckStatus('error');
      setNwcCheckMessage(message);
      setNwcBalanceMsat(null);
    } finally {
      client?.close();
    }
  };

  const handleConnectNwc = async () => {
    if (nwcUriError || nwcLimitError || !nwcUriTrimmed) {
      setNwcCheckStatus('error');
      setNwcCheckMessage(nwcUriError ?? nwcLimitError ?? 'Enter a valid NWC URI to connect.');
      setNwcBalanceMsat(null);
      return;
    }
    setNwcMessage('Connecting to NWC wallet.');
    handleSaveNwc();
    toast({ message: 'Connecting to NWC wallet.', tone: 'success' });
    await handleCheckNwc();
  };

  const handleDevNetworkChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setDevNetworkOverride(value);
    if (typeof window === 'undefined') return;
    if (value) {
      window.localStorage.setItem(DEV_NETWORK_KEY, value);
    } else {
      window.localStorage.removeItem(DEV_NETWORK_KEY);
    }
    window.dispatchEvent(new CustomEvent('nostrstack:dev-network', { detail: value || null }));
  };

  return (
    <div className="profile-view">
      {pubkey && (
        <div className="paywall-container">
          <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>Profile</h4>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--ns-color-text-muted)',
              marginBottom: '1rem'
            }}
          >
            Update your profile information. This will be published to the Nostr network.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="nwc-label" htmlFor="profile-name">
              Name
              <input
                id="profile-name"
                className="ns-input"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Display name"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-display-name">
              Display Name
              <input
                id="profile-display-name"
                className="ns-input"
                type="text"
                value={profileDisplayName}
                onChange={(e) => setProfileDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-picture">
              Avatar URL
              <input
                id="profile-picture"
                className="ns-input"
                type="url"
                value={profilePicture}
                onChange={(e) => setProfilePicture(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-banner">
              Banner URL
              <input
                id="profile-banner"
                className="ns-input"
                type="url"
                value={profileBanner}
                onChange={(e) => setProfileBanner(e.target.value)}
                placeholder="https://example.com/banner.jpg"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-about">
              Bio
              <textarea
                id="profile-about"
                className="ns-input"
                value={profileAbout}
                onChange={(e) => setProfileAbout(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </label>
            <label className="nwc-label" htmlFor="profile-nip05">
              NIP-05 Identifier
              <input
                id="profile-nip05"
                className="ns-input"
                type="email"
                value={profileNip05}
                onChange={(e) => setProfileNip05(e.target.value)}
                placeholder="you@domain.com"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-lud16">
              Lightning Address
              <input
                id="profile-lud16"
                className="ns-input"
                type="email"
                value={profileLud16}
                onChange={(e) => setProfileLud16(e.target.value)}
                placeholder="you@lightning.address"
              />
            </label>
            <label className="nwc-label" htmlFor="profile-website">
              Website
              <input
                id="profile-website"
                className="ns-input"
                type="url"
                value={profileWebsite}
                onChange={(e) => setProfileWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </label>
          </div>
          {profileError && (
            <div
              style={{
                color: 'var(--ns-color-danger-default)',
                marginTop: '0.5rem',
                fontSize: '0.9rem'
              }}
            >
              {profileError}
            </div>
          )}
          {profileStatus === 'success' && (
            <div
              style={{
                color: 'var(--ns-color-success-default)',
                marginTop: '0.5rem',
                fontSize: '0.9rem'
              }}
            >
              Profile published successfully!
            </div>
          )}
          <button
            type="button"
            className="action-btn"
            style={{ marginTop: '1rem' }}
            onClick={handlePublishProfile}
            disabled={profileStatus === 'saving'}
            aria-label="Publish profile"
          >
            {profileStatus === 'saving' ? 'Publishing...' : 'Publish Profile'}
          </button>
        </div>
      )}

      <h3>System Settings</h3>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>Appearance</h4>
        <div style={{ display: 'flex', gap: '1rem' }} role="group" aria-label="Theme mode">
          <button
            type="button"
            className="action-btn"
            style={{
              borderColor: theme === 'dark' ? 'var(--ns-color-text-default)' : undefined,
              color: theme === 'dark' ? 'var(--ns-color-text-default)' : undefined
            }}
            onClick={handleThemeToggle}
            aria-pressed={theme === 'dark'}
            aria-label={`Switch to ${nextTheme} mode`}
          >
            Theme: {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>Color Theme</h4>
        <div
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
          role="group"
          aria-label="Brand preset selection"
        >
          {(Object.keys(nsBrandPresets) as NsBrandPreset[]).map((preset) => (
            <button
              type="button"
              key={preset}
              className="action-btn"
              style={{
                borderColor: brandPreset === preset ? 'var(--ns-color-text-default)' : undefined,
                color: brandPreset === preset ? 'var(--ns-color-text-default)' : undefined
              }}
              onClick={() => handleBrandPresetSelect(preset as NsBrandPreset)}
              aria-pressed={brandPreset === preset}
              aria-label={`Switch to ${preset} theme`}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>
          Onboarding Tour
        </h4>
        <button
          type="button"
          className="action-btn"
          onClick={() => {
            localStorage.removeItem('nostrstack.onboarding.v1');
            window.dispatchEvent(new Event('nostrstack:restart-onboarding-tour'));
          }}
          aria-label="Restart onboarding tour"
        >
          Restart Tour
        </button>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>
          Notifications
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem' }}>
            Status: <strong>{permission.toUpperCase()}</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {permission === 'default' && (
              <button
                type="button"
                className="action-btn"
                onClick={requestPermission}
                aria-label="Enable push notifications"
              >
                Enable Notifications
              </button>
            )}
            {permission === 'granted' && (
              <button
                type="button"
                className="action-btn"
                onClick={() =>
                  sendLocalNotification('Test Notification', {
                    body: 'This is a test notification from NostrStack.'
                  })
                }
                aria-label="Send test notification"
              >
                Send Test
              </button>
            )}
            {permission === 'denied' && (
              <div style={{ fontSize: '0.8rem', color: 'var(--ns-color-danger-default)' }}>
                Notifications are blocked. Please enable them in your browser settings.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="paywall-container">
        <CelebrationSettings />
      </div>

      {import.meta.env.DEV && (
        <div className="paywall-container">
          <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: '0.5rem' }}>
            Network (Dev)
          </h4>
          <label className="nwc-label">
            NETWORK
            <select
              className="ns-input"
              value={devNetworkOverride}
              onChange={handleDevNetworkChange}
              name="dev-network"
            >
              <option value="">AUTO (ENV)</option>
              <option value="regtest">REGTEST</option>
              <option value="mutinynet">MUTINYNET</option>
              <option value="mainnet">MAINNET</option>
            </select>
          </label>
          <div style={{ fontSize: '0.75rem', color: 'var(--ns-color-text-muted)' }}>
            Updates UI labels only. Does not change backend network.
          </div>
        </div>
      )}

      <div className="paywall-container nwc-card">
        <div className="nwc-header">
          <h4 style={{ color: 'var(--ns-color-text-muted)', marginBottom: 0 }}>Wallet Connect</h4>
          <span
            className={`nwc-status-pill ${nwcStatusTone !== 'neutral' ? `is-${nwcStatusTone}` : ''}`}
          >
            {nwcStatusLabel}
          </span>
        </div>
        <div
          className="nwc-status-row"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          role="status"
          aria-live="polite"
        >
          {nwcCheckStatus === 'checking' && (
            <span className="ns-spinner" style={{ width: '14px', height: '14px' }} />
          )}
          <span className="nwc-status-text">
            {nwcCheckMessage ??
              (hasNwcConfig
                ? 'Wallet configured. Connect to verify.'
                : 'Add a wallet URI to connect.')}
          </span>
        </div>
        {balanceSats !== null && (
          <div className="nwc-balance">
            Balance: {balanceSats.toLocaleString()} sats
            {nwcBalanceMsat !== null && (
              <span className="nwc-balance-msat">{nwcBalanceMsat.toLocaleString()} msat</span>
            )}
          </div>
        )}
        {nwcLastPayment && (
          <div className="nwc-last-payment">
            <span
              className={`nwc-last-pill ${nwcLastPayment.status === 'success' ? 'is-success' : 'is-error'}`}
            >
              {nwcLastPayment.status === 'success' ? 'Last: Success' : 'Last: Failed'}
            </span>
            <span className="nwc-last-message">{nwcLastPayment.message}</span>
            <span className="nwc-last-time">{new Date(nwcLastPayment.ts).toLocaleString()}</span>
          </div>
        )}
        <div className="nwc-form" role="group" aria-label="NWC connection settings">
          <label className="nwc-label" htmlFor="nwc-uri-input">
            Connection String
            <input
              id="nwc-uri-input"
              className="ns-input"
              type="password"
              name="nwc-uri"
              autoComplete="off"
              placeholder="nostr+walletconnect://..."
              value={nwcUri}
              onChange={(event) => setNwcUri(event.target.value)}
              aria-describedby={nwcUriError ? 'nwc-uri-error' : undefined}
              aria-invalid={Boolean(nwcUriError)}
            />
          </label>
          <label className="nwc-label" htmlFor="nwc-relays-input">
            RELAYS (comma or space separated)
            <input
              id="nwc-relays-input"
              className="ns-input"
              type="text"
              name="nwc-relays"
              placeholder="wss://relay.example, wss://relay2.example"
              value={nwcRelays}
              onChange={(event) => setNwcRelays(event.target.value)}
            />
          </label>
          <label className="nwc-label" htmlFor="nwc-max-sats-input">
            Max Payment
            <input
              id="nwc-max-sats-input"
              className="ns-input"
              type="number"
              name="nwc-max-sats"
              min="1"
              placeholder="e.g. 5000"
              value={nwcMaxSats}
              onChange={(event) => setNwcMaxSats(event.target.value)}
              aria-describedby={nwcLimitError ? 'nwc-limit-error' : undefined}
              aria-invalid={Boolean(nwcLimitError)}
            />
          </label>
        </div>
        {(nwcUriError || nwcLimitError) && (
          <div className="nwc-error" role="alert" aria-live="assertive">
            {nwcUriError && <div id="nwc-uri-error">{nwcUriError}</div>}
            {nwcLimitError && <div id="nwc-limit-error">{nwcLimitError}</div>}
          </div>
        )}
        <label className="nwc-remember" htmlFor="nwc-remember-checkbox">
          <input
            id="nwc-remember-checkbox"
            type="checkbox"
            name="nwc-remember"
            checked={persistNwc}
            onChange={handlePersistPreferenceChange}
          />
          Remember on this device
        </label>
        <div className="nwc-actions" role="group" aria-label="Wallet connection actions">
          <button
            type="button"
            className="action-btn"
            onClick={handleConnectNwc}
            aria-busy={nwcCheckStatus === 'checking'}
            disabled={!nwcUriTrimmed || Boolean(nwcLimitError) || nwcCheckStatus === 'checking'}
            aria-label="Connect to NWC wallet"
          >
            {nwcCheckStatus === 'checking' ? 'Connecting…' : 'Connect'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={handleCheckNwc}
            aria-busy={nwcCheckStatus === 'checking'}
            disabled={!nwcUriTrimmed || Boolean(nwcLimitError) || nwcCheckStatus === 'checking'}
            aria-label="Check wallet balance"
          >
            {nwcCheckStatus === 'checking' ? 'Checking…' : 'Check Balance'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={handleClearNwc}
            disabled={!hasNwcConfig}
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
          {nwcMessage && (
            <span className="nwc-message" role="status" aria-live="polite">
              {nwcMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

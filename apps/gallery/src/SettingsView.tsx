import { type NostrstackBrandPreset } from '@nostrstack/embed';
import { useEffect, useMemo, useState } from 'react';

const NWC_STORAGE_KEY = 'nostrstack.nwc';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  brandPreset: NostrstackBrandPreset;
  setBrandPreset: (p: NostrstackBrandPreset) => void;
}

export function SettingsView({ theme, setTheme, brandPreset, setBrandPreset }: SettingsViewProps) {
  const [nwcUri, setNwcUri] = useState('');
  const [nwcRelays, setNwcRelays] = useState('');
  const [persistNwc, setPersistNwc] = useState(false);
  const [nwcStatus, setNwcStatus] = useState<string | null>(null);
  const nwcUriTrimmed = nwcUri.trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(NWC_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { uri?: string; relays?: string[] };
      if (parsed?.uri) setNwcUri(parsed.uri);
      if (parsed?.relays?.length) setNwcRelays(parsed.relays.join(', '));
      setPersistNwc(true);
    } catch {
      // ignore invalid storage
    }
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

  const parsedRelays = useMemo(
    () =>
      nwcRelays
        .split(/[\s,]+/g)
        .map(relay => relay.trim())
        .filter(Boolean),
    [nwcRelays]
  );

  const handleSaveNwc = () => {
    if (nwcUriError) return;
    const payload = {
      uri: nwcUriTrimmed || undefined,
      relays: parsedRelays.length ? parsedRelays : undefined
    };
    if (typeof window !== 'undefined') {
      if (persistNwc) {
        window.localStorage.setItem(NWC_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(NWC_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: payload }));
    }
    setNwcStatus('Saved');
    window.setTimeout(() => setNwcStatus(null), 1500);
  };

  const handleClearNwc = () => {
    setNwcUri('');
    setNwcRelays('');
    setPersistNwc(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(NWC_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: null }));
    }
    setNwcStatus('Cleared');
    window.setTimeout(() => setNwcStatus(null), 1500);
  };

  return (
    <div className="profile-view">
      <h3>SYSTEM_SETTINGS</h3>
      
      <div className="paywall-container">
        <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>VISUAL_THEME</h4>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="action-btn"
            style={{ borderColor: theme === 'dark' ? 'var(--terminal-text)' : undefined, color: theme === 'dark' ? 'var(--terminal-text)' : undefined }}
            onClick={() => setTheme('dark')}
          >
            DARK_MODE
          </button>
          <button 
            className="action-btn"
            style={{ borderColor: theme === 'light' ? 'var(--terminal-text)' : undefined, color: theme === 'light' ? 'var(--terminal-text)' : undefined }}
            onClick={() => setTheme('light')}
          >
            LIGHT_MODE
          </button>
        </div>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>BRAND_PRESET</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['default', 'ocean', 'sunset', 'midnight', 'emerald', 'crimson'].map(preset => (
            <button
              key={preset}
              className="action-btn"
              style={{ borderColor: brandPreset === preset ? 'var(--terminal-text)' : undefined, color: brandPreset === preset ? 'var(--terminal-text)' : undefined }}
              onClick={() => setBrandPreset(preset as NostrstackBrandPreset)}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>NWC_CONNECTION</h4>
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '540px' }}>
          <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--terminal-dim)' }}>
            NWC_URI
            <input
              className="nostrstack-input"
              type="text"
              name="nwc-uri"
              placeholder="nostr+walletconnect://..."
              value={nwcUri}
              onChange={(event) => setNwcUri(event.target.value)}
            />
          </label>
          {nwcUriError && (
            <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{nwcUriError}</span>
          )}
          <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--terminal-dim)' }}>
            RELAYS (comma or space separated)
            <input
              className="nostrstack-input"
              type="text"
              name="nwc-relays"
              placeholder="wss://relay.example, wss://relay2.example"
              value={nwcRelays}
              onChange={(event) => setNwcRelays(event.target.value)}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--terminal-dim)' }}>
            <input
              type="checkbox"
              name="nwc-remember"
              checked={persistNwc}
              onChange={(event) => setPersistNwc(event.target.checked)}
            />
            REMEMBER_ON_THIS_DEVICE
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="action-btn" onClick={handleSaveNwc} disabled={Boolean(nwcUriError)}>
              SAVE_NWC
            </button>
            <button className="action-btn" onClick={handleClearNwc}>
              CLEAR
            </button>
            {nwcStatus && <span style={{ fontSize: '0.8rem', color: 'var(--terminal-dim)' }}>{nwcStatus}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

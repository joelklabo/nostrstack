import './styles/nwc.css';

import { NwcClient } from '@nostrstack/blog-kit';
import { type NostrstackBrandPreset } from '@nostrstack/embed';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

const NWC_STORAGE_KEY = 'nostrstack.nwc';
const NWC_PAYMENT_KEY = 'nostrstack.nwc.lastPayment';
const DEV_NETWORK_KEY = 'nostrstack.dev.network';

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

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  brandPreset: NostrstackBrandPreset;
  setBrandPreset: (p: NostrstackBrandPreset) => void;
}

export function SettingsView({ theme, setTheme, brandPreset, setBrandPreset }: SettingsViewProps) {
  const [nwcUri, setNwcUri] = useState('');
  const [nwcRelays, setNwcRelays] = useState('');
  const [nwcMaxSats, setNwcMaxSats] = useState('');
  const [persistNwc, setPersistNwc] = useState(false);
  const [nwcMessage, setNwcMessage] = useState<string | null>(null);
  const [nwcCheckStatus, setNwcCheckStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [nwcCheckMessage, setNwcCheckMessage] = useState<string | null>(null);
  const [nwcBalanceMsat, setNwcBalanceMsat] = useState<number | null>(null);
  const [nwcLastPayment, setNwcLastPayment] = useState<NwcLastPayment | null>(null);
  const [devNetworkOverride, setDevNetworkOverride] = useState('');
  const nwcUriTrimmed = nwcUri.trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(NWC_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { uri?: string; relays?: string[]; maxSats?: number };
      if (parsed?.uri) setNwcUri(parsed.uri);
      if (parsed?.relays?.length) setNwcRelays(parsed.relays.join(', '));
      if (typeof parsed?.maxSats === 'number' && Number.isFinite(parsed.maxSats)) {
        setNwcMaxSats(String(parsed.maxSats));
      }
      setPersistNwc(true);
    } catch {
      // ignore invalid storage
    }
  }, []);

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
        .map(relay => relay.trim())
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
      if (persistNwc) {
        window.localStorage.setItem(NWC_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(NWC_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('nostrstack:nwc-update', { detail: payload }));
    }
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
    setNwcMessage('Disconnected');
    window.setTimeout(() => setNwcMessage(null), 1500);
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
      const mock = typeof window !== 'undefined' ? (window as { __NOSTRSTACK_NWC_MOCK__?: { getBalance?: () => Promise<{ balance: number }> } }).__NOSTRSTACK_NWC_MOCK__ : null;
      if (mock?.getBalance) {
        const result = await mock.getBalance();
        setNwcBalanceMsat(result.balance);
        setNwcCheckStatus('connected');
        setNwcCheckMessage('Wallet reachable.');
        return;
      }
      client = new NwcClient({ uri: nwcUriTrimmed, relays: parsedRelays.length ? parsedRelays : undefined });
      const result = await client.getBalance();
      setNwcBalanceMsat(result.balance);
      setNwcCheckStatus('connected');
      setNwcCheckMessage('Wallet reachable.');
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
    handleSaveNwc();
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

      {import.meta.env.DEV && (
        <div className="paywall-container">
          <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>DEV_NETWORK_OVERRIDE</h4>
          <label className="nwc-label">
            NETWORK
            <select
              className="nostrstack-input"
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
          <div style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>
            Updates UI labels only. Does not change backend network.
          </div>
        </div>
      )}

      <div className="paywall-container nwc-card">
        <div className="nwc-header">
          <h4 style={{ color: 'var(--terminal-dim)', marginBottom: 0 }}>NWC_CONNECTION</h4>
          <span className={`nwc-status-pill ${nwcStatusTone !== 'neutral' ? `is-${nwcStatusTone}` : ''}`}>
            {nwcStatusLabel}
          </span>
        </div>
        <div className="nwc-status-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {nwcCheckStatus === 'checking' && <span className="nostrstack-spinner" style={{ width: '14px', height: '14px' }} />}
          <span className="nwc-status-text">
            {nwcCheckMessage ?? (hasNwcConfig ? 'Wallet configured. Connect to verify.' : 'Add a wallet URI to connect.')}
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
            <span className={`nwc-last-pill ${nwcLastPayment.status === 'success' ? 'is-success' : 'is-error'}`}>
              {nwcLastPayment.status === 'success' ? 'LAST_PAYMENT_OK' : 'LAST_PAYMENT_ERROR'}
            </span>
            <span className="nwc-last-message">{nwcLastPayment.message}</span>
            <span className="nwc-last-time">{new Date(nwcLastPayment.ts).toLocaleString()}</span>
          </div>
        )}
        <div className="nwc-form">
          <label className="nwc-label">
            NWC_URI
            <input
              className="nostrstack-input"
              type="password"
              name="nwc-uri"
              placeholder="nostr+walletconnect://..."
              value={nwcUri}
              onChange={(event) => setNwcUri(event.target.value)}
            />
          </label>
          <label className="nwc-label">
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
          <label className="nwc-label">
            MAX_SATS_PER_PAYMENT
            <input
              className="nostrstack-input"
              type="number"
              name="nwc-max-sats"
              min="1"
              placeholder="e.g. 5000"
              value={nwcMaxSats}
              onChange={(event) => setNwcMaxSats(event.target.value)}
            />
          </label>
        </div>
        {(nwcUriError || nwcLimitError) && (
          <div className="nwc-error">
            {nwcUriError && <div>{nwcUriError}</div>}
            {nwcLimitError && <div>{nwcLimitError}</div>}
          </div>
        )}
        <label className="nwc-remember">
          <input
            type="checkbox"
            name="nwc-remember"
            checked={persistNwc}
            onChange={(event) => setPersistNwc(event.target.checked)}
          />
          REMEMBER_ON_THIS_DEVICE
        </label>
        <div className="nwc-actions">
          <button
            className="action-btn"
            onClick={handleConnectNwc}
            disabled={!nwcUriTrimmed || Boolean(nwcUriError) || Boolean(nwcLimitError) || nwcCheckStatus === 'checking'}
          >
            CONNECT
          </button>
          <button
            className="action-btn"
            onClick={handleCheckNwc}
            disabled={!nwcUriTrimmed || Boolean(nwcUriError) || Boolean(nwcLimitError) || nwcCheckStatus === 'checking'}
          >
            CHECK_BALANCE
          </button>
          <button className="action-btn" onClick={handleClearNwc} disabled={!hasNwcConfig}>
            DISCONNECT
          </button>
          {nwcMessage && <span className="nwc-message">{nwcMessage}</span>}
        </div>
      </div>
    </div>
  );
}

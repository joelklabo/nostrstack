import { Alert } from '@nostrstack/ui';
import { useEffect, useMemo, useState } from 'react';

import { useRelays } from './hooks/useRelays';

type RelayStatus = 'idle' | 'connecting' | 'online' | 'error';

type RelayLimitations = {
  max_message_length?: number;
  max_subscriptions?: number;
  max_filters?: number;
  max_subid_length?: number;
  max_event_tags?: number;
  max_content_length?: number;
  min_pow_difficulty?: number;
  auth_required?: boolean;
  payment_required?: boolean;
  restricted_writes?: boolean;
};

type RelayFees = {
  admission?: Array<{ amount: number; unit: string }>;
  subscription?: Array<{ amount: number; unit: string }>;
  publication?: Array<{ amount: number; unit: string }>;
};

type RelayInfo = {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: RelayLimitations;
  fees?: RelayFees;
  retention?: Array<{ time?: number; count?: number }>;
};

type RelayState = {
  url: string;
  host: string;
  status: RelayStatus;
  latencyMs?: number;
  lastChecked?: number;
  info?: RelayInfo;
  infoError?: string;
  error?: string;
  isUserRelay?: boolean;
};

const numberFormat = new Intl.NumberFormat('en-US');
const RELAY_INFO_TTL_MS = 15000;
const relayInfoCache = new Map<string, { ts: number; promise: Promise<RelayInfo> }>();

function relayHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^wss?:\/\//, '');
  }
}

function relayHttpUrl(url: string) {
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`;
  return url;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormat.format(value);
}

function formatBytes(bytes?: number | null) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
}

function formatSoftware(software?: string, version?: string) {
  if (!software && !version) return '—';
  let label = software ?? '';
  try {
    const u = new URL(software ?? '');
    label = u.hostname + u.pathname.replace(/\/$/, '');
  } catch {
    // keep as-is
  }
  if (version) return label ? `${label}@${version}` : version;
  return label || '—';
}

function summarizeFee(fee?: Array<{ amount: number; unit: string }>) {
  if (!fee || fee.length === 0) return '—';
  const first = fee[0];
  return `${formatNumber(first.amount)} ${first.unit}`;
}

function formatRetention(retention?: Array<{ time?: number; count?: number }>) {
  if (!retention || retention.length === 0) return '—';
  const entry = retention[0];
  if (entry.time) return `${formatNumber(entry.time)}s`;
  if (entry.count) return `${formatNumber(entry.count)} events`;
  return '—';
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = globalThis.setTimeout(() => {
        globalThis.clearTimeout(id);
        reject(new Error(`${label} timed out`));
      }, ms);
    })
  ]);
}

async function fetchRelayInfo(url: string, signal: AbortSignal) {
  const httpUrl = relayHttpUrl(url);
  const res = await fetch(httpUrl, {
    headers: { Accept: 'application/nostr+json' },
    signal
  });
  if (!res.ok) {
    throw new Error(`NIP-11 ${res.status}`);
  }
  return (await res.json()) as RelayInfo;
}

function fetchRelayInfoCached(url: string, signal: AbortSignal) {
  const now = Date.now();
  const cached = relayInfoCache.get(url);
  if (cached && now - cached.ts < RELAY_INFO_TTL_MS) {
    return cached.promise;
  }

  const promise = fetchRelayInfo(url, signal).catch((err) => {
    const current = relayInfoCache.get(url);
    if (current?.promise === promise) {
      relayInfoCache.delete(url);
    }
    throw err;
  });

  relayInfoCache.set(url, { ts: now, promise });
  return promise;
}

export function RelaysView() {
  const {
    relays: activeRelays,
    userRelays,
    addRelay,
    removeRelay,
    saveRelays,
    error: contextError
  } = useRelays();
  const [newRelayInput, setNewRelayInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // We want to show detailed stats for ALL active relays
  const [relays, setRelays] = useState<RelayState[]>(() =>
    activeRelays.map((url) => ({
      url,
      host: relayHost(url),
      status: 'idle',
      isUserRelay: userRelays.some((r) => r.url === url)
    }))
  );

  // Sync state when activeRelays changes (e.g. user adds/removes)
  useEffect(() => {
    setRelays((current) => {
      const next: RelayState[] = [];
      // Keep existing state for known relays, add new ones
      activeRelays.forEach((url) => {
        const existing = current.find((r) => r.url === url);
        if (existing) {
          next.push({ ...existing, isUserRelay: userRelays.some((ur) => ur.url === url) });
        } else {
          next.push({
            url,
            host: relayHost(url),
            status: 'idle',
            isUserRelay: userRelays.some((ur) => ur.url === url)
          });
        }
      });
      return next;
    });
  }, [activeRelays, userRelays]);

  useEffect(() => {
    let cancelled = false;
    const controllers = new Map<string, AbortController>();

    const updateRelay = (url: string, patch: Partial<RelayState>) => {
      setRelays((prev) =>
        prev.map((relay) => (relay.url === url ? { ...relay, ...patch } : relay))
      );
    };

    relays.forEach(async (relay) => {
      if (relay.status !== 'idle' && relay.status !== 'error') return; // Don't re-check if already working/connecting

      updateRelay(relay.url, { status: 'connecting', error: undefined });
      const start = performance.now();
      const controller = new AbortController();
      controllers.set(relay.url, controller);
      try {
        const info = await withTimeout(
          fetchRelayInfoCached(relay.url, controller.signal),
          5000,
          'NIP-11'
        );
        if (cancelled) return;
        updateRelay(relay.url, {
          status: 'online',
          latencyMs: Math.round(performance.now() - start),
          info,
          infoError: undefined,
          lastChecked: Date.now()
        });
      } catch (err) {
        if (cancelled) return;
        updateRelay(relay.url, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          infoError: err instanceof Error ? err.message : String(err),
          lastChecked: Date.now()
        });
      }
    });

    return () => {
      cancelled = true;
      if (!import.meta.env.DEV) {
        controllers.forEach((controller) => controller.abort());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using relays.length to re-run only on add/remove
  }, [relays.length]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelayInput.trim()) return;
    addRelay(newRelayInput.trim());
    setNewRelayInput('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveRelays();
    setIsSaving(false);
  };

  const summary = useMemo(() => {
    const total = relays.length;
    const online = relays.filter((r) => r.status === 'online').length;
    const errors = relays.filter((r) => r.status === 'error').length;
    const connecting = relays.filter((r) => r.status === 'connecting').length;
    return { total, online, errors, connecting };
  }, [relays]);

  return (
    <div className="relay-view">
      {contextError && (
        <Alert tone="danger" title="Relay Error" style={{ marginBottom: '1rem' }}>
          {contextError}
        </Alert>
      )}

      <div className="relay-view-header">
        <div>
          <div className="relay-view-title">Relay Manager</div>
          <div className="relay-view-subtitle">Manage your NIP-65 relay list and check health.</div>
        </div>
        <div
          className="relay-view-summary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          role="status"
        >
          {summary.connecting > 0 && (
            <>
              <span
                className="ns-spinner"
                style={{ width: '12px', height: '12px' }}
                aria-hidden="true"
              />
              <span className="sr-only">Checking relay connections</span>
            </>
          )}
          <span>{summary.online} online</span>
          <span>{summary.errors} offline</span>
          <span>{summary.total} total</span>
        </div>
      </div>

      <div className="relay-editor-section">
        <form onSubmit={handleAdd} className="relay-add-form">
          <label className="sr-only" htmlFor="relay-url">
            Relay URL
          </label>
          <input
            id="relay-url"
            type="url"
            placeholder="wss://relay.example.com"
            value={newRelayInput}
            onChange={(e) => setNewRelayInput(e.target.value)}
            className="ns-input"
            pattern="^wss?://.*"
            title="Must start with wss:// or ws://"
            required
          />
          <button type="submit" className="action-btn" aria-label="Add relay to list">
            Add Relay
          </button>
        </form>

        {userRelays.length > 0 && (
          <div className="relay-actions-bar">
            <button
              className="auth-btn"
              onClick={handleSave}
              disabled={isSaving}
              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            >
              {isSaving ? 'Publishing...' : 'Publish Relay List'}
            </button>
          </div>
        )}
      </div>

      <div className="relay-grid" role="list">
        {relays.length === 0 && (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--ns-color-text-muted)',
              gridColumn: '1 / -1'
            }}
            role="status"
            aria-live="polite"
          >
            <p style={{ marginBottom: '0.75rem' }}>No relays configured yet.</p>
            <p style={{ fontSize: '0.9rem' }}>
              Add your first relay to connect to the Nostr network.
            </p>
          </div>
        )}
        {relays.map((relay) => {
          const info = relay.info;
          const limitations = info?.limitation;
          const nips = info?.supported_nips ?? [];
          const flags = [
            limitations?.auth_required ? 'AUTH' : null,
            limitations?.payment_required ? 'PAY' : null,
            limitations?.restricted_writes ? 'RW' : 'WRITE'
          ].filter(Boolean) as string[];
          const hasInfo = Boolean(info);
          return (
            <article key={relay.url} className={`relay-card relay-${relay.status}`} role="listitem">
              <div className="relay-card-header">
                <div className="relay-title">
                  <span
                    className={`relay-status-dot ${relay.status}`}
                    role="status"
                    aria-label={`Relay status: ${relay.status}`}
                  >
                    <span className="relay-status-label">{relay.status.toUpperCase()}</span>
                  </span>
                  <div>
                    <div className="relay-host">{relay.host}</div>
                    <div className="relay-url">{relay.url}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {relay.isUserRelay && (
                    <button
                      className="action-btn"
                      style={{
                        padding: 'var(--ns-space-2) var(--ns-space-3)',
                        fontSize: '0.7rem',
                        minHeight: '24px'
                      }}
                      onClick={() => removeRelay(relay.url)}
                      title="Remove from my list"
                      aria-label={`Remove ${relay.host} from my relay list`}
                    >
                      Remove
                    </button>
                  )}
                  <div className="relay-latency">
                    {relay.status === 'online' ? `${relay.latencyMs ?? 0} ms` : '—'}
                  </div>
                </div>
              </div>

              <div className="relay-meta">
                <span>{info?.name ?? relay.host}</span>
                {relay.lastChecked && (
                  <span>
                    Checked {new Date(relay.lastChecked).toLocaleTimeString([], { hour12: false })}
                  </span>
                )}
              </div>

              <div className="relay-kv-grid">
                <div className="relay-kv">
                  <span>Software</span>
                  <strong>{formatSoftware(info?.software, info?.version)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Pubkey</span>
                  <strong>{info?.pubkey ? `${info.pubkey.slice(0, 10)}…` : '—'}</strong>
                </div>
                <div className="relay-kv">
                  <span>Connections</span>
                  <strong>{formatNumber(info?.limitation?.max_subscriptions)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Max Msg</span>
                  <strong>{formatBytes(info?.limitation?.max_message_length)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Filters</span>
                  <strong>{formatNumber(info?.limitation?.max_filters)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Retention</span>
                  <strong>{formatRetention(info?.retention)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Admission</span>
                  <strong>{summarizeFee(info?.fees?.admission)}</strong>
                </div>
                <div className="relay-kv">
                  <span>Publish</span>
                  <strong>{summarizeFee(info?.fees?.publication)}</strong>
                </div>
              </div>

              <div className="relay-badges">
                {flags.map((flag) => (
                  <span key={flag} className="relay-badge relay-badge--flag">
                    {flag}
                  </span>
                ))}
                {!flags.length && <span className="relay-badge relay-badge--flag">OPEN</span>}
                {nips.slice(0, 8).map((nip) => (
                  <span key={nip} className="relay-badge">
                    NIP-{nip}
                  </span>
                ))}
                {nips.length > 8 && (
                  <span className="relay-badge relay-badge--muted">+{nips.length - 8}</span>
                )}
              </div>

              {info?.description && <p className="relay-description">{info.description}</p>}

              {(!hasInfo && relay.infoError) || relay.error ? (
                <Alert
                  tone="danger"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginTop: 'auto' }}
                >
                  {relay.infoError && <div>NIP-11: {relay.infoError}</div>}
                  {relay.error && <div>WS: {relay.error}</div>}
                </Alert>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

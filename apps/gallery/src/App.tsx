import {
  applyNostrstackTheme,
  autoMount,
  createNostrstackBrandTheme,
  mountCommentWidget,
  mountTipWidget,
  type NostrstackBrandPreset,
  nostrstackBrandPresets,
  resolvePayWsUrl,
  themeToCss,
  themeToCssVars
} from '@nostrstack/embed';
import type { Event as NostrEvent, EventTemplate } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardForm } from './admin/DashboardForm';
import { CommentsPanel, type LiveActivityItem } from './comments/CommentsPanel';
import { CopyButton } from './CopyButton';
import { FaucetButton } from './FaucetButton';
import { InvoicePopover } from './InvoicePopover';
import { LogViewer } from './LogViewer';
import { NostrProfileCard } from './NostrProfileCard';
import { PayToUnlockCard } from './PayToUnlockCard';
import { QrLabCard } from './QrLabCard';
import { ShareWidget } from './ShareWidget';
import { BlockList } from './TelemetryCard';
import { layout } from './tokens';
import type { RelayStats } from './types/relay';
import { JsonView } from './ui/JsonView';
import { WalletBalance } from './WalletBalance';
import { WalletPanel } from './WalletPanel';

type RelayInfo = { relays: string[]; mode: 'real' };
type Health = {
  label: string;
  status: 'ok' | 'fail' | 'error' | 'skipped' | 'unknown';
  detail?: string;
};
type ProfileMeta = {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  display_name?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
};
type ThemeStyles = {
  background: string;
  card: string;
  inset: string;
  text: string;
  color: string;
  muted: string;
  borderColor: string;
  accent: string;
  shadow: string;
};

type DemoTabKey = 'lightning' | 'nostr' | 'logs' | 'admin';

const DEMO_TABS: { key: DemoTabKey; label: string }[] = [
  { key: 'lightning', label: 'Lightning' },
  { key: 'nostr', label: 'Nostr' },
  { key: 'logs', label: 'Logs' },
  { key: 'admin', label: 'Admin (React 19)' }
];

function demoTabId(tab: DemoTabKey) {
  return `demo-tab-${tab}`;
}

function demoPanelId(tab: DemoTabKey) {
  return `demo-panel-${tab}`;
}

const demoHost = import.meta.env.VITE_NOSTRSTACK_HOST ?? 'localhost';
function normalizeApiBase(raw: string) {
  const trimmed = raw.trim().replace(/\/$/, '');
  // Back-compat: older dev setup used Vite's /api prefix as "api base".
  if (trimmed === '/api') return '';
  return trimmed;
}

const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL ?? '');
const networkLabel = import.meta.env.VITE_NETWORK ?? 'regtest';
const relaysEnvRaw = import.meta.env.VITE_NOSTRSTACK_RELAYS;
const relaysEnvDefault = relaysEnvRaw
  ? relaysEnvRaw
      .split(',')
      .map((r: string) => r.trim())
      .filter(Boolean)
  : ['wss://relay.damus.io'];
const lnbitsUrlRaw = import.meta.env.VITE_LNBITS_URL ?? 'http://localhost:15001';
const lnbitsAdminKey = import.meta.env.VITE_LNBITS_ADMIN_KEY ?? 'set-me';
const lnbitsReadKeyEnv =
  (import.meta.env as Record<string, string | undefined>).VITE_LNBITS_READ_KEY ?? '';
const lnbitsWalletIdEnv =
  (import.meta.env as Record<string, string | undefined>).VITE_LNBITS_WALLET_ID ?? '';
const RELAY_STORAGE_KEY = 'nostrstack.relays';

const relayMetaDefault: RelayStats = relaysEnvDefault.reduce((acc: RelayStats, r: string) => {
  acc[r] = { recv: 0 };
  return acc;
}, {});

function bumpRecv(stat: RelayStats[string] | undefined, now: number): RelayStats[string] {
  const history = (stat?.recvHistory ?? []).filter((h) => now - h.ts <= 60000);
  history.unshift({ ts: now });
  const recvPerMin = history.length;
  return {
    ...stat,
    recv: (stat?.recv ?? 0) + 1,
    last: now,
    recvHistory: history.slice(0, 120),
    recvPerMin
  };
}

function bumpSend(stat: RelayStats[string] | undefined, now: number): RelayStats[string] {
  const history = (stat?.sendHistory ?? []).filter((h) => now - h.ts <= 60000);
  history.unshift({ ts: now });
  const sendPerMin = history.length;
  return {
    recv: stat?.recv ?? 0,
    ...stat,
    send: (stat?.send ?? 0) + 1,
    lastSentAt: now,
    sendHistory: history.slice(0, 120),
    sendPerMin
  };
}

function bumpError(stat: RelayStats[string] | undefined, now: number, message?: string): RelayStats[string] {
  return {
    recv: stat?.recv ?? 0,
    ...stat,
    errorCount: (stat?.errorCount ?? 0) + 1,
    lastError: message ?? stat?.lastError,
    lastEvent: message
      ? { ts: now, direction: 'error', label: 'Error', sublabel: message, payload: { message } }
      : stat?.lastEvent
  };
}

function resolveLogStreamUrl(base: string) {
  const trimmed = base.replace(/\/$/, '');
  return trimmed ? `${trimmed}/logs/stream` : '/logs/stream';
}

function resolveTelemetryWs(base: string) {
  const loc = typeof window !== 'undefined' ? window.location : null;
  if (loc) {
    const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${loc.host}/ws/telemetry`;
  }

  // Fallback for SSR/CLI contexts: derive from provided base
  try {
    const apiUrl = new URL(base);
    const scheme = apiUrl.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${apiUrl.host}/ws/telemetry`;
  } catch {
    return 'wss://localhost:4173/ws/telemetry';
  }
}

function normalizeUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `http:${url}`;
  if (url.startsWith(':')) return `http://localhost${url}`;
  return `http://${url}`;
}

function Card({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="nostrstack-card nostrstack-gallery-card">
      <header className="nostrstack-gallery-card__head">
        <h2>{title}</h2>
        {actions ? <div className="nostrstack-gallery-card__actions">{actions}</div> : null}
      </header>
      {subtitle ? <div className="nostrstack-gallery-card__subtitle">{subtitle}</div> : null}
      {children}
    </section>
  );
}

export type PillTone = 'info' | 'success' | 'warn' | 'danger' | 'muted';

export function Pill({
  label,
  value,
  tone = 'info'
}: {
  label: string;
  value: string;
  tone?: PillTone;
}) {
  const toneColor: Record<PillTone, string> = {
    info: 'var(--nostrstack-color-info)',
    success: 'var(--nostrstack-color-success)',
    warn: 'var(--nostrstack-color-warning)',
    danger: 'var(--nostrstack-color-danger)',
    muted: 'var(--nostrstack-color-text-subtle)'
  };
  const toneVar = toneColor[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.3rem 0.6rem',
        borderRadius: 999,
        border: `1px solid color-mix(in oklab, ${toneVar} 30%, var(--nostrstack-color-border))`,
        background: 'color-mix(in oklab, var(--nostrstack-color-surface) 92%, transparent)',
        color: 'var(--nostrstack-color-text)',
        boxShadow: 'none'
      }}
    >
      <span
        style={{
          fontSize: '0.65rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--nostrstack-color-text-subtle)',
          fontWeight: 800
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{value}</span>
    </span>
  );
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}

function parseRelays(input: string): string[] {
  return input
    .split(',')
    .map((r: string) => r.trim())
    .filter(Boolean);
}

function compactRelaysLabel(relays: string, max = 32) {
  if (relays.length <= max) return relays;
  return `${relays.slice(0, max)}…`;
}

function isRelayUrl(url: string) {
  return /^wss?:\/\//.test(url);
}

function uniqueRelays(relays: string[]) {
  return Array.from(new Set(relays.filter(Boolean)));
}

function mergeRelays(prev: string[], next: string[]) {
  const merged = uniqueRelays([...prev, ...next]);
  if (merged.length === prev.length && merged.every((v, i) => v === prev[i])) return prev;
  return merged;
}

type NostrRelayInfo = { read?: boolean; write?: boolean };
type NostrWithRelays = typeof window.nostr & {
  getRelays?: () => Promise<Record<string, NostrRelayInfo>>;
};

async function verifyNip05(nip05: string, pubkey: string): Promise<boolean> {
  try {
    const [name, domain] = nip05.split('@');
    if (!name || !domain) return false;
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const body = await res.json();
    return body.names?.[name]?.toLowerCase() === pubkey.toLowerCase();
  } catch {
    return false;
  }
}

function nip11Url(url: string) {
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

function useMountWidgets(
  username: string,
  amount: number,
  setRelayStats: React.Dispatch<React.SetStateAction<RelayStats>>,
  relaysList: string[],
  tab: DemoTabKey,
  pushActivity?: (item: LiveActivityItem) => void
) {
  useEffect(() => {
    const tipHost = document.getElementById('tip-container');
    const tipCompactHost = document.getElementById('tip-compact-container');
    const commentsHost = document.getElementById('comments-container');
    const timeouts: number[] = [];

    if (tipHost) tipHost.innerHTML = '';
    if (tipCompactHost) tipCompactHost.innerHTML = '';
    if (commentsHost) commentsHost.innerHTML = '';

    const tipItemId = 'gallery-demo-item';
    const tipOpts: Record<string, unknown> = {
      username,
      itemId: tipItemId,
      presetAmountsSats: [amount, Math.max(1, amount * 2), Math.max(1, amount * 5)],
      defaultAmountSats: amount,
      baseURL: apiBase,
      host: demoHost,
      metadata: { ui: 'gallery', itemTitle: 'nostrstack demo', itemUrl: typeof window !== 'undefined' ? window.location.href : undefined }
    };
    if (tipHost) timeouts.push(window.setTimeout(() => mountTipWidget(tipHost, tipOpts), 50));
    if (tipCompactHost) {
      timeouts.push(
        window.setTimeout(
          () => mountTipWidget(tipCompactHost, { ...tipOpts, size: 'compact', text: 'Tip (compact)' }),
          50
        )
      );
    }

    if (commentsHost) {
      const relays = relaysList.length ? relaysList : relaysEnvDefault;

      mountCommentWidget(commentsHost, {
        threadId: 'demo-thread',
        relays,
        onRelayInfo: (info: RelayInfo) => {
          const active = info.relays.length ? info.relays : relaysEnvDefault;
          setRelayStats((prev) => {
            const next = { ...prev };
            active.forEach((r: string) => {
              next[r] = { ...(next[r] ?? { recv: 0 }), sendStatus: 'ok' };
            });
            return next;
          });
        },
        onEvent: (ev: { id?: string; pubkey?: string; created_at?: number; kind?: number; content?: string }, relay?: string) => {
          const now = Date.now();
          const relayLabel = relay || 'nostr';
          const content = typeof ev?.content === 'string' ? ev.content : '';
          const kind = typeof ev?.kind === 'number' ? ev.kind : undefined;
          const pubkey = typeof ev?.pubkey === 'string' ? ev.pubkey : undefined;
          const shortPubkey = pubkey ? `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}` : '—';
          const label = content || (kind != null ? `kind ${kind} event` : 'nostr event');
          const sublabel = [kind != null ? `kind ${kind}` : null, pubkey ? `pubkey ${shortPubkey}` : null]
            .filter(Boolean)
            .join(' · ');
          const id = ev?.id ? `nostr-${relayLabel}-${ev.id}` : `nostr-${relayLabel}-${pubkey ?? 'pk'}-${ev.created_at ?? now}-${now}`;
          pushActivity?.({
            id,
            ts: now,
            relay: relayLabel,
            direction: 'recv',
            label,
            sublabel,
            payload: { relay: relayLabel, event: ev }
          });
          const targets = relay ? [relay] : relays.length ? relays : relaysEnvDefault;
          setRelayStats((prev: RelayStats) => {
            const next = { ...prev };
            targets.forEach((relay: string) => {
              next[relay] = {
                ...bumpRecv(next[relay], now),
                sendStatus: 'ok',
                lastEvent: {
                  ts: now,
                  direction: 'recv',
                  label,
                  sublabel,
                  payload: { relay, event: ev }
                }
              };
            });
            return next;
          });
        }
      });
    }

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [username, amount, relaysList, tab, pushActivity]);
}

export default function App() {
  const [username, setUsername] = useState('alice');
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandPreset, setBrandPreset] = useState<NostrstackBrandPreset>('default');
  const [themeExportSelector, setThemeExportSelector] = useState('.nostrstack-theme');
  const [relaysCsv, setRelaysCsv] = useState(relaysEnvDefault.join(','));
  const [relaysList, setRelaysList] = useState<string[]>(relaysEnvDefault);
  const [realInvoice, setRealInvoice] = useState<string | null>(null);
  const [realBusy, setRealBusy] = useState(false);
  const [realInvoiceLastRequestBody, setRealInvoiceLastRequestBody] = useState<unknown | null>(null);
  const [realInvoiceLastResponse, setRealInvoiceLastResponse] = useState<unknown | null>(null);
  const [qrInvoice, setQrInvoice] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [qrAmount, setQrAmount] = useState<number | undefined>(undefined);
  const [qrStatus, setQrStatus] = useState<'pending' | 'paid' | 'error'>('pending');
  const [tab, setTab] = useState<DemoTabKey>('lightning');
  const [network] = useState(networkLabel);
  const [relayStats, setRelayStats] = useState<RelayStats>(relayMetaDefault);
  const [activity, setActivity] = useState<LiveActivityItem[]>([]);
  const [lnbitsUrlOverride, setLnbitsUrlOverride] = useState<string | null>(null);
  const [lnbitsKeyOverride, setLnbitsKeyOverride] = useState<string | null>(null);
  const [lnbitsReadKeyOverride, setLnbitsReadKeyOverride] = useState<string | null>(null);
  const [lnbitsWalletIdOverride, setLnbitsWalletIdOverride] = useState<string | null>(null);
  const [telemetryWsOverride, setTelemetryWsOverride] = useState<string | null>(null);
  const [payerInvoice, setPayerInvoice] = useState('');
  const [payerStatus, setPayerStatus] = useState<'idle' | 'paying' | 'paid' | 'error'>('idle');
  const [payerMessage, setPayerMessage] = useState<string | null>(null);
  const [payerLastRequestBody, setPayerLastRequestBody] = useState<unknown | null>(null);
  const [payerLastResponse, setPayerLastResponse] = useState<unknown | null>(null);
  const [payWsState, setPayWsState] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const [health, setHealth] = useState<Health[]>([
    { label: 'API', status: 'unknown' },
    { label: 'LNbits', status: 'unknown' }
  ]);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const tabRefs = useRef<Record<DemoTabKey, HTMLButtonElement | null>>({
    lightning: null,
    nostr: null,
    logs: null,
    admin: null
  });
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const order = DEMO_TABS.map((t) => t.key);
      const current = (e.currentTarget.dataset.tab as DemoTabKey | undefined) ?? tab;
      const idx = order.indexOf(current);
      if (idx === -1) return;

      const nextIndex = (() => {
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            return (idx + 1) % order.length;
          case 'ArrowLeft':
          case 'ArrowUp':
            return (idx - 1 + order.length) % order.length;
          case 'Home':
            return 0;
          case 'End':
            return order.length - 1;
          default:
            return null;
        }
      })();

      if (nextIndex === null) return;
      e.preventDefault();
      const nextTab = order[nextIndex];
      setTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    },
    [tab]
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const adminKeyRef = useRef<HTMLInputElement | null>(null);
  const readKeyRef = useRef<HTMLInputElement | null>(null);
  const walletIdRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Expose helpers for MCP-driven UI testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__setInvoice = setQrInvoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__setInvoiceStatus = setQrStatus;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__setInvoiceAmount = setQrAmount;
    }
  }, []);
  useEffect(() => {
    // clear stale payment state on fresh load to avoid 404 polling spam
    setPaymentRef(null);
    setQrInvoice(null);
    setQrAmount(undefined);
    setQrStatus('pending');
  }, []);

  useEffect(() => {
    const savedPreset =
      typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.brand.preset') : null;
    if (savedPreset && savedPreset in nostrstackBrandPresets) {
      setBrandPreset(savedPreset as NostrstackBrandPreset);
    }
    const savedSelector =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('nostrstack.theme.export.selector')
        : null;
    if (savedSelector) setThemeExportSelector(savedSelector);

    const url =
      typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.url') : null;
    const key =
      typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.key') : null;
    const readKey =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('nostrstack.lnbits.readKey')
        : null;
    const walletId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('nostrstack.lnbits.walletId.manual')
        : null;
    if (url) setLnbitsUrlOverride(url);
    if (key) setLnbitsKeyOverride(key);
    if (readKey) setLnbitsReadKeyOverride(readKey);
    if (walletId) setLnbitsWalletIdOverride(walletId);
    else if (lnbitsWalletIdEnv) setLnbitsWalletIdOverride(lnbitsWalletIdEnv);
    const tws =
      typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.telemetry.ws') : null;
    if (tws) setTelemetryWsOverride(tws);
  }, []);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    applyNostrstackTheme(el, createNostrstackBrandTheme({ preset: brandPreset, mode: theme }));
  }, [brandPreset, theme]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = themeExportSelector.trim();
    if (!next) window.localStorage.removeItem('nostrstack.theme.export.selector');
    else window.localStorage.setItem('nostrstack.theme.export.selector', next);
  }, [themeExportSelector]);

  const themeExport = useMemo(() => {
    const selector = themeExportSelector.trim() || '.nostrstack-theme';
    const light = createNostrstackBrandTheme({ preset: brandPreset, mode: 'light' });
    const dark = createNostrstackBrandTheme({ preset: brandPreset, mode: 'dark' });
    const cssLight = themeToCss(light, selector);
    const cssDark = themeToCss(dark, selector);
    const varsJson = JSON.stringify(
      themeToCssVars(createNostrstackBrandTheme({ preset: brandPreset, mode: theme })),
      null,
      2
    );
    return {
      selector,
      cssLight,
      cssDark,
      cssBoth: `${cssLight}${cssDark}`,
      varsJson
    };
  }, [brandPreset, theme, themeExportSelector]);
  const [activePubkey, setActivePubkey] = useState<string | null>(null);
  const [signerReady, setSignerReady] = useState(false);
  const [signerRelays, setSignerRelays] = useState<string[]>([]);
  const [profile, setProfile] = useState<ProfileMeta | null>(null);
  const [profileMetaEvent, setProfileMetaEvent] = useState<{ event: NostrEvent; relay: string } | null>(null);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [nip05Verified, setNip05Verified] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>('Hello from nostrstack demo 👋');
  const [lastNoteResult, setLastNoteResult] = useState<string | null>(null);
  const [lastNoteOk, setLastNoteOk] = useState(false);

  const profileRelays = useMemo(() => {
    const preferred = signerRelays.filter(isRelayUrl);
    const configured = relaysList.filter(isRelayUrl);
    const defaults = relaysEnvDefault.filter(isRelayUrl);
    const merged = uniqueRelays([...preferred, ...configured, ...defaults]);
    return merged.length ? merged : ['wss://relay.damus.io'];
  }, [signerRelays, relaysList]);

  // Reset NIP-05 status whenever a new profile load starts
  useEffect(() => {
    setNip05Verified(null);
    setProfile(null);
    setProfileMetaEvent(null);
    setProfileStatus('idle');
  }, [activePubkey]);

  useEffect(() => {
    const saved =
      typeof window !== 'undefined' ? window.localStorage.getItem(RELAY_STORAGE_KEY) : null;
    if (saved) setRelaysCsv(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const list = relaysCsv ? parseRelays(relaysCsv) : relaysEnvDefault;
    setRelaysList(list);
    if (relaysCsv) window.localStorage.setItem(RELAY_STORAGE_KEY, relaysCsv);
    else window.localStorage.removeItem(RELAY_STORAGE_KEY);
  }, [relaysCsv]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchMeta = async (relay: string) => {
      try {
        const res = await fetch(nip11Url(relay), {
          headers: { Accept: 'application/nostr+json' },
          signal: controller.signal
        });
        if (!res.ok) return;
        const body = await res.json();
        const limitation = body.limitation ?? {};
        const supportedNips: number[] | undefined = Array.isArray(body.supported_nips)
          ? body.supported_nips
          : Array.isArray(body.supports_nips)
            ? body.supports_nips
            : undefined;
        setRelayStats((prev) => ({
          ...prev,
          [relay]: {
            ...(prev[relay] ?? { recv: 0 }),
            name: body.name,
            description: body.description,
            software: body.software,
            version: body.version,
            supportedNips,
            contact: body.contact,
            pubkey: body.pubkey,
            icon: body.icon,
            paymentsUrl: body.payments_url,
            language: (body.language_tags?.[0] as string | undefined) ?? body.language,
            tags: Array.isArray(body.tags) ? body.tags.slice(0, 8) : prev[relay]?.tags,
            limitation,
            paymentRequired: limitation.payment_required ?? prev[relay]?.paymentRequired,
            authRequired: limitation.auth_required ?? prev[relay]?.authRequired,
            updatedAt: Date.now()
          }
        }));
      } catch {
        // ignore fetch errors / CORS
      }
    };
    relaysList.filter(isRelayUrl).forEach(fetchMeta);
    return () => controller.abort();
  }, [relaysList]);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const sample = relaysList.filter(isRelayUrl).slice(0, 3);
      await Promise.all(
        sample.map(async (url) => {
          try {
            const started = performance.now();
            const relay = await Relay.connect(url);
            const latencyMs = Math.round(performance.now() - started);
            if (cancelled) {
              try {
                relay.close();
              } catch {
                /* ignore */
              }
              return;
            }
            setRelayStats((prev) => ({
              ...prev,
              [url]: {
                ...(prev[url] ?? { recv: 0 }),
                sendStatus: 'ok',
                online: true,
                latencyMs,
                lastProbeAt: Date.now()
              }
            }));
            try {
              relay.close();
            } catch {
              /* ignore */
            }
          } catch {
            if (cancelled) return;
            setRelayStats((prev) => ({
              ...prev,
              [url]: {
                ...(prev[url] ?? { recv: 0 }),
                sendStatus: 'error',
                online: false,
                latencyMs: undefined,
                lastProbeAt: Date.now()
              }
            }));
          }
        })
      );
    };
    probe();
    const id = window.setInterval(probe, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [relaysList]);

  useEffect(() => {
    autoMount();
  }, []);

  const loadSignerRelays = useCallback(async (): Promise<string[]> => {
    if (typeof window === 'undefined') return [];
    const nostr = window.nostr as NostrWithRelays | undefined;
    if (!nostr?.getRelays) return [];
    try {
      const relays = await nostr.getRelays();
      if (!relays || typeof relays !== 'object') return [];
      return Object.entries(relays)
        .filter(([, info]) => !!(info?.read || info?.write))
        .map(([url]) => url)
        .filter(isRelayUrl);
    } catch {
      return [];
    }
  }, []);

  const fetchProfile = useCallback(
    async (pk: string) => {
      if (!pk) return;
      const targets = profileRelays.filter(isRelayUrl).slice(0, 4);
      if (!targets.length) return;
      setProfileStatus('loading');
      setNip05Verified(null);
      setProfileMetaEvent(null);
      try {
        const fetchFromRelay = async (target: string) => {
          const relay = await Relay.connect(target);
          return await new Promise<{ metaEv: NostrEvent | null; relayEv: NostrEvent | null }>(
            (resolve) => {
              let metaEv: NostrEvent | null = null;
              let relayEv: NostrEvent | null = null;
              let done = false;
              let sub: { close: (reason?: string) => void } | null = null;
              const finish = (reason: string) => {
                if (done) return;
                done = true;
                try {
                  sub?.close(reason);
                } catch {
                  /* ignore */
                }
                try {
                  relay.close();
                } catch {
                  /* ignore */
                }
                resolve({ metaEv, relayEv });
              };

              const timeoutId = window.setTimeout(() => finish('timeout'), 2400);
              sub = relay.subscribe([{ kinds: [0, 10002], authors: [pk], limit: 2 }], {
                eoseTimeout: 1400,
                onevent: (ev: NostrEvent) => {
                  if (ev.kind === 0 && !metaEv) metaEv = ev;
                  if (ev.kind === 10002 && !relayEv) relayEv = ev;
                },
                oneose: () => {
                  window.clearTimeout(timeoutId);
                  finish('eose');
                }
              });
            }
          );
        };

        let metaEv: NostrEvent | null = null;
        let relayEv: NostrEvent | null = null;
        let metaRelay: string | null = null;
        for (const target of targets) {
          try {
            const res = await fetchFromRelay(target);
            if (!metaEv && res.metaEv) {
              metaEv = res.metaEv;
              metaRelay = target;
            }
            if (!relayEv && res.relayEv) relayEv = res.relayEv;
            if (metaEv) break;
          } catch {
            // ignore relay fetch failures
          }
        }

        let meta: ProfileMeta = {};
        if (metaEv?.content) {
          try {
            meta = JSON.parse(metaEv.content ?? '{}') as ProfileMeta;
          } catch {
            meta = {};
          }
        }
        setProfile(meta);
        if (metaEv && metaRelay) setProfileMetaEvent({ event: metaEv, relay: metaRelay });
        setProfileStatus('ok');
        const nip05 = typeof meta.nip05 === 'string' ? meta.nip05 : null;
        if (nip05) {
          verifyNip05(nip05, pk)
            .then(setNip05Verified)
            .catch(() => setNip05Verified(false));
        } else {
          setNip05Verified(null);
        }

        const relayTags =
          relayEv?.tags
            ?.filter?.((t: string[]) => t[0] === 'r' && t[1])
            .map((t: string[]) => t[1])
            .filter(isRelayUrl) ?? [];
        if (relayTags.length) setSignerRelays((prev) => mergeRelays(prev, relayTags));
      } catch (err) {
        console.warn('profile fetch failed', err);
        setProfileStatus('error');
        setNip05Verified(null);
      }
    },
    [profileRelays]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      if (cancelled || !window.nostr?.getPublicKey) return;
      attempts += 1;
      try {
        const pk = await window.nostr.getPublicKey();
        if (cancelled) return;
        setActivePubkey(pk);
        setSignerReady(true);
        loadSignerRelays().then((urls) => {
          if (!cancelled && urls.length) setSignerRelays((prev) => mergeRelays(prev, urls));
        });
      } catch (err) {
        if (!cancelled) console.warn('failed to read window.nostr pubkey', err);
      }
    };

    const id = window.setInterval(() => {
      if (activePubkey || attempts >= 3) return;
      load();
    }, 1200);

    load();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activePubkey, loadSignerRelays]);

  useEffect(() => {
    if (activePubkey) fetchProfile(activePubkey);
  }, [activePubkey, fetchProfile]);

  const handleSendNote = useCallback(async () => {
    try {
      setLastNoteResult(null);
      setLastNoteOk(false);
      if (!signerReady) {
        setLastNoteResult('No NIP-07 signer detected');
        return;
      }
      const relay = profileRelays[0] ?? 'wss://relay.damus.io';
      const template: EventTemplate & { pubkey: string } = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: message || 'nostrstack ping',
        pubkey: activePubkey ?? ''
      };
      const sendingAt = Date.now();
      setRelayStats((prev) => ({
        ...prev,
        [relay]: {
          ...(prev[relay] ?? { recv: 0 }),
          sendStatus: 'sending',
          lastSentAt: sendingAt,
          lastEvent: {
            ts: sendingAt,
            direction: 'send',
            label: 'Sending…',
            sublabel: `kind ${template.kind}`,
            payload: { relay, event: template }
          }
        }
      }));
      const signed = (await window.nostr!.signEvent(template)) as NostrEvent;
      const r = await Relay.connect(relay);
      await r.publish(signed);
      try {
        r.close();
      } catch {
        /* ignore */
      }
      const sentAt = Date.now();
      setRelayStats((prev) => ({
        ...prev,
        [relay]: {
          ...bumpSend(prev[relay], sentAt),
          sendStatus: 'ok',
          lastEvent: {
            ts: sentAt,
            direction: 'send',
            label: signed.content || 'sent note',
            sublabel: `kind ${signed.kind} · pubkey ${signed.pubkey.slice(0, 8)}…${signed.pubkey.slice(-4)}`,
            payload: { relay, event: signed }
          }
        }
      }));
      setActivity((prev) =>
        [
          {
            id: `send-${relay}-${signed.id ?? signed.created_at}-${Date.now()}`,
            ts: Date.now(),
            relay,
            direction: 'send' as const,
            label: signed.content || 'sent note',
            sublabel: `kind ${signed.kind} · pubkey ${signed.pubkey.slice(0, 8)}…${signed.pubkey.slice(-4)}`,
            payload: { relay, event: signed }
          },
          ...prev
        ].slice(0, 60)
      );
      setLastNoteOk(true);
      setLastNoteResult(`Published note to ${relay}`);
    } catch (err) {
      const relay = profileRelays[0] ?? 'wss://relay.damus.io';
      const msg = err instanceof Error ? err.message : String(err);
      const erroredAt = Date.now();
      setRelayStats((prev) => ({
        ...prev,
        [relay]: {
          ...bumpError(prev[relay], erroredAt, msg),
          sendStatus: 'error',
          lastSentAt: erroredAt,
          lastEvent: {
            ts: erroredAt,
            direction: 'error',
            label: 'Send failed',
            sublabel: msg,
            payload: err instanceof Error ? { message: err.message, stack: err.stack } : err
          }
        }
      }));
      setLastNoteOk(false);
      setLastNoteResult(msg);
      setActivity((prev) =>
        [
          {
            id: `send-error-${relay}-${Date.now()}`,
            ts: Date.now(),
            relay,
            direction: 'send' as const,
            label: 'Send failed',
            sublabel: err instanceof Error ? err.message : String(err),
            payload: err instanceof Error ? { message: err.message, stack: err.stack } : err
          },
          ...prev
        ].slice(0, 60)
      );
    }
  }, [signerReady, activePubkey, profileRelays, message]);

  const pollPayment = useCallback(async () => {
    if (!paymentRef) return;
    try {
      const res = await fetch(
        `${apiBase.replace(/\/$/, '')}/api/lnurlp/pay/status/${encodeURIComponent(paymentRef)}?domain=${encodeURIComponent(demoHost)}`
      );
      if (res.ok) {
        const body = await res.json();
        if (
          ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED', 'PAID'].includes(
            String(body.status || '').toUpperCase()
          )
        ) {
          setQrStatus('paid');
        }
      } else if (res.status === 404) {
        // stop polling if provider no longer knows about this ref
        setPaymentRef(null);
        setQrStatus('pending');
        setQrInvoice(null);
      }
    } catch {
      /* ignore */
    }
  }, [apiBase, paymentRef, qrInvoice]);

  useEffect(() => {
    if (!qrInvoice) return;
    const wsUrl = resolvePayWsUrl(apiBase);
    const ws = wsUrl ? new WebSocket(wsUrl) : null;
    const pr = qrInvoice;
    const ref = paymentRef;
    if (ws) {
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            pr?: string;
            providerRef?: string;
            status?: string;
          };
          if (
            (msg.type === 'invoice-paid' ||
              (msg.type === 'invoice-status' &&
                ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'].includes(
                  String(msg.status || '').toUpperCase()
                ))) &&
            ((msg.pr && msg.pr === pr) || (ref && msg.providerRef && msg.providerRef === ref))
          ) {
            setQrStatus('paid');
          }
        } catch {
          // ignore malformed frames
        }
      };
    }
    // quick first poll (in case payment already happened)
    pollPayment();
    const pollId = paymentRef ? window.setInterval(pollPayment, 1500) : null;
    return () => {
      if (ws) {
        // Avoid InvalidStateError: WebSocket is already in CLOSING or CLOSED state.
        if (ws.readyState === WebSocket.CONNECTING) {
          const pending = ws;
          pending.onopen = () => {
            try {
              if (pending.readyState === WebSocket.OPEN) pending.close();
            } catch {
              /* ignore */
            }
          };
          pending.onmessage = null;
          pending.onerror = null;
          pending.onclose = null;
        } else {
          try {
            if (ws.readyState === WebSocket.OPEN) ws.close();
          } catch {
            /* ignore */
          }
        }
      }
      if (pollId) window.clearInterval(pollId);
    };
  }, [qrInvoice, apiBase, paymentRef, pollPayment]);

  useEffect(() => {
    const fetchHealth = async () => {
      // always check against real API
      const results: Health[] = [];
      try {
        const apiRes = await fetch(`${apiBase}/health`);
        results.push({
          label: 'API',
          status: apiRes.ok ? 'ok' : 'fail',
          detail: `http ${apiRes.status}`
        });
      } catch (err) {
        results.push({ label: 'API', status: 'error', detail: formatError(err) });
      }
      try {
        const lnRes = await fetch(`${apiBase}/health/lnbits`);
        const body = await lnRes.json();
        results.push({
          label: 'LNbits',
          status: body.status ?? (lnRes.ok ? 'ok' : 'fail'),
          detail: body.reason || body.error || `http ${lnRes.status}`
        });
      } catch (err) {
        results.push({ label: 'LNbits', status: 'error', detail: formatError(err) });
      }
      setHealth(results);
    };
    fetchHealth();
  }, []);
  useMountWidgets(
    username,
    amount,
    setRelayStats,
    relaysList,
    tab,
    useCallback((item: LiveActivityItem) => {
      setActivity((prev) => [item, ...prev].slice(0, 60));
    }, [])
  );

  const themeStyles = useMemo<ThemeStyles>(
    () => ({
      background: 'var(--nostrstack-color-bg)',
      card: 'var(--nostrstack-color-surface)',
      inset: 'var(--nostrstack-color-surface-subtle)',
      text: 'var(--nostrstack-color-text)',
      color: 'var(--nostrstack-color-text)',
      muted: 'var(--nostrstack-color-text-muted)',
      borderColor: 'var(--nostrstack-color-border)',
      accent: 'var(--nostrstack-color-primary)',
      shadow: 'var(--nostrstack-shadow-lg)'
    }),
    []
  );

  const requestRealInvoice = useCallback(async () => {
    setRealBusy(true);
    setRealInvoice(null);
    setQrInvoice(null);
    setPaymentRef(null);
    setQrStatus('pending');
    try {
      const reqBody = {
        domain: demoHost,
        action: 'tip',
        amount: amount,
        metadata: { ui: 'gallery' }
      };
      setRealInvoiceLastRequestBody(reqBody);
      setRealInvoiceLastResponse(null);
      const res = await fetch(`${apiBase}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep raw text
      }
      setRealInvoiceLastResponse({ http: res.status, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const prRaw = bodyObj.payment_request ?? bodyObj.pr;
      const pr = typeof prRaw === 'string' ? prRaw : null;
      setPaymentRef((bodyObj.provider_ref as string | undefined) ?? (bodyObj.providerRef as string | undefined) ?? (bodyObj.payment_hash as string | undefined) ?? null);
      setQrInvoice(pr);
      setQrAmount(amount);
      setQrStatus('pending');
      setRealInvoice(pr || 'invoice unavailable');
    } catch (err: unknown) {
      setRealInvoice(`error: ${formatError(err)}`);
    } finally {
      setRealBusy(false);
    }
  }, [amount]);

  const payWithTestPayer = useCallback(async () => {
    const inv = payerInvoice.trim();
    if (!inv) {
      setPayerStatus('error');
      setPayerMessage('Paste a BOLT11 invoice first');
      return;
    }
    setPayerStatus('paying');
    setPayerMessage(null);
    try {
      const reqBody = { invoice: inv };
      setPayerLastRequestBody(reqBody);
      setPayerLastResponse(null);
      const res = await fetch(`${apiBase}/api/regtest/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep raw text
      }
      setPayerLastResponse({ http: res.status, body });
      const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      if (!res.ok || bodyObj?.ok === false) throw new Error((bodyObj?.error as string | undefined) || `HTTP ${res.status}`);
      setPayerStatus('paid');
      setPayerMessage('Paid via test payer');
      setWalletRefresh((n) => n + 1);
      if (qrInvoice && inv.includes(qrInvoice.slice(0, 12))) setQrStatus('paid');
    } catch (err) {
      setPayerStatus('error');
      setPayerMessage(formatError(err));
    }
  }, [payerInvoice, apiBase, qrInvoice]);

  const walletKeyEnv = (import.meta.env.VITE_LNBITS_ADMIN_KEY ?? '').slice(0, 4)
    ? lnbitsAdminKey
    : '';
  const walletKey = (lnbitsKeyOverride ?? walletKeyEnv) || 'set VITE_LNBITS_ADMIN_KEY';
  const walletReadKey = lnbitsReadKeyOverride ?? lnbitsReadKeyEnv ?? '';
  const walletIdOverride = lnbitsWalletIdOverride ?? (lnbitsWalletIdEnv || undefined);
  const lnbitsUrl = normalizeUrl(lnbitsUrlOverride ?? lnbitsUrlRaw);
  const telemetryWsUrl = telemetryWsOverride ?? resolveTelemetryWs(apiBase);
  const relayLabel = relaysCsv || relaysEnvDefault.join(',');
  const lnbitsHealth = health.find((h) => h.label === 'LNbits') ?? {
    label: 'LNbits',
    status: 'unknown' as const
  };

  return (
    <main
      ref={rootRef}
      className="nostrstack nostrstack-theme nostrstack-gallery"
      data-nostrstack-theme={theme}
    >
      <header className="nostrstack-gallery-shell">
        <div className="nostrstack-gallery-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ marginTop: 0, marginBottom: 0 }}>nostrstack Demo</h1>
            <span className="nostrstack-gallery-network">{network.toUpperCase()}</span>
          </div>
          <p style={{ maxWidth: 780 }}>
            Play with the widgets below. Lightning points at <strong>{demoHost}</strong>; comments
            use the relays you set.
          </p>

          <div
            role="tablist"
            aria-label="Demo sections"
            aria-orientation="horizontal"
            className="nostrstack-gallery-tabs"
          >
            {DEMO_TABS.map((t) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                data-tab={t.key}
                type="button"
                role="tab"
                id={demoTabId(t.key)}
                aria-controls={demoPanelId(t.key)}
                aria-selected={tab === t.key}
                tabIndex={tab === t.key ? 0 : -1}
                className="nostrstack-gallery-tabbtn"
                onClick={() => setTab(t.key)}
                onKeyDown={handleTabKeyDown}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="nostrstack-envbar" style={{ marginBottom: '1rem' }}>
            <Pill label="Host" value={demoHost} tone="info" />
            <Pill label="API" value={apiBase || 'same-origin'} tone="info" />
            <Pill
              label="LNbits"
              value={lnbitsHealth.status}
              tone={
                lnbitsHealth.status === 'ok'
                  ? 'success'
                  : lnbitsHealth.status === 'fail'
                    ? 'warn'
                    : lnbitsHealth.status === 'unknown' || lnbitsHealth.status === 'skipped'
                      ? 'muted'
                      : 'danger'
              }
            />
            <Pill label="Payments" value="real invoices" tone="success" />
            <Pill
              label="Pay WS"
              value={payWsState}
              tone={
                payWsState === 'open' ? 'success' : payWsState === 'connecting' ? 'warn' : 'muted'
              }
            />
            <Pill label="Comments" value="real Nostr" tone="success" />
            <Pill label="Relays" value={compactRelaysLabel(relayLabel)} tone="info" />
          </div>
        </div>
      </header>
      <div className="nostrstack-gallery-content">
        <section
          id={demoPanelId('lightning')}
          role="tabpanel"
          aria-labelledby={demoTabId('lightning')}
          hidden={tab !== 'lightning'}
          className="nostrstack-gallery-tab"
          data-active={tab === 'lightning' ? 'true' : 'false'}
        >
          {tab === 'lightning' && (
            <div className="nostrstack-lightning-layout">
              <div className="nostrstack-lightning-main">
                {paymentRef && (
                  <div className="nostrstack-payref">
                    <button
                      type="button"
                      onClick={pollPayment}
                      className="nostrstack-btn nostrstack-btn--sm"
                    >
                      Recheck payment status
                    </button>
                    <span style={{ color: themeStyles.muted, fontSize: '0.9rem' }}>
                      Ref: <code>{paymentRef.slice(0, 10)}…</code>
                    </span>
                  </div>
                )}

                <Card
                  title="Quick actions"
                  subtitle="Settle demo invoices instantly (regtest)."
                >
                  <div className="nostrstack-action-grid">
                    <div className="nostrstack-action-block">
                      <div className="nostrstack-action-block__head">
                        <strong>Test payer</strong>
                        <span style={{ color: themeStyles.muted, fontSize: '0.9rem' }}>
                          Prefunded LND node paying outbound; use this to settle demo invoices instantly.
                        </span>
                      </div>
                      <div className="nostrstack-action-row">
                        <input
                          className="nostrstack-input"
                          name="payerInvoice"
                          autoComplete="off"
                          style={{ flex: 1, minWidth: 260 }}
                          placeholder="Paste BOLT11"
                          value={payerInvoice}
                          onChange={(e) => setPayerInvoice(e.target.value)}
                        />
                        <button
                          type="button"
                          data-testid="test-payer-pay"
                          onClick={payWithTestPayer}
                          disabled={payerStatus === 'paying'}
                        >
                          {payerStatus === 'paying' ? 'Paying…' : 'Pay with test payer'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const txt = await navigator.clipboard.readText();
                              setPayerInvoice(txt.trim());
                            } catch {
                              setPayerMessage('Clipboard not available');
                            }
                          }}
                        >
                          Paste
                        </button>
                      </div>
                      {payerMessage && (
                        <div
                          className="nostrstack-action-msg"
                          data-tone={payerStatus === 'error' ? 'danger' : 'success'}
                        >
                          {payerMessage}
                        </div>
                      )}
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <JsonView title="Pay request body" value={payerLastRequestBody} maxHeight={140} />
                        <JsonView title="Pay response" value={payerLastResponse} maxHeight={180} />
                      </div>
                    </div>

                    <div className="nostrstack-action-block nostrstack-action-block--fund">
                      <div className="nostrstack-action-block__head">
                        <strong>Fund receiver wallet</strong>
                        <span style={{ color: themeStyles.muted, fontSize: '0.9rem' }}>
                          Mines blocks + opens an outbound channel for spending.
                        </span>
                      </div>
                      <FaucetButton apiBase={apiBase} onFunded={() => setWalletRefresh((n) => n + 1)} />
                    </div>
                  </div>
                </Card>

                <div className="nostrstack-lightning-widgets">
                  <Card
                    title="Tips"
                    subtitle="3 presets + custom amount + live activity."
                  >
                    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                      <div>
                        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Full Size</h4>
                        <div id="tip-container" />
                      </div>
                      <div>
                        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Compact</h4>
                        <div id="tip-compact-container" />
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <button onClick={requestRealInvoice} disabled={realBusy}>
                        {realBusy ? 'Requesting…' : `Request real invoice (${amount} sats)`}
                      </button>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <JsonView title="Create invoice request body" value={realInvoiceLastRequestBody} maxHeight={140} />
                        <JsonView title="Create invoice response" value={realInvoiceLastResponse} maxHeight={180} />
                      </div>
                      {realInvoice && (
                        <div
                          data-testid="real-invoice"
                          style={{ marginTop: '0.6rem', display: 'grid', gap: '0.35rem' }}
                        >
                          <strong>BOLT11</strong>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              background: themeStyles.inset,
                              border: `1px solid ${layout.border}`,
                              borderRadius: 'var(--nostrstack-radius-md)',
                              padding: '0.6rem'
                            }}
                          >
                            {realInvoice}
                          </pre>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <CopyButton text={realInvoice} label="Copy" />
                            <a
                              href={`lightning:${realInvoice}`}
                              className="nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm"
                              style={{ textDecoration: 'none' }}
                            >
                              Open in wallet
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card title="Pay to unlock">
                    <PayToUnlockCard apiBase={apiBase} host={demoHost} amountSats={amount} onPayWsState={setPayWsState} />
                  </Card>
                </div>

                <Card
                  title="QR Lab"
                  subtitle="Design branded QR codes with built-in decode verification + fallback."
                >
                  <QrLabCard suggestedValue={realInvoice} />
                </Card>

                <Card
                  title="Status & build"
                  subtitle={
                    <>
                      Build: <code>{import.meta.env.VITE_APP_COMMIT ?? 'dev'}</code> •{' '}
                      <code>{import.meta.env.VITE_APP_BUILD_TIME ?? 'now'}</code> · Host:{' '}
                      <code>{demoHost}</code> · API base: <code>{apiBase || 'same-origin'}</code>
                    </>
                  }
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.6rem'
                    }}
                  >
                    {health.map((h) => {
                      const color =
                        h.status === 'ok'
                          ? 'var(--nostrstack-color-success)'
                          : h.status === 'unknown' || h.status === 'skipped'
                            ? 'var(--nostrstack-color-text-subtle)'
                            : 'var(--nostrstack-color-danger)';
                      const bg = themeStyles.inset;
                      return (
                        <div
                          key={h.label}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.6rem 0.75rem',
                            borderRadius: 'var(--nostrstack-radius-md)',
                            background: bg,
                            border: `1px solid ${themeStyles.borderColor}`
                          }}
                        >
                          <span
                            className={h.status === 'ok' ? 'status-dot pulse' : 'status-dot'}
                            style={{ width: 12, height: 12, borderRadius: 999, background: color }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 700 }}>{h.label}</span>
                            <span style={{ fontSize: '0.9rem', color: themeStyles.muted }}>
                              {h.status}
                              {h.detail ? ` – ${h.detail}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card title="Telemetry" subtitle="Live telemetry feed over WebSocket.">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 280 }}>
                      <span style={{ fontSize: '0.9rem', color: themeStyles.muted }}>
                        Telemetry WS override
                      </span>
                      <input
                        className="nostrstack-input"
                        name="telemetryWsOverride"
                        autoComplete="off"
                        defaultValue={telemetryWsOverride ?? ''}
                        placeholder="ws://localhost:4173/api/ws/telemetry"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          setTelemetryWsOverride(v || null);
                          if (typeof window !== 'undefined') {
                            if (v) window.localStorage.setItem('nostrstack.telemetry.ws', v);
                            else window.localStorage.removeItem('nostrstack.telemetry.ws');
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTelemetryWsOverride(null);
                        if (typeof window !== 'undefined')
                          window.localStorage.removeItem('nostrstack.telemetry.ws');
                      }}
                    >
                      Reset WS
                    </button>
                  </div>
                  <BlockList wsUrl={telemetryWsUrl} network={network} />
                </Card>

                <Card
                  title="Theme export"
                  subtitle={
                    <>
                      Copy a stylesheet snippet to apply this brand anywhere. Target a wrapper that has
                      the <code>nostrstack-theme</code> class.
                    </>
                  }
                >
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>CSS selector</span>
                      <input
                        className="nostrstack-input"
                        name="themeExportSelector"
                        autoComplete="off"
                        value={themeExportSelector}
                        onChange={(e) => setThemeExportSelector(e.target.value)}
                        placeholder=".nostrstack-theme"
                      />
                    </label>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <CopyButton text={themeExport.cssBoth} label="Copy CSS (light+dark)" />
                      <CopyButton text={themeExport.cssLight} label="Copy CSS (light)" />
                      <CopyButton text={themeExport.cssDark} label="Copy CSS (dark)" />
                      <CopyButton text={themeExport.varsJson} label="Copy vars (json)" />
                    </div>

                    <div style={{ display: 'grid', gap: '0.35rem' }}>
                      <strong>Preview</strong>
                      <pre
                        className="nostrstack-code"
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 240,
                          overflow: 'auto',
                          background: themeStyles.inset,
                          border: `1px solid ${layout.border}`,
                          borderRadius: 'var(--nostrstack-radius-md)',
                          padding: '0.6rem'
                        }}
                      >
                        {themeExport.cssBoth.trim()}
                      </pre>
                    </div>
                  </div>
                </Card>
              </div>

              <aside className="nostrstack-lightning-side">
                <WalletPanel
                  lnbitsUrl={lnbitsUrl}
                  adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'}
                  visible
                />
                <WalletBalance
                  lnbitsUrl={lnbitsUrl}
                  adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'}
                  readKey={walletReadKey || undefined}
                  walletId={walletIdOverride}
                  apiBase={apiBase}
                  refreshSignal={walletRefresh}
                  onManualRefresh={() => setWalletRefresh((n) => n + 1)}
                  network={networkLabel}
                />

                <Card
                  title="LNbits wallet override"
                  subtitle={
                    <>
                      Example: URL <code>http://localhost:15001</code>, Admin key from LNbits wallet
                      API info, optional Wallet ID for <code>/api/v1/wallet?usr=&lt;id&gt;</code>{' '}
                      fallback.
                    </>
                  }
                >
                  <form
                    style={{ display: 'grid', gap: '0.4rem' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        className="nostrstack-input"
                        name="lnbitsUrlOverride"
                        autoComplete="off"
                        style={{ minWidth: 220, flex: 1 }}
                        placeholder="LNbits URL (e.g. http://localhost:15001)"
                        defaultValue={lnbitsUrlOverride ?? lnbitsUrlRaw}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          setLnbitsUrlOverride(v || null);
                          if (typeof window !== 'undefined') {
                            if (v) window.localStorage.setItem('nostrstack.lnbits.url', v);
                            else window.localStorage.removeItem('nostrstack.lnbits.url');
                          }
                        }}
                      />
                      <input
                        className="nostrstack-input"
                        name="lnbitsAdminKeyOverride"
                        style={{ minWidth: 220, flex: 1 }}
                        placeholder="LNbits admin key"
                        type="password"
                        autoComplete="new-password"
                        ref={adminKeyRef}
                        defaultValue={lnbitsKeyOverride ?? walletKeyEnv}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          setLnbitsKeyOverride(v || null);
                          if (typeof window !== 'undefined') {
                            if (v) window.localStorage.setItem('nostrstack.lnbits.key', v);
                            else window.localStorage.removeItem('nostrstack.lnbits.key');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const txt = await navigator.clipboard.readText();
                            const v = txt.trim();
                            if (adminKeyRef.current) adminKeyRef.current.value = v;
                            setLnbitsKeyOverride(v || null);
                            if (typeof window !== 'undefined') {
                              if (v) window.localStorage.setItem('nostrstack.lnbits.key', v);
                              else window.localStorage.removeItem('nostrstack.lnbits.key');
                            }
                          } catch {
                            // ignore clipboard failures
                          }
                        }}
                      >
                        Paste admin key
                      </button>
                      <input
                        className="nostrstack-input"
                        name="lnbitsReadKeyOverride"
                        style={{ minWidth: 220, flex: 1 }}
                        placeholder="LNbits read key (optional)"
                        type="password"
                        autoComplete="new-password"
                        ref={readKeyRef}
                        defaultValue={lnbitsReadKeyOverride ?? lnbitsReadKeyEnv}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          setLnbitsReadKeyOverride(v || null);
                          if (typeof window !== 'undefined') {
                            if (v) window.localStorage.setItem('nostrstack.lnbits.readKey', v);
                            else window.localStorage.removeItem('nostrstack.lnbits.readKey');
                          }
                        }}
                      />
                      <input
                        className="nostrstack-input"
                        name="lnbitsWalletIdOverride"
                        autoComplete="off"
                        style={{ minWidth: 160, flex: 1 }}
                        placeholder="Wallet ID (for ?usr= fallback)"
                        ref={walletIdRef}
                        defaultValue={lnbitsWalletIdOverride ?? lnbitsWalletIdEnv ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          setLnbitsWalletIdOverride(v || null);
                          if (typeof window !== 'undefined') {
                            if (v) window.localStorage.setItem('nostrstack.lnbits.walletId.manual', v);
                            else window.localStorage.removeItem('nostrstack.lnbits.walletId.manual');
                          }
                        }}
                      />
                      <button type="button" onClick={() => setWalletRefresh((n) => n + 1)}>
                        Save & refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLnbitsUrlOverride(null);
                          setLnbitsKeyOverride(null);
                          setLnbitsReadKeyOverride(null);
                          setLnbitsWalletIdOverride(null);
                          if (typeof window !== 'undefined') {
                            window.localStorage.removeItem('nostrstack.lnbits.url');
                            window.localStorage.removeItem('nostrstack.lnbits.key');
                            window.localStorage.removeItem('nostrstack.lnbits.readKey');
                            window.localStorage.removeItem('nostrstack.lnbits.walletId.manual');
                          }
                          setWalletRefresh((n) => n + 1);
                        }}
                      >
                        Reset to env
                      </button>
                    </div>
                  </form>
                </Card>

                <Card title="Config & presets">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: '0.75rem'
                    }}
                  >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>Username</span>
                      <input
                        className="nostrstack-input"
                        name="username"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>Amount (sats)</span>
                      <input
                        className="nostrstack-input"
                        name="amountSats"
                        type="number"
                        autoComplete="off"
                        min={1}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value) || 1)}
                      />
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>Theme</span>
                      <div
                        role="group"
                        aria-label="Theme"
                        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                      >
                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className="nostrstack-gallery-tabbtn"
                          aria-pressed={theme === 'light'}
                        >
                          Light
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className="nostrstack-gallery-tabbtn"
                          aria-pressed={theme === 'dark'}
                        >
                          Dark
                        </button>
                      </div>
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>Brand</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          className="nostrstack-select"
                          name="brandPreset"
                          value={brandPreset}
                          onChange={(e) => {
                            const v = e.target.value as NostrstackBrandPreset;
                            setBrandPreset(v);
                            if (typeof window !== 'undefined')
                              window.localStorage.setItem('nostrstack.brand.preset', v);
                          }}
                          style={{ flex: 1 }}
                          aria-label="Brand preset"
                        >
                          {Object.entries(nostrstackBrandPresets).map(([key, preset]) => (
                            <option key={key} value={key}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                        <span
                          aria-hidden="true"
                          title="Brand preview"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            border: `1px solid ${layout.border}`,
                            background:
                              'linear-gradient(135deg, var(--nostrstack-color-primary), var(--nostrstack-color-accent))',
                            boxShadow: 'var(--nostrstack-shadow-glow)'
                          }}
                        />
                      </div>
                    </label>
                  </div>

                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span>Relays (comments)</span>
                      <input
                        className="nostrstack-input"
                        name="relaysCsv"
                        autoComplete="off"
                        style={{ width: '100%' }}
                        value={relaysCsv}
                        onChange={(e) => setRelaysCsv(e.target.value)}
                        placeholder="wss://relay1,wss://relay2"
                      />
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gap: '0.4rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
                      >
                        <button type="button" onClick={() => setRelaysCsv('wss://relay.damus.io,wss://relay.snort.social')}>
                          Use public relays
                        </button>
                        <button type="button" onClick={() => setRelaysCsv(relaysEnvDefault.join(','))}>
                          Use env default
                        </button>
                        <CopyButton text={relayLabel} label="Copy relays" />
                      </div>
                      <div
                        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
                      >
                        <input
                          className="nostrstack-input"
                          name="relayUrlToAdd"
                          autoComplete="off"
                          aria-label="Add relay URL"
                          placeholder="wss://relay.example"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const url = (e.target as HTMLInputElement).value.trim();
                              if (!url) return;
                              const next = Array.from(new Set([...relaysList, url])).filter(Boolean);
                              setRelaysList(next);
                              setRelaysCsv(next.join(','));
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                          style={{ flex: 1, minWidth: 180 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.querySelector<HTMLInputElement>(
                              'input[aria-label="Add relay URL"]'
                            );
                            const url = input?.value.trim();
                            if (!url) return;
                            const next = Array.from(new Set([...relaysList, url])).filter(Boolean);
                            setRelaysList(next);
                            setRelaysCsv(next.join(','));
                            if (input) input.value = '';
                          }}
                        >
                          Add relay
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: themeStyles.muted }}>
                      Using: {relayLabel} (real Nostr relays)
                    </div>
                  </div>
                </Card>
              </aside>
            </div>
          )}
        </section>

        <section
          id={demoPanelId('nostr')}
          role="tabpanel"
          aria-labelledby={demoTabId('nostr')}
          hidden={tab !== 'nostr'}
          className="nostrstack-gallery-tab"
          data-active={tab === 'nostr' ? 'true' : 'false'}
        >
          {tab === 'nostr' && (
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
              }}
            >
              <Card title="Nostr profile">
                <NostrProfileCard
                  pubkey={activePubkey ?? undefined}
                  seckey={undefined}
                  signerReady={signerReady}
                  relays={profileRelays}
                  relayStats={relayStats}
                  profile={profile ?? undefined}
                  fullProfile={profile ?? undefined}
                  metaEvent={profileMetaEvent?.event}
                  metaRelay={profileMetaEvent?.relay}
                  profileStatus={profileStatus}
                  nip05Verified={nip05Verified}
                />
                <div
                  style={{
                    marginTop: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    padding: '0.75rem',
                    borderRadius: layout.radius,
                    border: `1px solid ${layout.border}`,
                    background: themeStyles.inset
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: signerReady
                          ? 'var(--nostrstack-color-success)'
                          : 'var(--nostrstack-color-danger)'
                      }}
                    />
                    <strong>{signerReady ? 'Signer available' : 'No NIP-07 signer detected'}</strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ color: themeStyles.muted, fontSize: '0.9rem' }}>Pubkey:</span>
                    <code
                      style={{
                        fontFamily: 'var(--nostrstack-font-mono)',
                        wordBreak: 'break-all',
                        maxWidth: '100%'
                      }}
                    >
                      {activePubkey ?? '—'}
                    </code>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontWeight: 600 }}>Demo message</span>
                    <textarea
                      className="nostrstack-textarea"
                      name="demoMessage"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    <button
                      type="button"
                      className="nostrstack-btn nostrstack-btn--primary"
                      onClick={handleSendNote}
                      disabled={!signerReady}
                    >
                      Send signed note
                    </button>
                    <span style={{ fontSize: '0.9rem', color: themeStyles.muted }}>
                      Relay: {profileRelays[0] ?? '—'}
                    </span>
                  </div>
                  {lastNoteResult && (
                    <div
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: layout.radius,
                        border: lastNoteOk
                          ? '1px solid color-mix(in oklab, var(--nostrstack-color-success) 28%, var(--nostrstack-color-border))'
                          : '1px solid color-mix(in oklab, var(--nostrstack-color-danger) 28%, var(--nostrstack-color-border))',
                        background: lastNoteOk
                          ? 'color-mix(in oklab, var(--nostrstack-color-success) 12%, var(--nostrstack-color-surface))'
                          : 'color-mix(in oklab, var(--nostrstack-color-danger) 12%, var(--nostrstack-color-surface))',
                        color: lastNoteOk
                          ? 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))'
                          : 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
                        fontSize: '0.9rem'
                      }}
                    >
                      {lastNoteResult}
                    </div>
                  )}
                </div>
              </Card>
              <Card title="Share (Nostr)">
                <div style={{ marginBottom: 10, color: themeStyles.muted, fontSize: '0.95rem' }}>
                  Demo: a blog post share widget (realtime share feed + avatars).
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 800 }}>nostrstack Demo post</div>
                    <div style={{ fontSize: 13, color: themeStyles.muted }}>
                      URL:{' '}
                      <code style={{ fontFamily: 'var(--nostrstack-font-mono)' }}>
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/blog/demo-post`
                          : `https://${demoHost}/blog/demo-post`}
                      </code>
                    </div>
                  </div>
                  <ShareWidget
                    itemId="gallery-demo-post"
                    title="nostrstack Demo post"
                    url={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/blog/demo-post`
                        : `https://${demoHost}/blog/demo-post`
                    }
                    lnAddress={`${username}@${demoHost}`}
                    relays={relaysList}
                  />
                </div>
              </Card>
              <Card title="Comments (Nostr)">
                <CommentsPanel
                  relayLabel={relayLabel}
                  relaysEnvDefault={relaysEnvDefault}
                  relaysList={relaysList}
                  relayStats={relayStats}
                  activity={activity}
                  onClearActivity={() => setActivity([])}
                />
                <div id="comments-container" />
              </Card>
            </div>
          )}
        </section>

        <section
          id={demoPanelId('logs')}
          role="tabpanel"
          aria-labelledby={demoTabId('logs')}
          hidden={tab !== 'logs'}
          className="nostrstack-gallery-tab"
          data-active={tab === 'logs' ? 'true' : 'false'}
        >
          {tab === 'logs' && (
            <Card title="Logs">
              <div
                style={{ marginBottom: '0.5rem', color: themeStyles.muted, fontSize: '0.95rem' }}
              >
                Streams backend logs from <code>{resolveLogStreamUrl(apiBase)}</code> and captures
                frontend console (toggle to enable).
              </div>
              <LogViewer backendUrl={resolveLogStreamUrl(apiBase)} />
            </Card>
          )}
        </section>

        <section
          id={demoPanelId('admin')}
          role="tabpanel"
          aria-labelledby={demoTabId('admin')}
          hidden={tab !== 'admin'}
          className="nostrstack-gallery-tab"
          data-active={tab === 'admin' ? 'true' : 'false'}
        >
          {tab === 'admin' && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <DashboardForm />
            </div>
          )}
        </section>

      </div>

      {qrInvoice && (
        <InvoicePopover
          invoice={qrInvoice}
          amountSats={qrAmount}
          status={qrStatus}
          onClose={() => setQrInvoice(null)}
        />
      )}
    </main>
  );
}

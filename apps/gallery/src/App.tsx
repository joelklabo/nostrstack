import { autoMount, mountCommentWidget, mountPayToAction, mountTipButton } from '@nostrstack/embed';
import type { Event as NostrEvent, EventTemplate } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CommentsPanel } from './comments/CommentsPanel';
import { CopyButton } from './CopyButton';
import { FaucetButton } from './FaucetButton';
import { InvoicePopover } from './InvoicePopover';
import { LogViewer } from './LogViewer';
import { NostrProfileCard } from './NostrProfileCard';
import { TelemetryCard } from './TelemetryCard';
import { layout } from './tokens';
import type { RelayStats } from './types/relay';
import { WalletBalance } from './WalletBalance';
import { WalletPanel } from './WalletPanel';

type RelayInfo = { relays: string[]; mode: 'real' };
type Health = { label: string; status: 'ok' | 'fail' | 'error' | 'skipped' | 'unknown'; detail?: string };
type ProfileMeta = {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  display_name?: string;
  nip05?: string;
  lud16?: string;
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

const demoHost = import.meta.env.VITE_NOSTRSTACK_HOST ?? 'localhost';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api';
const networkLabel = import.meta.env.VITE_NETWORK ?? 'regtest';
const relaysEnvRaw = import.meta.env.VITE_NOSTRSTACK_RELAYS;
const relaysEnvDefault = relaysEnvRaw
  ? relaysEnvRaw.split(',').map((r: string) => r.trim()).filter(Boolean)
  : ['wss://relay.damus.io'];
const lnbitsUrlRaw = import.meta.env.VITE_LNBITS_URL ?? 'http://localhost:15001';
const lnbitsAdminKey = import.meta.env.VITE_LNBITS_ADMIN_KEY ?? 'set-me';
const lnbitsReadKeyEnv = (import.meta.env as Record<string, string | undefined>).VITE_LNBITS_READ_KEY ?? '';
const lnbitsWalletIdEnv = (import.meta.env as Record<string, string | undefined>).VITE_LNBITS_WALLET_ID ?? '';
const RELAY_STORAGE_KEY = 'nostrstack.relays';
const profileDefault: ProfileMeta = {};

const relayMetaDefault: RelayStats = relaysEnvDefault.reduce((acc: RelayStats, r: string) => {
  acc[r] = { recv: 0 };
  return acc;
}, {});

function resolveLogStreamUrl(base: string) {
  if (base.includes('localhost:3001')) return '/api/logs/stream';
  return `${base.replace(/\/$/, '')}/logs/stream`;
}

function resolveTelemetryWs(base: string) {
  const loc = typeof window !== 'undefined' ? window.location : null;
  const normalizeHost = (input?: string | null) => {
    if (!input) return null;
    const stripped = input.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if ((stripped === 'localhost' || stripped === '127.0.0.1' || stripped === '[::1]') && !stripped.includes(':')) {
      return `${stripped}:3001`;
    }
    return stripped || null;
  };

  const previewFallback = import.meta.env.PROD && loc?.port === '4173' ? `${loc.hostname}:3001` : null;

  let apiUrl: URL | null = null;
  try {
    apiUrl = loc ? new URL(base, loc.origin) : new URL(base);
  } catch {
    apiUrl = null;
  }

  const devPreviewHost = loc?.port === '4173' ? `${loc.hostname}:3001` : null;

  const host =
    normalizeHost(import.meta.env.VITE_NOSTRSTACK_HOST as string | undefined) ??
    devPreviewHost ??
    (apiUrl ? normalizeHost(apiUrl.host) : null) ??
    previewFallback ??
    'localhost:3001';

  const preferSecure = loc?.protocol === 'https:' || apiUrl?.protocol === 'https:';
  const scheme = preferSecure ? 'wss' : 'ws';
  return `${scheme}://${host}/ws/telemetry`;
}

function normalizeUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `http:${url}`;
  if (url.startsWith(':')) return `http://localhost${url}`;
  return `http://${url}`;
}

function Card({ title, children, themeStyles }: { title: string; children: React.ReactNode; themeStyles: ThemeStyles }) {
  return (
    <section style={{ border: `1px solid ${layout.border}`, borderRadius: layout.radius, padding: layout.cardPadding, marginBottom: '1rem', background: themeStyles.card, color: themeStyles.text, boxShadow: themeStyles.shadow }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export type PillTone = 'info' | 'success' | 'warn' | 'muted';

export function Pill({ label, value, tone = 'info', theme }: { label: string; value: string; tone?: PillTone; theme: 'light' | 'dark' }) {
  const toneColor: Record<PillTone, string> = {
    info: '#3b82f6',
    success: '#22c55e',
    warn: '#f59e0b',
    muted: '#94a3b8'
  };
  const background = theme === 'dark' ? '#111827' : '#fff';
  const border = `${toneColor[tone]}33`;
  const textColor = theme === 'dark' ? '#e2e8f0' : '#0f172a';
  const subColor = theme === 'dark' ? '#cbd5e1' : '#475569';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color: textColor,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      <span style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: subColor, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
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
type NostrWithRelays = typeof window.nostr & { getRelays?: () => Promise<Record<string, NostrRelayInfo>> };

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

const tabBtn = (active: boolean, themeStyles: { background: string; color: string; borderColor: string }) => ({
  padding: '0.55rem 1.1rem',
  borderRadius: 10,
  border: `1px solid ${themeStyles.borderColor}`,
  background: active ? '#0ea5e9' : themeStyles.background,
  color: active ? '#fff' : themeStyles.color,
  fontWeight: 700,
  boxShadow: active ? '0 6px 20px rgba(14,165,233,0.25)' : 'none'
});

function useMountWidgets(
  username: string,
  amount: number,
  relaysCsv: string,
  onUnlock: () => void,
  enableTestSigner: boolean,
  setQrInvoice: (pr: string | null) => void,
  setQrAmount: (n?: number) => void,
  setUnlockedPayload: (v: string | null) => void,
  setQrStatus: React.Dispatch<React.SetStateAction<'pending' | 'paid' | 'error'>>,
  setRelayStats: React.Dispatch<React.SetStateAction<RelayStats>>,
  relaysList: string[]
) {
  useEffect(() => {
    const tipHost = document.getElementById('tip-container');
    const payHost = document.getElementById('pay-container');
    const unlockHost = document.getElementById('unlock-status');
    const commentsHost = document.getElementById('comments-container');
    if (!tipHost || !payHost || !commentsHost) return;

    tipHost.innerHTML = '<button>Loading…</button>';
    payHost.innerHTML = '<button>Loading…</button>';
    commentsHost.innerHTML = '<div>Loading…</div>';
    if (unlockHost) {
      unlockHost.textContent = 'Locked';
    }

    const tipOpts: Record<string, unknown> = {
      username,
      amountSats: amount,
      host: demoHost,
      baseURL: apiBase,
      onInvoice: (pr: string) => {
        setQrInvoice(pr);
        setQrAmount(amount);
      }
    };
    setTimeout(() => {
      mountTipButton(tipHost, tipOpts);
      mountPayToAction(payHost, {
        username,
        amountSats: amount,
        host: demoHost,
        baseURL: apiBase,
        onInvoice: (pr) => {
          setQrInvoice(pr);
          setQrAmount(amount);
          setQrStatus('pending');
        },
        onUnlock: () => {
          if (unlockHost) unlockHost.textContent = 'Unlocked!';
          onUnlock?.();
          setUnlockedPayload('Paid content unlocked');
          setQrStatus('paid');
        }
      });
    }, 50);

    const relays = relaysList.length ? relaysList : relaysEnvDefault;

    mountCommentWidget(commentsHost, {
      threadId: 'demo-thread',
      relays,
      onRelayInfo: (info: RelayInfo) => {
        const active = info.relays.length ? info.relays : relaysEnvDefault;
        setRelayStats((prev) => {
          const next = { ...prev };
          const now = Date.now();
          active.forEach((r) => {
            next[r] = { ...(next[r] ?? { recv: 0 }), last: now, sendStatus: 'ok' };
          });
          return next;
        });
      },
      // @ts-expect-error onEvent not in upstream types yet
      onEvent: (ev: { content?: string }) => {
        if (!ev?.content) return;
        const now = Date.now();
        const targets = relays.length ? relays : relaysEnvDefault;
        setRelayStats((prev: RelayStats) => {
          const next = { ...prev };
          targets.forEach((relay) => {
            next[relay] = {
              ...(next[relay] ?? { recv: 0 }),
              recv: (next[relay]?.recv ?? 0) + 1,
              last: now,
              sendStatus: 'ok'
            };
          });
          return next;
        });
      }
    });
  }, [username, amount, relaysCsv, onUnlock, enableTestSigner]);
}

export default function App() {
  const [username, setUsername] = useState('alice');
  const [amount, setAmount] = useState(5);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [relaysCsv, setRelaysCsv] = useState(relaysEnvDefault.join(','));
  const [relaysList, setRelaysList] = useState<string[]>(relaysEnvDefault);
  const [locked, setLocked] = useState(true);
  const [realInvoice, setRealInvoice] = useState<string | null>(null);
  const [realBusy, setRealBusy] = useState(false);
  const [qrInvoice, setQrInvoice] = useState<string | null>(null);
  const [qrAmount, setQrAmount] = useState<number | undefined>(undefined);
  const [qrStatus, setQrStatus] = useState<'pending' | 'paid' | 'error'>('pending');
  const [tab, setTab] = useState<'lightning' | 'nostr' | 'logs'>('lightning');
  const [, setUnlockedPayload] = useState<string | null>(null);
  const [network] = useState(networkLabel);
  const [relayStats, setRelayStats] = useState<RelayStats>(relayMetaDefault);
  const [lnbitsUrlOverride, setLnbitsUrlOverride] = useState<string | null>(null);
  const [lnbitsKeyOverride, setLnbitsKeyOverride] = useState<string | null>(null);
  const [lnbitsReadKeyOverride, setLnbitsReadKeyOverride] = useState<string | null>(null);
  const [lnbitsWalletIdOverride, setLnbitsWalletIdOverride] = useState<string | null>(null);
  const [telemetryWsOverride, setTelemetryWsOverride] = useState<string | null>(null);
  const [health, setHealth] = useState<Health[]>([
    { label: 'API', status: 'unknown' },
    { label: 'LNbits', status: 'unknown' }
  ]);
  const [walletRefresh, setWalletRefresh] = useState(0);
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
    const url = typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.url') : null;
    const key = typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.key') : null;
    const readKey = typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.readKey') : null;
    const walletId = typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.lnbits.walletId.manual') : null;
    if (url) setLnbitsUrlOverride(url);
    if (key) setLnbitsKeyOverride(key);
    if (readKey) setLnbitsReadKeyOverride(readKey);
    if (walletId) setLnbitsWalletIdOverride(walletId);
    else if (lnbitsWalletIdEnv) setLnbitsWalletIdOverride(lnbitsWalletIdEnv);
    const tws = typeof window !== 'undefined' ? window.localStorage.getItem('nostrstack.telemetry.ws') : null;
    if (tws) setTelemetryWsOverride(tws);
  }, []);
  const [activePubkey, setActivePubkey] = useState<string | null>(null);
  const [signerReady, setSignerReady] = useState(false);
  const [signerRelays, setSignerRelays] = useState<string[]>([]);
  const [profile, setProfile] = useState<ProfileMeta>(profileDefault);
  const [_profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
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
  }, [activePubkey]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(RELAY_STORAGE_KEY) : null;
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
        const res = await fetch(nip11Url(relay), { headers: { Accept: 'application/nostr+json' }, signal: controller.signal });
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
    relaysList.forEach(fetchMeta);
    return () => controller.abort();
  }, [relaysList]);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const sample = relaysList.slice(0, 3);
      await Promise.all(
        sample.map(async (url) => {
          try {
            const started = performance.now();
            const relay = await Relay.connect(url);
            const latencyMs = Math.round(performance.now() - started);
            if (cancelled) {
              relay.close();
              return;
            }
            setRelayStats((prev) => ({
              ...prev,
              [url]: {
                ...(prev[url] ?? { recv: 0 }),
                last: Date.now(),
                sendStatus: 'ok',
                online: true,
                latencyMs,
                lastProbeAt: Date.now()
              }
            }));
            relay.close();
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

  const fetchProfile = useCallback(async (pk: string) => {
    if (!pk) return;
    const target = profileRelays.find(isRelayUrl) ?? relaysEnvDefault.find(isRelayUrl);
    if (!target) return;
    setProfileStatus('loading');
    setNip05Verified(null);
    try {
      const relay = await Relay.connect(target);
      type RelayListFn = (filters: Array<{ kinds: number[]; authors: string[]; limit: number }>) => Promise<NostrEvent[]>;
      const list = (relay as Relay & { list?: RelayListFn }).list;
      const evs = (await list?.([{ kinds: [0, 10002], authors: [pk], limit: 2 }])) ?? [];
      relay.close();

      const metaEv = evs.find((e) => e.kind === 0);
      if (metaEv?.content) {
        const meta = JSON.parse(metaEv.content ?? '{}');
        setProfile(meta);
        setProfileStatus('ok');
        if (meta.nip05) verifyNip05(meta.nip05, pk).then(setNip05Verified).catch(() => setNip05Verified(false));
        else setNip05Verified(null);
      } else {
        setProfileStatus('error');
      }

      const relayEv = evs.find((e) => e.kind === 10002);
      const relayTags = relayEv?.tags?.filter?.((t: string[]) => t[0] === 'r' && t[1]).map((t: string[]) => t[1]).filter(isRelayUrl) ?? [];
      if (relayTags.length) {
        setSignerRelays((prev) => mergeRelays(prev, relayTags));
      }
    } catch (err) {
      console.warn('profile fetch failed', err);
      setProfileStatus('error');
      setNip05Verified(null);
    }
  }, [profileRelays]);

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

  useEffect(() => {
    setLocked(true);
  }, [username, amount, relaysCsv]);

  const handleSendNote = useCallback(async () => {
    try {
      setLastNoteResult(null);
      setLastNoteOk(false);
      if (!signerReady) {
        setLastNoteResult('No NIP-07 signer detected');
        return;
      }
      const relay = profileRelays[0] ?? 'wss://relay.damus.io';
      setRelayStats((prev) => ({
        ...prev,
        [relay]: { ...(prev[relay] ?? { recv: 0 }), sendStatus: 'sending', lastSentAt: Date.now() }
      }));
      const template: EventTemplate & { pubkey: string } = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: message || 'nostrstack ping',
        pubkey: activePubkey ?? ''
      };
      const signed = (await window.nostr!.signEvent(template)) as NostrEvent;
      const r = await Relay.connect(relay);
      await r.publish(signed);
      r.close();
      setRelayStats((prev) => ({
        ...prev,
        [relay]: { ...(prev[relay] ?? { recv: 0 }), sendStatus: 'ok', lastSentAt: Date.now() }
      }));
      setLastNoteOk(true);
      setLastNoteResult(`Published note to ${relay}`);
    } catch (err) {
      const relay = profileRelays[0] ?? 'wss://relay.damus.io';
      setRelayStats((prev) => ({
        ...prev,
        [relay]: { ...(prev[relay] ?? { recv: 0 }), sendStatus: 'error', lastSentAt: Date.now() }
      }));
      setLastNoteOk(false);
      setLastNoteResult(err instanceof Error ? err.message : String(err));
    }
  }, [signerReady, activePubkey, profileRelays, message]);

  useEffect(() => {
    if (!qrInvoice) return;
    const wsUrl = `${apiBase.replace(/\/$/, '').replace(/^http/, 'ws')}/ws/pay`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'invoice-paid' && msg.pr === qrInvoice) {
          setQrStatus('paid');
          setUnlockedPayload('Paid content unlocked');
          setLocked(false);
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [qrInvoice, apiBase]);

  useEffect(() => {
    const fetchHealth = async () => {
      // always check against real API
      const results: Health[] = [];
      try {
        const apiRes = await fetch(apiBase.startsWith('/api') ? '/api/health' : `${apiBase}/health`);
        results.push({ label: 'API', status: apiRes.ok ? 'ok' : 'fail', detail: `http ${apiRes.status}` });
      } catch (err) {
        results.push({ label: 'API', status: 'error', detail: formatError(err) });
      }
      try {
        const lnRes = await fetch(apiBase.startsWith('/api') ? '/api/health/lnbits' : `${apiBase}/health/lnbits`);
        const body = await lnRes.json();
        results.push({ label: 'LNbits', status: body.status ?? (lnRes.ok ? 'ok' : 'fail'), detail: body.reason || body.error || `http ${lnRes.status}` });
      } catch (err) {
        results.push({ label: 'LNbits', status: 'error', detail: formatError(err) });
      }
      setHealth(results);
    };
    fetchHealth();
  }, []);

  const handleUnlocked = useCallback(() => setLocked(false), []);
  useMountWidgets(username, amount, relaysCsv, handleUnlocked, false, setQrInvoice, setQrAmount, setUnlockedPayload, setQrStatus, setRelayStats, relaysList);

  const themeStyles = useMemo(
    () =>
      theme === 'dark'
        ? {
            background: '#0b1021',
            card: '#0f172a',
            inset: '#111827',
            text: '#e2e8f0',
            color: '#e2e8f0',
            muted: '#94a3b8',
            borderColor: '#1f2937',
            accent: '#38bdf8',
            shadow: '0 10px 40px rgba(0,0,0,0.35)'
          }
        : {
            background: '#f8fafc',
            card: '#fff',
            inset: '#f8fafc',
            text: '#0f172a',
            color: '#0f172a',
            muted: '#475569',
            borderColor: '#e2e8f0',
            accent: '#0ea5e9',
            shadow: '0 10px 30px rgba(15,23,42,0.08)'
          },
    [theme]
  );

  const colors = useMemo(
    () => ({
      subtle: theme === 'dark' ? '#cbd5e1' : '#475569'
    }),
    [theme]
  );

  const requestRealInvoice = useCallback(async () => {
    setRealBusy(true);
    setRealInvoice(null);
    setQrInvoice(null);
    setQrStatus('pending');
    try {
      const res = await fetch(`${apiBase}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', host: demoHost },
        body: JSON.stringify({
          domain: demoHost,
          action: 'tip',
          amount: amount,
          metadata: { ui: 'gallery' }
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const pr = body.payment_request ?? body.pr;
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

  const walletKeyEnv = (import.meta.env.VITE_LNBITS_ADMIN_KEY ?? '').slice(0, 4) ? lnbitsAdminKey : '';
  const walletKey = (lnbitsKeyOverride ?? walletKeyEnv) || 'set VITE_LNBITS_ADMIN_KEY';
  const walletReadKey = lnbitsReadKeyOverride ?? lnbitsReadKeyEnv ?? '';
  const walletIdOverride = lnbitsWalletIdOverride ?? (lnbitsWalletIdEnv || undefined);
  const lnbitsUrl = normalizeUrl(lnbitsUrlOverride ?? lnbitsUrlRaw);
  const telemetryWsUrl = telemetryWsOverride ?? resolveTelemetryWs(apiBase);
  const relayLabel = relaysCsv || relaysEnvDefault.join(',');
  const isDark = theme === 'dark';

  return (
    <main
      style={{
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: themeStyles.background,
        color: themeStyles.color,
        minHeight: '100vh'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ marginTop: 0, marginBottom: 0, color: themeStyles.text }}>nostrstack Demo</h1>
        <span
          style={{
            padding: '0.35rem 0.8rem',
            borderRadius: 999,
            background: themeStyles.accent,
            color: isDark ? '#0b1220' : '#e2e8f0',
            fontWeight: 700,
            letterSpacing: '0.03em'
          }}
        >
          {network.toUpperCase()}
        </span>
      </div>
      <p style={{ maxWidth: 780, color: themeStyles.muted }}>
        Play with the widgets below. Lightning points at <strong>{demoHost}</strong>; comments use the relays you set.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={() => setTab('lightning')} style={tabBtn(tab === 'lightning', themeStyles)}>Lightning</button>
        <button onClick={() => setTab('nostr')} style={tabBtn(tab === 'nostr', themeStyles)}>Nostr</button>
        <button onClick={() => setTab('logs')} style={tabBtn(tab === 'logs', themeStyles)}>Logs</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Pill label="Host" value={demoHost} tone="info" theme={theme} />
        <Pill label="API" value={apiBase} tone="info" theme={theme} />
        <Pill label="Payments" value="real invoices" tone="success" theme={theme} />
        <Pill label="Comments" value="real Nostr" tone="success" theme={theme} />
        <Pill label="Relays" value={compactRelaysLabel(relayLabel)} tone="info" theme={theme} />
      </div>

      <WalletPanel lnbitsUrl={lnbitsUrl} adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'} visible />
      <WalletBalance
        lnbitsUrl={lnbitsUrl}
        adminKey={walletKey || 'set VITE_LNBITS_ADMIN_KEY'}
        readKey={walletReadKey || undefined}
        walletId={walletIdOverride}
        refreshSignal={walletRefresh}
        onManualRefresh={() => setWalletRefresh((n) => n + 1)}
      />
      <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem 0.8rem', background: '#f1f5f9', border: `1px solid ${layout.border}`, borderRadius: layout.radius, marginBottom: '1rem' }}>
        <strong>Use a custom LNbits wallet</strong>
        <div style={{ color: '#475569', fontSize: '0.95rem' }}>
          Example: URL <code>http://localhost:15001</code>, Admin key from LNbits wallet API info, optional Wallet ID for <code>/api/v1/wallet?usr=&lt;id&gt;</code> fallback.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
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
            style={{ minWidth: 220, flex: 1 }}
            placeholder="LNbits admin key"
            type="password"
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
            style={{ minWidth: 220, flex: 1 }}
            placeholder="LNbits read key (optional)"
            type="password"
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
          <button type="button" onClick={() => setWalletRefresh((n) => n + 1)}>Save & refresh</button>
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
      </div>
      {tab === 'lightning' && (
      <>
      <div style={{ marginBottom: '1rem' }}>
        <FaucetButton apiBase={apiBase} onFunded={() => setWalletRefresh((n) => n + 1)} />
      </div>
      <Card title="Config & presets" themeStyles={themeStyles}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Amount (sats)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Theme</span>
            <div role="group" aria-label="Theme" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTheme('light')}
                style={tabBtn(theme === 'light', themeStyles)}
                aria-pressed={theme === 'light'}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                style={tabBtn(theme === 'dark', themeStyles)}
                aria-pressed={theme === 'dark'}
              >
                Dark
              </button>
            </div>
          </label>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Relays (comments)</span>
            <input
              style={{ width: '100%' }}
              value={relaysCsv}
              onChange={(e) => setRelaysCsv(e.target.value)}
              placeholder="wss://relay1,wss://relay2"
            />
          </label>
          <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setRelaysCsv(relaysEnvDefault.join(','))}>Use real defaults</button>
              <CopyButton text={relayLabel} label="Copy relays" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
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
                  const input = document.querySelector<HTMLInputElement>('input[aria-label="Add relay URL"]');
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
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            Using: {relayLabel} (real Nostr relays)
          </div>
        </div>

      </Card>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="Tip button" themeStyles={themeStyles}>
          <div style={{ marginBottom: '0.5rem', color: '#475569' }}>LNURLp flow. Request a real invoice from the API.</div>
          <div id="tip-container" />
          <div style={{ marginTop: '0.75rem' }}>
            <button onClick={requestRealInvoice} disabled={realBusy}>
              {realBusy ? 'Requesting…' : `Request real invoice (${amount} sats)`}
            </button>
            {realInvoice && (
              <div data-testid="real-invoice" style={{ marginTop: '0.6rem', display: 'grid', gap: '0.35rem' }}>
                <strong>BOLT11</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.6rem' }}>
                  {realInvoice}
                </pre>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <CopyButton text={realInvoice} label="Copy" />
                  <a href={`lightning:${realInvoice}`} style={{ padding: '0.35rem 0.7rem', borderRadius: 10, border: '1px solid #e2e8f0', textDecoration: 'none', color: '#0f172a', background: '#fff' }}>
                    Open in wallet
                  </a>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Pay to unlock" themeStyles={themeStyles}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem', color: '#475569' }}>
            <span>Creates an invoice; unlocks after real payment confirmation.</span>
            <span className={locked ? 'pay-status pay-status--pending' : 'pay-status pay-status--paid'}>
              <span className="dot" />
              {locked ? 'Waiting for payment' : 'Unlocked'}
            </span>
          </div>
          <div id="pay-container" />
          <div id="unlock-status" style={{ marginTop: '0.5rem' }} data-testid="unlock-status">
            {locked ? 'Locked' : 'Unlocked!'}
          </div>
          {!locked && (
            <div style={{ marginTop: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem' }}>
              <strong>Unlocked content:</strong>
              <div style={{ marginTop: '0.35rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#0f172a' }}>
                secrets/regtest.txt — "The quick brown fox pays 21 sats."
              </div>
            </div>
          )}
        </Card>
      </div>
      </>
      )}

      {tab === 'nostr' && (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <Card title="Nostr profile" themeStyles={themeStyles}>
            <NostrProfileCard
              pubkey={activePubkey ?? undefined}
              seckey={undefined}
              signerReady={signerReady}
              relays={profileRelays}
              relayStats={relayStats}
              profile={profile}
              fullProfile={profile}
              nip05Verified={nip05Verified}
            />
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', borderRadius: layout.radius, border: `1px solid ${layout.border}`, background: themeStyles.inset }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: signerReady ? '#22c55e' : '#ef4444' }} />
                <strong>{signerReady ? 'Signer available' : 'No NIP-07 signer detected'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: colors.subtle, fontSize: '0.9rem' }}>Pubkey:</span>
                <code style={{ fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '100%' }}>{activePubkey ?? '—'}</code>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span style={{ fontWeight: 600 }}>Demo message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  style={{
                    borderRadius: layout.radius,
                    border: `1px solid ${layout.border}`,
                    padding: '0.6rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={handleSendNote} disabled={!signerReady} style={{ padding: '0.55rem 1rem' }}>
                  Send signed note
                </button>
                <span style={{ fontSize: '0.9rem', color: colors.subtle }}>Relay: {profileRelays[0] ?? '—'}</span>
              </div>
              {lastNoteResult && (
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: layout.radius,
                    border: `1px solid ${lastNoteOk ? '#22c55e44' : '#ef444444'}`,
                    background: lastNoteOk ? '#ecfdf3' : '#fef2f2',
                    color: lastNoteOk ? '#166534' : '#b91c1c',
                    fontSize: '0.9rem'
                  }}
                >
                  {lastNoteResult}
                </div>
              )}
            </div>
          </Card>
          <Card title="Comments (Nostr)" themeStyles={themeStyles}>
            <CommentsPanel
              relayLabel={relayLabel}
              relaysEnvDefault={relaysEnvDefault}
              relaysList={relaysList}
              relayStats={relayStats}
              theme={theme}
            />
            <div id="comments-container" />
          </Card>
        </div>
      )}

      <div style={{ display: tab === 'logs' ? 'block' : 'none' }}>
        <Card title="Logs" themeStyles={themeStyles}>
          <div style={{ marginBottom: '0.5rem', color: '#475569', fontSize: '0.95rem' }}>
            Streams backend logs from <code>{resolveLogStreamUrl(apiBase)}</code> and captures frontend console (toggle to enable).
          </div>
          <LogViewer backendUrl={resolveLogStreamUrl(apiBase)} theme={theme} />
        </Card>
      </div>

      <Card title="Status & build" themeStyles={themeStyles}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem', color: themeStyles.muted }}>
          <span>Build: {import.meta.env.VITE_APP_COMMIT ?? 'dev'} • {import.meta.env.VITE_APP_BUILD_TIME ?? 'now'}</span>
          <span>Host: {demoHost}</span>
          <span>API base: {apiBase}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
          {health.map((h) => {
            const color = h.status === 'ok' ? '#22c55e' : '#ef4444';
            const bg = isDark ? themeStyles.inset : '#f8fafc';
            return (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.75rem', borderRadius: 10, background: bg, border: `1px solid ${themeStyles.borderColor}` }}>
                <span
                  className={h.status === 'ok' ? 'status-dot pulse' : 'status-dot'}
                  style={{ width: 12, height: 12, borderRadius: 999, background: color }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 700 }}>{h.label}</span>
                  <span style={{ fontSize: '0.9rem', color: '#475569' }}>{h.status}{h.detail ? ` – ${h.detail}` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
            {tab === 'lightning' && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 240 }}>
                <span style={{ fontSize: '0.9rem', color: '#475569' }}>Telemetry WS override</span>
                <input
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
                  if (typeof window !== 'undefined') window.localStorage.removeItem('nostrstack.telemetry.ws');
                }}
              >
                Reset WS
              </button>
            </div>
            <TelemetryCard wsUrl={telemetryWsUrl} />
          </div>
        )}
      </Card>

      <style>{`
        button { cursor: pointer; transition: transform 120ms ease, box-shadow 120ms ease; }
        button:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(15,23,42,0.12); }
        input, select, button, textarea { background: ${theme === 'dark' ? '#111827' : '#fff'}; color: ${themeStyles.text}; border: 1px solid ${themeStyles.borderColor}; border-radius: 8px; padding: 0.5rem 0.75rem; transition: border-color 120ms ease, background 120ms ease; }
        section { border-color: ${themeStyles.borderColor}; }
        .relay-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; border-radius: 999px; background: ${theme === 'dark' ? '#0f172a' : '#f8fafc'}; color: ${theme === 'dark' ? '#e2e8f0' : '#0f172a'}; font-size: 12px; border: 1px solid ${themeStyles.borderColor}; }
        .relay-pill .dot { width: 8px; height: 8px; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 0 0 rgba(148,163,184,0.6); animation: pulse 2s infinite; }
        .relay-pill .dot.real { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
        .status-dot.pulse { box-shadow: 0 0 0 0 rgba(34,197,94,0.25); animation: pulse 2s infinite; }
        .relay-chip { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.45rem; padding: 0.45rem 0.6rem; border-radius: 12px; min-width: 220px; }
        .chip-dot { width: 10px; height: 10px; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 0 0 rgba(148,163,184,0.4); }
        .chip-dot.real { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
        .chip-dot.pulse { animation: pulse 1.8s infinite; }
        .chip-count { font-size: 0.78rem; color: #0f172a; background: #e2e8f0; padding: 0.2rem 0.45rem; border-radius: 999px; border: 1px solid #cbd5e1; }
        .pay-status { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem; border-radius: 999px; font-weight: 700; }
        .pay-status .dot { width: 10px; height: 10px; border-radius: 999px; }
        .pay-status--pending { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .pay-status--pending .dot { background: #fb923c; box-shadow: 0 0 0 0 rgba(251,146,60,0.35); animation: pulse 1.6s infinite; }
        .pay-status--paid { background: #ecfdf3; color: #166534; border: 1px solid #bbf7d0; }
        .pay-status--paid .dot { background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.3); animation: pulse 1.6s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6);} 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {qrInvoice && <InvoicePopover invoice={qrInvoice} amountSats={qrAmount} status={qrStatus} onClose={() => setQrInvoice(null)} />}
    </main>
  );
}

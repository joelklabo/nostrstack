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
import { BlockList } from './TelemetryCard';
import { layout } from './tokens';
import type { RelayStats } from './types/relay';
import { WalletBalance } from './WalletBalance';
import { WalletPanel } from './WalletPanel';

type RelayInfo = { relays: string[]; mode: 'real' | 'mock' };
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
const profileDefault: ProfileMeta = {};

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

function resolveLogStreamUrl(base: string) {
  if (base.includes('localhost:3001')) return '/api/logs/stream';
  return `${base.replace(/\/$/, '')}/logs/stream`;
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="nostrstack-card nostrstack-gallery-card">
      <h2>{title}</h2>
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
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
        borderRadius: 999,
        border: `1px solid color-mix(in oklab, ${toneVar} 30%, var(--nostrstack-color-border))`,
        background: 'color-mix(in oklab, var(--nostrstack-color-surface) 92%, transparent)',
        color: 'var(--nostrstack-color-text)',
        boxShadow: 'var(--nostrstack-shadow-sm)'
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--nostrstack-color-text-subtle)',
          fontWeight: 800
        }}
      >
        {label}
      </span>
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

const tabBtn = (
  active: boolean,
  themeStyles: { background: string; color: string; borderColor: string }
) => ({
  padding: '0.55rem 1.1rem',
  borderRadius: 'var(--nostrstack-radius-md)',
  border: `1px solid ${themeStyles.borderColor}`,
  background: active
    ? 'linear-gradient(135deg, var(--nostrstack-color-primary), var(--nostrstack-color-accent))'
    : 'var(--nostrstack-color-surface)',
  color: active ? 'var(--nostrstack-color-text-on-strong)' : themeStyles.color,
  fontWeight: 800,
  boxShadow: active ? 'var(--nostrstack-shadow-glow)' : 'var(--nostrstack-shadow-sm)'
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
  relaysList: string[],
  tab: 'lightning' | 'nostr' | 'logs',
  verifyPayment: (pr: string) => Promise<boolean>
) {
  useEffect(() => {
    const tipHost = document.getElementById('tip-container');
    const payHost = document.getElementById('pay-container');
    const unlockHost = document.getElementById('unlock-status');
    const commentsHost = document.getElementById('comments-container');
    const timeouts: number[] = [];

    if (tipHost) tipHost.innerHTML = '';
    if (payHost) payHost.innerHTML = '';
    if (commentsHost) commentsHost.innerHTML = '';
    if (unlockHost) unlockHost.textContent = 'Locked';

    const tipOpts: Record<string, unknown> = {
      username,
      amountSats: amount,
      host: demoHost,
      baseURL: apiBase,
      onInvoice: (pr: string) => {
        setQrInvoice(pr);
        setQrAmount(amount);
        setQrStatus('pending');
      }
    };
    if (tipHost) {
      timeouts.push(window.setTimeout(() => mountTipButton(tipHost, tipOpts), 50));
    }
    if (payHost) {
      timeouts.push(
        window.setTimeout(() => {
          mountPayToAction(payHost, {
            username,
            amountSats: amount,
            host: demoHost,
            baseURL: apiBase,
            verifyPayment,
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
        }, 50)
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
            const now = Date.now();
            active.forEach((r: string) => {
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
            targets.forEach((relay: string) => {
              next[relay] = { ...bumpRecv(next[relay], now), sendStatus: 'ok' };
            });
            return next;
          });
        }
      });
    }

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [username, amount, relaysCsv, onUnlock, enableTestSigner, relaysList, tab, verifyPayment]);
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
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
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
  const [payerInvoice, setPayerInvoice] = useState('');
  const [payerStatus, setPayerStatus] = useState<'idle' | 'paying' | 'paid' | 'error'>('idle');
  const [payerMessage, setPayerMessage] = useState<string | null>(null);
  const [payWsState, setPayWsState] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const paidInvoicesRef = useRef<Set<string>>(new Set());
  const payWaitersRef = useRef<Map<string, Set<(ok: boolean) => void>>>(new Map());
  const [health, setHealth] = useState<Health[]>([
    { label: 'API', status: 'unknown' },
    { label: 'LNbits', status: 'unknown' }
  ]);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [walletOverrideOpen, setWalletOverrideOpen] = useState(false);
  const adminKeyRef = useRef<HTMLInputElement | null>(null);
  const readKeyRef = useRef<HTMLInputElement | null>(null);
  const walletIdRef = useRef<HTMLInputElement | null>(null);
  const walletOverrideAutoOpenRef = useRef(false);
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
    setLocked(true);
  }, []);

  useEffect(() => {
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
    if (walletOverrideAutoOpenRef.current) return;
    const hasOverride =
      Boolean(lnbitsUrlOverride || lnbitsKeyOverride || lnbitsReadKeyOverride) ||
      Boolean(lnbitsWalletIdOverride && lnbitsWalletIdOverride !== lnbitsWalletIdEnv);
    if (!hasOverride) return;
    walletOverrideAutoOpenRef.current = true;
    setWalletOverrideOpen(true);
  }, [lnbitsUrlOverride, lnbitsKeyOverride, lnbitsReadKeyOverride, lnbitsWalletIdOverride]);
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

  const fetchProfile = useCallback(
    async (pk: string) => {
      if (!pk) return;
      const target = profileRelays.find(isRelayUrl) ?? relaysEnvDefault.find(isRelayUrl);
      if (!target) return;
      setProfileStatus('loading');
      setNip05Verified(null);
      try {
        const relay = await Relay.connect(target);
        type RelayListFn = (
          filters: Array<{ kinds: number[]; authors: string[]; limit: number }>
        ) => Promise<NostrEvent[]>;
        const list = (relay as Relay & { list?: RelayListFn }).list;
        const evs = (await list?.([{ kinds: [0, 10002], authors: [pk], limit: 2 }])) ?? [];
        relay.close();

        const metaEv = evs.find((e) => e.kind === 0);
        if (metaEv?.content) {
          const meta = JSON.parse(metaEv.content ?? '{}');
          setProfile(meta);
          setProfileStatus('ok');
          if (meta.nip05)
            verifyNip05(meta.nip05, pk)
              .then(setNip05Verified)
              .catch(() => setNip05Verified(false));
          else setNip05Verified(null);
        } else {
          setProfileStatus('error');
        }

        const relayEv = evs.find((e) => e.kind === 10002);
        const relayTags =
          relayEv?.tags
            ?.filter?.((t: string[]) => t[0] === 'r' && t[1])
            .map((t: string[]) => t[1])
            .filter(isRelayUrl) ?? [];
        if (relayTags.length) {
          setSignerRelays((prev) => mergeRelays(prev, relayTags));
        }
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

  const pollPayment = useCallback(async () => {
    if (!paymentRef) return;
    try {
      const res = await fetch(
        `${apiBase.replace(/\/$/, '')}/api/lnurlp/pay/status/${encodeURIComponent(paymentRef)}`
      );
      if (res.ok) {
        const body = await res.json();
        if (
          ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED', 'PAID'].includes(
            String(body.status || '').toUpperCase()
          )
        ) {
          setQrStatus('paid');
          setUnlockedPayload('Paid content unlocked');
          setLocked(false);
          if (qrInvoice) {
            paidInvoicesRef.current.add(qrInvoice);
            const waiters = payWaitersRef.current.get(qrInvoice);
            if (waiters) {
              waiters.forEach((fn) => fn(true));
              payWaitersRef.current.delete(qrInvoice);
            }
          }
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
    setPayWsState('connecting');
    const wsUrl = `${apiBase.replace(/\/$/, '').replace(/^http/, 'ws')}/ws/pay`;
    const ws = new WebSocket(wsUrl);
    const pr = qrInvoice;
    ws.onopen = () => setPayWsState('open');
    ws.onerror = () => setPayWsState('error');
    ws.onclose = () => setPayWsState((prev) => (prev === 'error' ? prev : 'idle'));
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'invoice-paid' && msg.pr === pr) {
          setQrStatus('paid');
          setUnlockedPayload('Paid content unlocked');
          setLocked(false);
          paidInvoicesRef.current.add(pr);
          const waiters = payWaitersRef.current.get(pr);
          if (waiters) {
            waiters.forEach((fn) => fn(true));
            payWaitersRef.current.delete(pr);
          }
        }
      } catch {
        // ignore malformed frames
      }
    };
    const pollId = paymentRef ? window.setInterval(pollPayment, 5000) : null;
    return () => {
      ws.close();
      if (pollId) window.clearInterval(pollId);
    };
  }, [qrInvoice, apiBase, paymentRef, pollPayment]);

  useEffect(() => {
    const fetchHealth = async () => {
      // always check against real API
      const results: Health[] = [];
      try {
        const apiRes = await fetch(
          apiBase.startsWith('/api') ? '/api/health' : `${apiBase}/health`
        );
        results.push({
          label: 'API',
          status: apiRes.ok ? 'ok' : 'fail',
          detail: `http ${apiRes.status}`
        });
      } catch (err) {
        results.push({ label: 'API', status: 'error', detail: formatError(err) });
      }
      try {
        const lnRes = await fetch(
          apiBase.startsWith('/api') ? '/api/health/lnbits' : `${apiBase}/health/lnbits`
        );
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

  const handleUnlocked = useCallback(() => setLocked(false), []);
  const verifyPayment = useCallback(async (pr: string) => {
    if (!pr) return false;
    if (paidInvoicesRef.current.has(pr)) return true;
    return await new Promise<boolean>((resolve) => {
      const existing = payWaitersRef.current.get(pr) ?? new Set<(ok: boolean) => void>();
      payWaitersRef.current.set(pr, existing);
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        existing.delete(resolveFn);
        if (existing.size === 0) payWaitersRef.current.delete(pr);
        resolve(false);
      }, 90_000);
      const resolveFn = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        existing.delete(resolveFn);
        if (existing.size === 0) payWaitersRef.current.delete(pr);
        resolve(ok);
      };
      existing.add(resolveFn);
    });
  }, []);
  useMountWidgets(
    username,
    amount,
    relaysCsv,
    handleUnlocked,
    false,
    setQrInvoice,
    setQrAmount,
    setUnlockedPayload,
    setQrStatus,
    setRelayStats,
    relaysList,
    tab,
    verifyPayment
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
      setPaymentRef(body.provider_ref ?? body.payment_hash ?? null);
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
      const res = await fetch(`${apiBase}/regtest/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: inv })
      });
      const body = await res.json();
      if (!res.ok || body?.ok === false) throw new Error(body?.error || `HTTP ${res.status}`);
      setPayerStatus('paid');
      setPayerMessage('Paid via test payer');
      setWalletRefresh((n) => n + 1);
      if (qrInvoice && inv.includes(qrInvoice.slice(0, 12))) {
        setQrStatus('paid');
        setLocked(false);
      }
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
    <main className="nostrstack nostrstack-theme nostrstack-gallery" data-nostrstack-theme={theme}>
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
            style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'lightning'}
              onClick={() => setTab('lightning')}
              style={tabBtn(tab === 'lightning', themeStyles)}
            >
              Lightning
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'nostr'}
              onClick={() => setTab('nostr')}
              style={tabBtn(tab === 'nostr', themeStyles)}
            >
              Nostr
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'logs'}
              onClick={() => setTab('logs')}
              style={tabBtn(tab === 'logs', themeStyles)}
            >
              Logs
            </button>
          </div>

          <div className="nostrstack-envbar" style={{ marginBottom: '1rem' }}>
            <Pill label="Host" value={demoHost} tone="info" />
            <Pill label="API" value={apiBase} tone="info" />
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
        {tab === 'lightning' && (
          <>
            {paymentRef && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '1rem',
                  alignItems: 'center'
                }}
              >
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

            <details
              className="nostrstack-gallery-advanced"
              style={{ marginBottom: '1rem' }}
              open={walletOverrideOpen}
              onToggle={(e) => {
                setWalletOverrideOpen((e.currentTarget as HTMLDetailsElement).open);
              }}
            >
              <summary>Advanced: LNbits wallet override</summary>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <div style={{ color: themeStyles.muted, fontSize: '0.95rem' }}>
                  Example: URL <code>http://localhost:15001</code>, Admin key from LNbits wallet API
                  info, optional Wallet ID for <code>/api/v1/wallet?usr=&lt;id&gt;</code> fallback.
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
              </div>
            </details>
            <div
            style={{
              display: 'grid',
              gap: '0.4rem',
              padding: '0.75rem 0.85rem',
              background:
                'color-mix(in oklab, var(--nostrstack-color-primary-soft) 55%, var(--nostrstack-color-surface))',
              border: `1px solid ${layout.border}`,
              borderRadius: layout.radius,
              marginBottom: '1rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <strong>Pay an invoice with Test payer (lnd-payer)</strong>
              <span style={{ color: themeStyles.muted, fontSize: '0.9rem' }}>
                Prefunded LND node paying outbound; use this to settle demo invoices instantly.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
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
                style={{
                  color:
                    payerStatus === 'error'
                      ? 'var(--nostrstack-color-danger)'
                      : 'var(--nostrstack-color-success)',
                  fontSize: '0.9rem'
                }}
              >
                {payerMessage}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <FaucetButton apiBase={apiBase} onFunded={() => setWalletRefresh((n) => n + 1)} />
          </div>
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
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Amount (sats)</span>
                <input
                  type="number"
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
              </div>
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
                  <button type="button" onClick={() => setRelaysCsv(relaysEnvDefault.join(','))}>
                    Use real defaults
                  </button>
                  <CopyButton text={relayLabel} label="Copy relays" />
                </div>
                <div
                  style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
                >
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

          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
            }}
          >
            <Card title="Tip button">
              <div style={{ marginBottom: '0.5rem', color: themeStyles.muted }}>
                LNURLp flow. Request a real invoice from the API.
              </div>
              <div id="tip-container" />
              <div style={{ marginTop: '0.75rem' }}>
                <button onClick={requestRealInvoice} disabled={realBusy}>
                  {realBusy ? 'Requesting…' : `Request real invoice (${amount} sats)`}
                </button>
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.5rem',
                  color: themeStyles.muted
                }}
              >
                <span>Creates an invoice; unlocks after real payment confirmation.</span>
                <span
                  className={
                    locked ? 'pay-status pay-status--pending' : 'pay-status pay-status--paid'
                  }
                >
                  <span className="dot" />
                  {locked ? 'Waiting for payment' : 'Unlocked'}
                </span>
              </div>
              <div id="pay-container" />
              <div id="unlock-status" style={{ marginTop: '0.5rem' }} data-testid="unlock-status">
                {locked ? 'Locked' : 'Unlocked!'}
              </div>
              {!locked && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    background: themeStyles.inset,
                    border: `1px solid ${layout.border}`,
                    borderRadius: 'var(--nostrstack-radius-md)',
                    padding: '0.75rem'
                  }}
                >
                  <strong>Unlocked content:</strong>
                  <div
                    style={{
                      marginTop: '0.35rem',
                      fontFamily: 'var(--nostrstack-font-mono)',
                      fontSize: '0.9rem',
                      color: themeStyles.text
                    }}
                  >
                    secrets/regtest.txt — "The quick brown fox pays 21 sats."
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

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
              profile={profile}
              fullProfile={profile}
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
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
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
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
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
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </label>
              <div
                style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}
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
          <Card title="Comments (Nostr)">
            <CommentsPanel
              relayLabel={relayLabel}
              relaysEnvDefault={relaysEnvDefault}
              relaysList={relaysList}
              relayStats={relayStats}
            />
            <div id="comments-container" />
          </Card>
        </div>
      )}

      {tab === 'logs' && (
        <Card title="Logs">
          <div style={{ marginBottom: '0.5rem', color: themeStyles.muted, fontSize: '0.95rem' }}>
            Streams backend logs from <code>{resolveLogStreamUrl(apiBase)}</code> and captures
            frontend console (toggle to enable).
          </div>
          <LogViewer backendUrl={resolveLogStreamUrl(apiBase)} />
        </Card>
      )}

      <details className="nostrstack-gallery-advanced" style={{ marginBottom: '1rem' }}>
        <summary>Status & build</summary>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '0.5rem',
            color: themeStyles.muted
          }}
        >
          <span>
            Build: {import.meta.env.VITE_APP_COMMIT ?? 'dev'} •{' '}
            {import.meta.env.VITE_APP_BUILD_TIME ?? 'now'}
          </span>
          <span>Host: {demoHost}</span>
          <span>API base: {apiBase}</span>
        </div>
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
        {tab === 'lightning' && (
          <details className="nostrstack-gallery-advanced" style={{ marginTop: '1rem' }}>
            <summary>Advanced: Telemetry</summary>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                flexWrap: 'wrap'
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 240 }}>
                <span style={{ fontSize: '0.9rem', color: themeStyles.muted }}>
                  Telemetry WS override
                </span>
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
                  if (typeof window !== 'undefined')
                    window.localStorage.removeItem('nostrstack.telemetry.ws');
                }}
              >
                Reset WS
              </button>
            </div>
            <BlockList wsUrl={telemetryWsUrl} network={network} />
          </details>
        )}
      </details>

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

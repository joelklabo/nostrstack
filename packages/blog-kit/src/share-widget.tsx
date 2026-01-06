'use client';

import { ensureNostrstackRoot } from '@nostrstack/embed';
import { Relay, type Subscription } from 'nostr-tools/relay';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNostrstackConfig } from './context';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

type UnsignedEvent = {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
};

type SignedEvent = UnsignedEvent & {
  id: string;
  sig: string;
};

type ShareEvent = Pick<SignedEvent, 'id' | 'pubkey' | 'created_at' | 'content' | 'tags'>;

export type NostrProfile = {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  about?: string;
};

function shortKey(pk?: string) {
  return pk ? `${pk.slice(0, 8)}…${pk.slice(-6)}` : 'nostr user';
}

function timeAgo(nowMs: number, createdAtSec: number) {
  const ageSec = Math.max(0, Math.floor(nowMs / 1000) - createdAtSec);
  if (ageSec < 10) return 'just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 48) return `${ageHr}h ago`;
  const ageDay = Math.floor(ageHr / 24);
  return `${ageDay}d ago`;
}

function parseProfile(pubkey: string, raw: unknown): NostrProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  return {
    pubkey,
    name: typeof rec.name === 'string' ? rec.name : undefined,
    display_name: typeof rec.display_name === 'string' ? rec.display_name : undefined,
    picture: typeof rec.picture === 'string' ? rec.picture : undefined,
    nip05: typeof rec.nip05 === 'string' ? rec.nip05 : undefined,
    about: typeof rec.about === 'string' ? rec.about : undefined
  };
}

async function publishToRelays(relays: string[], event: SignedEvent) {
  const connections: Relay[] = [];
  try {
    for (const url of relays) {
      const relay = await Relay.connect(url);
      connections.push(relay);
      await relay.publish(event);
    }
  } finally {
    const toClose = connections.slice();
    globalThis.setTimeout(() => {
      toClose.forEach((r) => {
        try {
          (r as unknown as { _connected: boolean })._connected = false;
        } catch {
          // ignore
        }
        try {
          r.close();
        } catch {
          // ignore
        }
      });
    }, 0);
  }
}

async function copyText(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch (error) {
    console.warn('clipboard copy failed', error);
  }
}

export type ShareWidgetProps = {
  itemId: string;
  url: string;
  title: string;
  lnAddress?: string;
  relays?: string[];
  /**
   * Additional hashtag tag to include in the share event and use for discovery.
   * If omitted, defaults to `nostrstack:<itemId>`.
   */
  tag?: string;
  maxItems?: number;
  className?: string;
};

export function ShareWidget({
  itemId,
  url,
  title,
  lnAddress,
  relays,
  tag,
  maxItems = 100,
  className
}: ShareWidgetProps) {
  const cfg = useNostrstackConfig();
  const rootRef = useRef<HTMLDivElement>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ShareEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, NostrProfile>>({});
  const profilesRef = useRef<Record<string, NostrProfile>>({});

  const relayList = useMemo(() => relays ?? cfg.relays ?? DEFAULT_RELAYS, [relays, cfg.relays]);
  const relayTargets = useMemo(() => relayList.map((r) => r.trim()).filter(Boolean), [relayList]);
  const effectiveTag = useMemo(() => tag ?? `nostrstack:${itemId}`, [tag, itemId]);
  const note = useMemo(
    () => `${title}\n${url}${lnAddress ? `\n⚡ ${lnAddress}` : ''}`,
    [title, url, lnAddress]
  );

  useEffect(() => {
    if (!rootRef.current) return;
    ensureNostrstackRoot(rootRef.current);
  }, []);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const uniqueSharers = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) set.add(ev.pubkey);
    return Array.from(set);
  }, [events]);

  const countLabel = useMemo(() => {
    if (events.length >= maxItems) return `${maxItems}+`;
    return String(events.length);
  }, [events.length, maxItems]);

  const avatarPubkeys = useMemo(() => uniqueSharers.slice(0, 12), [uniqueSharers]);

  const hydrateProfile = useCallback((pubkey: string, content: string) => {
    try {
      const raw = JSON.parse(content) as unknown;
      const parsed = parseProfile(pubkey, raw);
      if (!parsed) return;
      setProfiles((prev) => (prev[pubkey] ? prev : { ...prev, [pubkey]: parsed }));
    } catch {
      // ignore invalid metadata
    }
  }, []);

  useEffect(() => {
    if (!relayTargets.length) {
      setStatus('error');
      setError('No relays configured.');
      return;
    }

    let cancelled = false;
    let connections: Relay[] = [];
    let shareSub: Subscription[] = [];
    const profileFetchInFlight = new Set<string>();
    let closeTimer: number | null = null;

    const closeAll = () => {
      const subsToClose = shareSub;
      shareSub = [];
      subsToClose.forEach((s) => {
        try {
          s.close();
        } catch {
          // ignore
        }
      });
      const toClose = connections;
      connections = [];

      if (closeTimer != null) return;
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        toClose.forEach((c) => {
          try {
            // Avoid sending CLOSE frames during teardown/tab switches. `nostr-tools` schedules sends as microtasks,
            // so closing the WebSocket synchronously can lead to `WebSocket is already in CLOSING or CLOSED state.`
            (c as unknown as { _connected: boolean })._connected = false;
          } catch {
            // ignore
          }
          try {
            c.close();
          } catch {
            // ignore
          }
        });
      }, 0);
    };

    const connect = async () => {
      setStatus('connecting');
      setError(null);
      try {
        const results = await Promise.allSettled(relayTargets.map((r) => Relay.connect(r)));
        const ok = results
          .filter((r): r is PromiseFulfilledResult<Relay> => r.status === 'fulfilled')
          .map((r) => r.value);
        if (cancelled) {
          globalThis.setTimeout(() => {
            ok.forEach((r) => {
              try {
                (r as unknown as { _connected: boolean })._connected = false;
              } catch {
                // ignore
              }
              try {
                r.close();
              } catch {
                // ignore
              }
            });
          }, 0);
          return;
        }
        connections = ok;
        if (!connections.length) {
          setStatus('error');
          setError('No relays reachable.');
          return;
        }

        setStatus('connected');

        const filters = [
          { kinds: [1], '#r': [url], limit: Math.min(500, Math.max(1, maxItems)) },
          { kinds: [1], '#t': [effectiveTag], limit: Math.min(500, Math.max(1, maxItems)) }
        ];

        shareSub = connections.map((relay) =>
          relay.subscribe(filters, {
            onevent: (ev: SignedEvent) => {
              if (cancelled) return;
              if (!ev?.id || typeof ev.id !== 'string') return;
              if (!ev.pubkey || typeof ev.pubkey !== 'string') return;
              if (!ev.created_at || typeof ev.created_at !== 'number') return;
              const next: ShareEvent = {
                id: ev.id,
                pubkey: ev.pubkey,
                created_at: ev.created_at,
                content: ev.content ?? '',
                tags: Array.isArray(ev.tags) ? ev.tags : []
              };
              setEvents((prev) => {
                if (prev.some((p) => p.id === next.id)) return prev;
                const merged = [next, ...prev].sort((a, b) => b.created_at - a.created_at);
                return merged.slice(0, maxItems);
              });

              if (!profilesRef.current[ev.pubkey] && !profileFetchInFlight.has(ev.pubkey)) {
                profileFetchInFlight.add(ev.pubkey);
                const subs: Subscription[] = [];
                for (const r of connections) {
                  subs.push(
                    r.subscribe([{ kinds: [0], authors: [ev.pubkey], limit: 1 }], {
                      onevent: (meta: SignedEvent) => {
                        if (cancelled) return;
                        hydrateProfile(ev.pubkey, meta.content ?? '');
                        profileFetchInFlight.delete(ev.pubkey);
                        subs.forEach((s) => s.close());
                      },
                      oneose: () => {
                        // allow retries in the future if no metadata found
                        profileFetchInFlight.delete(ev.pubkey);
                      }
                    })
                  );
                }
              }
            }
          })
        );
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to connect to relays');
        closeAll();
      }
    };

    connect();
    return () => {
      cancelled = true;
      closeAll();
    };
  }, [relayTargets.join(','), url, effectiveTag, maxItems, hydrateProfile]);

  const handleShare = useCallback(async () => {
    setError(null);
    setShareState('sharing');
    const nostr = (
      globalThis as unknown as {
        nostr?: {
          getPublicKey: () => Promise<string>;
          signEvent: (ev: UnsignedEvent) => Promise<SignedEvent>;
        };
      }
    ).nostr;

    const tags: string[][] = [
      ['r', url],
      ['t', effectiveTag]
    ];
    const unsigned = async () => {
      if (!nostr?.getPublicKey || !nostr.signEvent) {
        throw new Error('Nostr signer (NIP-07) required');
      }
      const pubkey = await nostr.getPublicKey();
      const now = Math.floor(Date.now() / 1000);
      const event: UnsignedEvent = {
        kind: 1,
        created_at: now,
        tags,
        content: note,
        pubkey
      };
      return await nostr.signEvent(event);
    };

    try {
      if (nostr && relayTargets.length) {
        const signed = await unsigned();
        await publishToRelays(relayTargets, signed);
        setShareState('shared');
        setEvents((prev) => {
          if (prev.some((p) => p.id === signed.id)) return prev;
          const next: ShareEvent = {
            id: signed.id,
            pubkey: signed.pubkey,
            created_at: signed.created_at,
            content: signed.content,
            tags: signed.tags
          };
          return [next, ...prev].sort((a, b) => b.created_at - a.created_at).slice(0, maxItems);
        });
        return;
      }

      if (navigator?.share) {
        await navigator.share({ title, text: note, url });
        setShareState('shared');
        return;
      }

      await copyText(note);
      setShareState('shared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed');
      setShareState('error');
    }
  }, [effectiveTag, maxItems, note, relayTargets, title, url]);

  const header = (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800 }}>Shares</div>
        <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: 13 }}>
          <strong style={{ color: 'var(--nostrstack-color-text)' }}>{countLabel}</strong>{' '}
          {Number(countLabel.replace('+', '')) === 1 ? 'share' : 'shares'}
          {uniqueSharers.length ? ` · ${uniqueSharers.length} people` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 10px',
            borderRadius: 999,
            border: '1px solid var(--nostrstack-color-border)',
            background: 'var(--nostrstack-color-surface)',
            fontSize: 12,
            color:
              status === 'connected'
                ? 'var(--nostrstack-color-success)'
                : status === 'error'
                  ? 'var(--nostrstack-color-danger)'
                  : 'var(--nostrstack-color-text-muted)',
            whiteSpace: 'nowrap'
          }}
          aria-live="polite"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background:
                status === 'connected'
                  ? 'var(--nostrstack-color-success)'
                  : status === 'error'
                    ? 'var(--nostrstack-color-danger)'
                    : 'var(--nostrstack-color-border)'
            }}
          />
          {status === 'connected'
            ? 'Realtime'
            : status === 'connecting'
              ? 'Connecting'
              : status === 'error'
                ? 'Offline'
                : 'Idle'}
        </span>
        <button
          type="button"
          onClick={handleShare}
          disabled={shareState === 'sharing'}
          aria-busy={shareState === 'sharing'}
          className="nostrstack-btn nostrstack-btn--primary"
          style={{ padding: '0.45rem 0.8rem' }}
        >
          {shareState === 'sharing' ? 'Sharing…' : shareState === 'shared' ? 'Shared' : 'Share'}
        </button>
      </div>
    </div>
  );

  const avatarStack = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {avatarPubkeys.map((pk, idx) => {
          const profile = profiles[pk];
          const label = profile?.display_name || profile?.name || profile?.nip05 || shortKey(pk);
          const pic = profile?.picture;
          return (
            <div
              key={pk}
              title={label}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: '1px solid var(--nostrstack-color-border)',
                background: 'var(--nostrstack-color-surface)',
                marginLeft: idx === 0 ? 0 : -8,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                boxShadow:
                  '0 0 0 2px color-mix(in oklab, var(--nostrstack-color-surface) 90%, transparent)'
              }}
              aria-label={label}
            >
              {pic ? (
                <img
                  src={pic}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span
                  style={{ fontSize: 12, fontWeight: 800, color: 'var(--nostrstack-color-text)' }}
                >
                  {(profile?.display_name || profile?.name || pk).slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          );
        })}
        {uniqueSharers.length > avatarPubkeys.length && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '1px solid var(--nostrstack-color-border)',
              background:
                'color-mix(in oklab, var(--nostrstack-color-primary) 12%, var(--nostrstack-color-surface))',
              marginLeft: avatarPubkeys.length ? -8 : 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--nostrstack-color-text)'
            }}
            title={`${uniqueSharers.length - avatarPubkeys.length} more`}
          >
            +{uniqueSharers.length - avatarPubkeys.length}
          </div>
        )}
      </div>
      {!uniqueSharers.length && (
        <div style={{ fontSize: 13, color: 'var(--nostrstack-color-text-muted)' }}>
          No shares yet. Be the first.
        </div>
      )}
    </div>
  );

  const recent = events.slice(0, 8);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        border: '1px solid var(--nostrstack-color-border)',
        borderRadius: 'var(--nostrstack-radius-lg)',
        background:
          'radial-gradient(900px circle at top left, color-mix(in oklab, var(--nostrstack-color-primary) 10%, transparent), transparent 60%), var(--nostrstack-color-surface)',
        padding: 14,
        boxShadow: 'var(--nostrstack-shadow-md)'
      }}
    >
      {header}
      <div style={{ marginTop: 10 }}>{avatarStack}</div>

      {recent.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {recent.map((ev) => {
            const profile = profiles[ev.pubkey];
            const name =
              profile?.display_name || profile?.name || profile?.nip05 || shortKey(ev.pubkey);
            const pic = profile?.picture;
            const href = `https://njump.me/${ev.id}`;
            return (
              <a
                key={ev.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid var(--nostrstack-color-border)',
                  background: 'color-mix(in oklab, var(--nostrstack-color-surface) 90%, white)',
                  textDecoration: 'none',
                  color: 'var(--nostrstack-color-text)'
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    overflow: 'hidden',
                    border: '1px solid var(--nostrstack-color-border)',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--nostrstack-color-surface)',
                    flex: '0 0 auto'
                  }}
                  aria-hidden="true"
                >
                  {pic ? (
                    <img
                      src={pic}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 800 }}>
                      {(profile?.display_name || profile?.name || ev.pubkey)
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0, display: 'grid' }}>
                  <div
                    style={{
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--nostrstack-color-text-muted)' }}>
                    {timeAgo(nowMs, ev.created_at)}
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    color: 'var(--nostrstack-color-text-muted)'
                  }}
                >
                  Open
                </div>
              </a>
            );
          })}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            fontSize: 13,
            color: 'var(--nostrstack-color-danger)'
          }}
        >
          {error}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--nostrstack-color-text-muted)' }}>
        Tracking shares for{' '}
        <code style={{ fontFamily: 'var(--nostrstack-font-mono)' }}>{effectiveTag}</code>
      </div>
    </div>
  );
}

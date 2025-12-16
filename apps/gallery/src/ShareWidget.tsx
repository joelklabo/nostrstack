import { Relay, type Subscription } from 'nostr-tools/relay';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNow } from './useNow';

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

type NostrProfile = {
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
    window.setTimeout(() => {
      toClose.forEach((r) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r as any)._connected = false;
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
  } catch {
    // ignore
  }
}

export function ShareWidget({
  itemId,
  url,
  title,
  lnAddress,
  relays,
  maxItems = 100
}: {
  itemId: string;
  url: string;
  title: string;
  lnAddress?: string;
  relays: string[];
  maxItems?: number;
}) {
  const now = useNow();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'mock'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'shared' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ShareEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, NostrProfile>>({});
  const profilesRef = useRef<Record<string, NostrProfile>>({});

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const effectiveTag = useMemo(() => `nostrstack:${itemId}`, [itemId]);
  const note = useMemo(
    () => `${title}\n${url}${lnAddress ? `\n⚡ ${lnAddress}` : ''}`,
    [title, url, lnAddress]
  );
  const relayTargets = useMemo(() => relays.map((r) => r.trim()).filter(Boolean).filter((r) => r !== 'mock'), [relays]);
  const mockMode = useMemo(() => relays.some((r) => r === 'mock'), [relays]);
  const relayKey = useMemo(() => relayTargets.slice().sort().join(','), [relayTargets]);

  const uniqueSharers = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) set.add(ev.pubkey);
    return Array.from(set);
  }, [events]);

  const countLabel = useMemo(() => {
    if (events.length >= maxItems) return `${maxItems}+`;
    return String(events.length);
  }, [events.length, maxItems]);

  const hydrateProfile = useCallback((pubkey: string, content: string) => {
    try {
      const raw = JSON.parse(content) as unknown;
      const parsed = parseProfile(pubkey, raw);
      if (!parsed) return;
      setProfiles((prev) => ({ ...prev, [pubkey]: parsed }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (mockMode) {
      setStatus('mock');
      setError(null);
      return;
    }

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

      // React can unmount/mount components within the same click handler task. `nostr-tools` uses
      // `connectionPromise.then(() => ws.send(...))` which schedules microtasks for REQ/CLOSE frames.
      // If we close the WebSocket synchronously here, those microtasks can run after `ws.close()`
      // and throw `WebSocket is already in CLOSING or CLOSED state.` (console error / QA failure).
      //
      // Deferring the actual close to the next macrotask avoids that race.
      if (closeTimer != null) return;
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        toClose.forEach((c) => {
          try {
            // Avoid sending CLOSE frames during teardown/tab switches.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c as any)._connected = false;
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
          window.setTimeout(() => {
            ok.forEach((r) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (r as any)._connected = false;
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
                        subs.forEach((s) => {
                          try {
                            s.close();
                          } catch {
                            // ignore
                          }
                        });
                      },
                      oneose: () => {
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
  }, [relayKey, url, effectiveTag, maxItems, hydrateProfile, relayTargets, mockMode]);

  const handleShare = useCallback(async () => {
    setError(null);
    setShareState('sharing');
    const nostr = (
      window as unknown as {
        nostr?: {
          getPublicKey: () => Promise<string>;
          signEvent: (ev: UnsignedEvent) => Promise<SignedEvent>;
        };
      }
    ).nostr;

    const tags: string[][] = [['r', url], ['t', effectiveTag]];

    try {
      if (nostr?.getPublicKey && nostr.signEvent && relayTargets.length) {
        const pubkey = await nostr.getPublicKey();
        const now = Math.floor(Date.now() / 1000);
        const unsigned: UnsignedEvent = {
          kind: 1,
          created_at: now,
          tags,
          content: note,
          pubkey
        };
        const signed = await nostr.signEvent(unsigned);
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

  const avatarPubkeys = uniqueSharers.slice(0, 10);

  return (
    <div
      style={{
        border: '1px solid var(--nostrstack-color-border)',
        borderRadius: 'var(--nostrstack-radius-lg)',
        background:
          'radial-gradient(900px circle at top left, color-mix(in oklab, var(--nostrstack-color-primary) 10%, transparent), transparent 60%), var(--nostrstack-color-surface)',
        padding: 14,
        boxShadow: 'var(--nostrstack-shadow-md)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontWeight: 800 }}>Shares</div>
          <div style={{ fontSize: 13, color: 'var(--nostrstack-color-text-muted)' }}>
            <strong style={{ color: 'var(--nostrstack-color-text)' }}>{countLabel}</strong>{' '}
            {Number(countLabel.replace('+', '')) === 1 ? 'share' : 'shares'}
            {uniqueSharers.length ? ` · ${uniqueSharers.length} people` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                  : status === 'mock'
                    ? 'var(--nostrstack-color-warning)'
                  : 'var(--nostrstack-color-text-muted)',
              whiteSpace: 'nowrap'
            }}
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
                      : status === 'mock'
                        ? 'var(--nostrstack-color-warning)'
                      : 'var(--nostrstack-color-border)'
              }}
            />
            {status === 'connected'
              ? 'Realtime'
              : status === 'connecting'
                ? 'Connecting'
                : status === 'mock'
                  ? 'Mock'
                : status === 'error'
                  ? 'Offline'
                  : 'Idle'}
          </span>
          <button
            type="button"
            className="nostrstack-btn nostrstack-btn--primary"
            onClick={handleShare}
            disabled={shareState === 'sharing'}
            aria-busy={shareState === 'sharing'}
            style={{ padding: '0.45rem 0.8rem' }}
          >
            {shareState === 'sharing' ? 'Sharing…' : shareState === 'shared' ? 'Shared' : 'Share'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                  boxShadow: '0 0 0 2px color-mix(in oklab, var(--nostrstack-color-surface) 90%, transparent)'
                }}
              >
                {pic ? (
                  <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
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
                background: 'color-mix(in oklab, var(--nostrstack-color-primary) 12%, var(--nostrstack-color-surface))',
                marginLeft: avatarPubkeys.length ? -8 : 0,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 800
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

      {events.slice(0, 6).length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {events.slice(0, 6).map((ev) => {
            const profile = profiles[ev.pubkey];
            const name = profile?.display_name || profile?.name || profile?.nip05 || shortKey(ev.pubkey);
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
                >
                  {pic ? (
                    <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 800 }}>
                      {(profile?.display_name || profile?.name || ev.pubkey).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0, display: 'grid' }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--nostrstack-color-text-muted)' }}>
                    {timeAgo(now, ev.created_at)}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--nostrstack-color-text-muted)' }}>
                  Open
                </div>
              </a>
            );
          })}
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 10, fontSize: 13, color: 'var(--nostrstack-color-danger)' }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--nostrstack-color-text-muted)' }}>
        Tracking shares for <code style={{ fontFamily: 'var(--nostrstack-font-mono)' }}>{effectiveTag}</code>
      </div>
    </div>
  );
}

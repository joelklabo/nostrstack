import { parseRelays } from '@nostrstack/blog-kit';
import { type Event, nip19, SimplePool } from 'nostr-tools';
import { useEffect, useMemo, useState } from 'react';

import { getEventKindLabel, parseProfileContent, ProfileCard, type ProfileMeta,renderEvent } from './nostr/eventRenderers';
import { CopyButton } from './ui/CopyButton';
import { JsonView } from './ui/JsonView';

type Target =
  | { type: 'event'; id: string; relays: string[] }
  | { type: 'profile'; pubkey: string; relays: string[] }
  | { type: 'address'; kind: number; pubkey: string; identifier: string; relays: string[] };

type LoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  targetLabel?: string;
  relays: string[];
  event?: Event;
  authorProfile?: ProfileMeta | null;
  authorPubkey?: string;
};

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];
const REQUEST_TIMEOUT_MS = 8000;

function normalizeId(raw: string) {
  return raw.trim().replace(/^nostr:/i, '');
}

function isHex64(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function uniqRelays(relays: string[]) {
  return Array.from(new Set(relays.filter(Boolean)));
}

function resolveTarget(rawId: string): Target | null {
  const cleaned = normalizeId(rawId);

  if (isHex64(cleaned)) {
    return { type: 'event', id: cleaned.toLowerCase(), relays: [] };
  }

  try {
    const decoded = nip19.decode(cleaned.toLowerCase());
    if (decoded.type === 'note') {
      return { type: 'event', id: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nevent') {
      const data = decoded.data as { id: string; relays?: string[] };
      return { type: 'event', id: data.id, relays: data.relays ?? [] };
    }
    if (decoded.type === 'npub') {
      return { type: 'profile', pubkey: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nprofile') {
      const data = decoded.data as { pubkey: string; relays?: string[] };
      return { type: 'profile', pubkey: data.pubkey, relays: data.relays ?? [] };
    }
    if (decoded.type === 'naddr') {
      const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] };
      return {
        type: 'address',
        kind: data.kind,
        pubkey: data.pubkey,
        identifier: data.identifier,
        relays: data.relays ?? []
      };
    }
  } catch {
    // ignore decode errors
  }

  return null;
}

function formatTime(ts?: number) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString([], { hour12: false });
}

function toNpub(pubkey?: string) {
  if (!pubkey) return '—';
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

function toNote(id?: string) {
  if (!id) return '—';
  try {
    return nip19.noteEncode(id);
  } catch {
    return id;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = globalThis.setTimeout(() => {
        globalThis.clearTimeout(id);
        reject(new Error('Request timed out'));
      }, ms);
    })
  ]);
}

export function NostrEventView({ rawId }: { rawId: string }) {
  const [state, setState] = useState<LoadState>({
    status: 'idle',
    relays: []
  });

  const target = useMemo(() => resolveTarget(rawId), [rawId]);
  const relayList = useMemo(() => {
    const envRelays = parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
    const targetRelays = target?.relays ?? [];
    return uniqRelays([...targetRelays, ...envRelays, ...FALLBACK_RELAYS]);
  }, [target]);

  useEffect(() => {
    if (!target) {
      setState({
        status: 'error',
        relays: [],
        error: 'Unsupported or invalid nostr identifier.'
      });
      return;
    }

    let cancelled = false;
    const pool = new SimplePool();
    const closePool = () => {
      globalThis.setTimeout(() => {
        try {
          pool.close(relayList);
        } catch {
          // ignore close errors
        }
      }, 0);
    };

    const load = async () => {
      setState((prev) => ({
        ...prev,
        status: 'loading',
        relays: relayList,
        error: undefined
      }));

      try {
        let event: Event | null = null;
        if (target.type === 'event') {
          event = await withTimeout(pool.get(relayList, { ids: [target.id] }), REQUEST_TIMEOUT_MS);
        } else if (target.type === 'profile') {
          event = await withTimeout(
            pool.get(relayList, { kinds: [0], authors: [target.pubkey] }),
            REQUEST_TIMEOUT_MS
          );
        } else {
          const identifier = target.identifier ?? '';
          event = await withTimeout(
            pool.get(relayList, { kinds: [target.kind], authors: [target.pubkey], '#d': [identifier] }),
            REQUEST_TIMEOUT_MS
          );
        }

        if (cancelled) return;
        if (!event) {
          setState({
            status: 'error',
            relays: relayList,
            error: 'Event not found on available relays.'
          });
          return;
        }

        let authorProfile: ProfileMeta | null = null;
        if (event.kind !== 0) {
          const profileEvent = await withTimeout(
            pool.get(relayList, { kinds: [0], authors: [event.pubkey] }),
            REQUEST_TIMEOUT_MS
          );
          authorProfile = parseProfileContent(profileEvent?.content);
        } else {
          authorProfile = parseProfileContent(event.content);
        }

        if (cancelled) return;
        setState({
          status: 'ready',
          relays: relayList,
          event,
          authorProfile,
          authorPubkey: event.pubkey,
          targetLabel: rawId
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          relays: relayList,
          error: err instanceof Error ? err.message : String(err)
        });
      } finally {
        closePool();
      }
    };

    load();
    return () => {
      cancelled = true;
      closePool();
    };
  }, [rawId, relayList, target]);

  const event = state.event;
  const authorProfile = state.authorProfile;
  const title = event ? getEventKindLabel(event.kind) : 'Nostr Event';
  const rendered = event ? renderEvent(event) : null;

  return (
    <div className="nostr-event-page">
      <header className="nostr-event-header">
        <div>
          <div className="nostr-event-title">{title}</div>
          <div className="nostr-event-subtitle">Rendered by NostrStack</div>
        </div>
        <div className="nostr-event-actions">
          <a className="nostr-event-back" href="/">
            Back to App
          </a>
        </div>
      </header>

      <section className="nostr-event-card">
        <div className="nostr-event-meta">
          <div>
            <span className="nostr-event-label">Target</span>
            <div className="nostr-event-value">
              {state.targetLabel ?? rawId}
              <CopyButton text={state.targetLabel ?? rawId} label="Copy" size="sm" />
            </div>
          </div>
          <div>
            <span className="nostr-event-label">Relays</span>
            <div className="nostr-event-value">{relayList.length}</div>
          </div>
          <div>
            <span className="nostr-event-label">Status</span>
            <div className="nostr-event-value">{state.status.toUpperCase()}</div>
          </div>
        </div>

        {state.status === 'loading' && (
          <div className="nostr-event-loading">Fetching event data...</div>
        )}
        {state.status === 'error' && (
          <div className="nostr-event-error">ERROR: {state.error}</div>
        )}

        {event && (
          <>
            <div className="nostr-event-details">
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Event ID</span>
                <div className="nostr-event-value">
                  {toNote(event.id)}
                  <CopyButton text={event.id} label="Copy ID" size="sm" />
                </div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Author</span>
                <div className="nostr-event-value">
                  {toNpub(event.pubkey)}
                  <CopyButton text={event.pubkey} label="Copy Pubkey" size="sm" />
                </div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Created</span>
                <div className="nostr-event-value">{formatTime(event.created_at)}</div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Kind</span>
                <div className="nostr-event-value">{event.kind}</div>
              </div>
            </div>

            <div className="nostr-event-content">
              {authorProfile && event.kind !== 0 && <ProfileCard profile={authorProfile} />}
              {rendered?.body}
              {rendered?.footer}
            </div>

            <div className="nostr-event-tags">
              <span className="nostr-event-label">Tags</span>
              <div className="nostr-event-taglist">
                {event.tags.length === 0 && <span className="nostr-event-tag">No tags</span>}
                {event.tags.map((tag, idx) => (
                  <span key={`${tag[0]}-${idx}`} className="nostr-event-tag">
                    {tag.join(':')}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {event && (
        <section className="nostr-event-raw">
          <JsonView value={event} title="Raw Event" />
        </section>
      )}
    </div>
  );
}
